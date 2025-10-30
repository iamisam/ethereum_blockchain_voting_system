import { NextResponse } from "next/server";
import { MongoClient, ObjectId } from "mongodb";
import { ethers, Contract, Log, EventLog } from "ethers";
import pinataSDK, { PinataPinOptions } from "@pinata/sdk";
import { REGISTRY_CONTRACT_ABI } from "@/lib/constants"; // Needed for isAdmin check
import ElectionABI from "@/lib/ElectionABI.json";

async function isAdmin(
  provider: ethers.Provider,
  ownerPrivateKey: string,
  registryAddress: string,
): Promise<boolean> {
  try {
    const adminWallet = new ethers.Wallet(ownerPrivateKey, provider);
    const registryContract = new ethers.Contract(
      registryAddress,
      REGISTRY_CONTRACT_ABI,
      adminWallet,
    );
    const owner = await registryContract.owner();
    return adminWallet.address.toLowerCase() === owner.toLowerCase();
  } catch (err) {
    console.error("Admin check failed:", err);
    return false;
  }
}

function isEthersRevertError(
  error: unknown,
): error is { revert: { args: string[] } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "revert" in error /* more checks */
  );
}

// Define a type that represents the structure we expect from VoteCast events
interface VoteCastEventArgs {
  voter: string;
  vote: string;
}
// Type guard to check if an event log has the args we need
function isVoteCastEvent(
  event: Log | EventLog,
): event is EventLog & { args: VoteCastEventArgs } {
  return (
    event &&
    typeof event === "object" &&
    "args" in event &&
    event.args !== null &&
    typeof event.args.voter === "string"
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- NEW: Helper function to determine the winner ---
const determineWinner = (tally: { [candidate: string]: number }): string => {
  const winners: string[] = [];
  let maxVotes = 0;

  // Find the highest vote count
  for (const candidate in tally) {
    if (tally[candidate] > maxVotes) {
      maxVotes = tally[candidate];
    }
  }

  // If no votes were cast, return "No Winner"
  if (maxVotes === 0) {
    return "No votes cast";
  }

  // Find all candidates with that highest count
  for (const candidate in tally) {
    if (tally[candidate] === maxVotes) {
      winners.push(candidate);
    }
  }

  // Check for a tie
  if (winners.length > 1) {
    return "It's a tie!";
  } else {
    // We have a single winner
    return winners[0];
  }
};

export async function POST(request: Request) {
  // --- Environment Variable Checks ---
  const MONGODB_URI = process.env.MONGODB_URI;
  const OWNER_PRIVATE_KEY = process.env.BACKEND_WALLET_PRIVATE_KEY;
  const REGISTRY_CONTRACT_ADDRESS = process.env.REGISTRY_CONTRACT_ADDRESS;
  const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
  const PINATA_API_KEY = process.env.PINATA_API_KEY;
  const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

  if (
    !MONGODB_URI ||
    !OWNER_PRIVATE_KEY ||
    !REGISTRY_CONTRACT_ADDRESS ||
    !SEPOLIA_RPC_URL ||
    !PINATA_API_KEY ||
    !PINATA_SECRET_API_KEY
  ) {
    console.error(
      "Missing critical server environment variables for tally-results.",
    );
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 500 },
    );
  }

  // --- Authorization Check ---
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const authorized = await isAdmin(
    provider,
    OWNER_PRIVATE_KEY,
    REGISTRY_CONTRACT_ADDRESS,
  );
  if (!authorized) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
  }

  // --- Input: Get Election ID ---
  let electionId: string | null = null;
  try {
    const { id } = await request.json();
    if (!id || !ObjectId.isValid(id)) {
      throw new Error("Invalid or missing election ID.");
    }
    electionId = id;
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json(
        { message: `Invalid input: ${err.message}` },
        { status: 400 },
      );
    }
  }

  const client = await MongoClient.connect(MONGODB_URI);

  try {
    const db = client.db();
    const electionsCollection = db.collection("elections");

    // --- Step 1: Fetch Election Data from DB ---
    const election = await electionsCollection.findOne({
      _id: new ObjectId(electionId!),
    });
    if (!election) {
      return NextResponse.json(
        { message: "Election not found." },
        { status: 404 },
      );
    }
    if (election.status === "Tallied") {
      return NextResponse.json(
        {
          message: "Election already tallied.",
          resultsIpfsHash: election.resultsIpfsHash,
        },
        { status: 400 },
      );
    }
    // Ensure election end time has passed (add buffer if needed)
    if (new Date(election.endTime) > new Date()) {
      return NextResponse.json(
        { message: "Election has not ended yet." },
        { status: 400 },
      );
    }

    // get deployment block number
    const deploymentBlockNumber = election.deploymentBlockNumber;
    if (
      typeof deploymentBlockNumber !== "number" ||
      deploymentBlockNumber < 0
    ) {
      console.warn(
        `Deployment block number missing or invalid for election ${electionId}. Defaulting scan start to block 0.`,
      );
      // Fallback to 0 if the number isn't stored correctly
    }
    const startBlock =
      typeof deploymentBlockNumber === "number" && deploymentBlockNumber >= 0
        ? deploymentBlockNumber
        : 0;

    const electionContractAddress = election.electionContractAddress;
    const adminWallet = new ethers.Wallet(OWNER_PRIVATE_KEY!, provider); // Define adminWallet earlier
    const electionContract = new Contract(
      electionContractAddress,
      ElectionABI,
      provider,
    );
    const electionContractWithSigner = electionContract.connect(
      adminWallet,
    ) as Contract;

    // --- NEW STEP: Call endElection if necessary ---
    console.log("Checking if election needs to be concluded on-chain...");
    const alreadyEnded = await electionContract.electionEnded(); // Read current state
    if (!alreadyEnded) {
      console.log(
        "Election not yet ended on-chain. Sending endElection transaction...",
      );
      try {
        const endTx = await electionContractWithSigner.endElection();
        await endTx.wait(1); // Wait for confirmation
        console.log("Election successfully concluded on-chain.");
      } catch (endErr: unknown) {
        console.error("Failed to send endElection transaction:", endErr);
        // Decide if this is a fatal error for tallying
        if (
          isEthersRevertError(endErr) &&
          endErr.revert.args[0].includes("already concluded")
        ) {
          console.log(
            "Race condition: Someone else ended the election. Proceeding...",
          );
        } else if (isEthersRevertError(endErr)) {
          throw new Error(
            `Contract reverted during endElection: ${endErr.revert.args[0]}`,
          );
        } else {
          throw new Error("Failed to conclude election on the blockchain.");
        }
      }
    } else {
      console.log("Election already concluded on-chain.");
    }
    // --- END NEW STEP ---

    // --- Step 3: Fetch Votes from Events (UPDATED WITH CHUNKING) ---
    console.log(
      `Fetching VoteCast events for election contract: ${electionContractAddress}...`,
    );
    const voteCastFilter = electionContract.filters.VoteCast();

    let allVoteEvents: (Log | EventLog)[] = [];
    const alchemyMaxRange = 8;
    const blockChunkSize = alchemyMaxRange;

    try {
      const latestBlock = await provider.getBlockNumber();
      console.log(
        `Scanning blocks from ${startBlock} to ${latestBlock} in chunks of ${blockChunkSize}...`,
      );

      for (
        let fromBlock = startBlock;
        fromBlock <= latestBlock;
        fromBlock += blockChunkSize + 1
      ) {
        const toBlock = Math.min(fromBlock + blockChunkSize, latestBlock);
        console.log(`   Querying blocks ${fromBlock} to ${toBlock}...`);
        const chunkEvents = await electionContract.queryFilter(
          voteCastFilter,
          fromBlock,
          toBlock,
        );
        if (chunkEvents.length > 0) {
          console.log(
            `      Found ${chunkEvents.length} events in this chunk.`,
          );
          allVoteEvents = allVoteEvents.concat(chunkEvents);
        }
        // Add a small delay to avoid hitting rate limits if querying many chunks rapidly
        await sleep(50); // Optional: 50ms delay
      }
    } catch (queryError: unknown) {
      if (queryError instanceof Error) {
        console.error("Error during chunked log query:", queryError);
        throw new Error(
          `Failed to query blockchain logs: ${queryError.message}`,
        );
      }
    }

    const plainTextVotes: { voter: string; vote: string }[] = [];
    if (allVoteEvents.length > 0) {
      console.log(
        `Processing ${allVoteEvents.length} total VoteCast events...`,
      );
      for (const event of allVoteEvents) {
        if (isVoteCastEvent(event)) {
          plainTextVotes.push({
            voter: event.args.voter,
            vote: event.args.vote, // Get the plain text vote
          });
        }
      }
      console.log(`Extracted ${plainTextVotes.length} plain text votes.`);
    } else {
      console.log("No VoteCast events found.");
    }

    // --- Step 4: Tally Votes (Simplified) ---
    console.log("Tallying votes...");
    const tally: { [candidate: string]: number } = {};
    for (const { vote } of plainTextVotes) {
      tally[vote] = (tally[vote] || 0) + 1;
    }
    console.log("Tally complete:", tally);
    const winner = determineWinner(tally);
    console.log("Winner determined:", winner);

    // --- Step 5: Upload Results to IPFS ---
    console.log("Uploading results to IPFS via Pinata...");
    const pinata = new pinataSDK(PINATA_API_KEY, PINATA_SECRET_API_KEY);

    const resultsData = {
      electionTitle: election.title,
      electionContract: electionContractAddress,
      totalVotesRetrieved: plainTextVotes.length,
      tally: tally,
      winner: winner,
      talliedAt: new Date().toISOString(),
    };

    // Explicitly define the type for pinataOptions
    const pinataOptions: PinataPinOptions = {
      pinataMetadata: {
        name: `VeriVote Results - ${election.title.replace(/\s+/g, "-")}`,
      },
      pinataOptions: { cidVersion: 0 },
    };

    const pinResult = await pinata.pinJSONToIPFS(resultsData, pinataOptions);
    const resultsIpfsHash = pinResult.IpfsHash;
    console.log(
      "Successfully pinned results to IPFS. Hash (CID):",
      resultsIpfsHash,
    );

    console.log("Publishing results hash to the Election contract...");

    let publishTxSuccess = false;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `Attempt ${attempt}/${maxRetries} to publish results hash...`,
        );
        const tx =
          await electionContractWithSigner.publishResultsHash(resultsIpfsHash);
        await tx.wait(1); // Wait for 1 confirmation
        console.log("Results hash published on-chain successfully.");
        publishTxSuccess = true;
        if (publishTxSuccess) break; // Exit loop on success
      } catch (error: unknown) {
        console.error(`Attempt ${attempt} failed:`, error);
        if (isEthersRevertError(error)) {
          // If it's a contract revert, retrying won't help
          throw new Error(
            `Contract reverted during publishResultsHash: ${error.revert.args[0]}`,
          );
        }
        if (attempt === maxRetries) {
          // If all retries fail, throw the last error
          throw new Error(
            `Failed to publish results hash after ${maxRetries} attempts.`,
          );
        }
        console.log(`Retrying in ${retryDelay / 1000} seconds...`);
        await sleep(retryDelay); // Wait before retrying
      }
    }
    // --- Step 7: Update Database Status ---
    console.log("Updating election status in MongoDB...");
    await electionsCollection.updateOne(
      { _id: new ObjectId(electionId!) },
      {
        $set: {
          status: "Tallied",
          resultsIpfsHash: resultsIpfsHash,
          winner: winner,
        },
      },
    );
    console.log("MongoDB status updated to Tallied.");

    return NextResponse.json(
      {
        message: "Election tallied successfully!",
        resultsIpfsHash: resultsIpfsHash,
        tally: tally,
        winner: winner,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error during tallying process:", error);
      if (electionId) {
        try {
          await client
            .db()
            .collection("elections")
            .updateOne(
              { _id: new ObjectId(electionId) },
              { $set: { status: "Tally Failed" } },
            );
        } catch (dbError) {
          console.error(
            "Additionally failed to update status to 'Tally Failed' in DB:",
            dbError,
          );
        }
      }
      return NextResponse.json(
        { message: `Tallying failed: ${error.message}` },
        { status: 500 },
      );
    }
  } finally {
    await client.close();
  }
}
