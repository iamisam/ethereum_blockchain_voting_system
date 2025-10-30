import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { ethers, ContractFactory } from "ethers";
import pinataSDK, { PinataPinOptions } from "@pinata/sdk";
import { REGISTRY_CONTRACT_ABI } from "@/lib/constants";
import ElectionABI from "@/lib/ElectionABI.json";
import ElectionBytecode from "@/lib/ElectionBytecode.json";

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
      "Missing critical server environment variables for create-election.",
    );
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 500 },
    );
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const authorized = await isAdmin(
    provider,
    OWNER_PRIVATE_KEY,
    REGISTRY_CONTRACT_ADDRESS,
  );
  if (!authorized) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
  }

  // --- Input Validation ---
  let electionData;
  try {
    electionData = await request.json();
    if (
      !electionData.title ||
      !Array.isArray(electionData.candidates) ||
      !electionData.startTime ||
      !electionData.endTime
    )
      throw new Error("Missing required fields.");
    if (new Date(electionData.startTime) >= new Date(electionData.endTime))
      throw new Error("Start must be before end.");
    electionData.startTimeUnix = Math.floor(
      new Date(electionData.startTime).getTime() / 1000,
    );
    electionData.endTimeUnix = Math.floor(
      new Date(electionData.endTime).getTime() / 1000,
    );
    if (electionData.startTimeUnix < Math.floor(Date.now() / 1000))
      throw new Error("Start time cannot be in the past.");
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

    // --- Step 2: Upload Metadata to IPFS using Pinata ---
    console.log("Uploading election metadata to IPFS via Pinata...");
    const pinata = new pinataSDK(PINATA_API_KEY, PINATA_SECRET_API_KEY);

    const metadata = {
      name: `VeriVote Election: ${electionData.title}`, // Standard NFT metadata field
      description: "Election details for VeriVote platform",
      attributes: [
        // Using attributes for structured data
        { trait_type: "Title", value: electionData.title },
        { trait_type: "Candidates", value: electionData.candidates },
        { trait_type: "StartTime", value: electionData.startTime }, // ISO String
        { trait_type: "EndTime", value: electionData.endTime }, // ISO String
      ],
    };

    const pinataOptions: PinataPinOptions = {
      pinataMetadata: {
        name: `VeriVote Election JSON - ${electionData.title.replace(/\s+/g, "-")}`,
      },
      pinataOptions: {
        cidVersion: 0, // Now TypeScript knows this 0 is the correct type
      },
    };

    const pinResult = await pinata.pinJSONToIPFS(metadata, pinataOptions);
    const metadataIpfsHash = pinResult.IpfsHash; // This is the CID (hash)
    console.log(
      "Successfully pinned metadata to IPFS. Hash (CID):",
      metadataIpfsHash,
    );
    // You can view the uploaded file at: https://gateway.pinata.cloud/ipfs/<metadataIpfsHash>
    // --- End of IPFS Upload ---

    // --- Step 3: Deploy Election Contract (remains the same, uses new hash) ---
    const adminWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    const ElectionFactory = new ContractFactory(
      ElectionABI,
      ElectionBytecode.bytecode,
      adminWallet,
    );

    console.log("Deploying Election contract...");
    const electionContract = await ElectionFactory.deploy(
      REGISTRY_CONTRACT_ADDRESS,
      electionData.startTimeUnix,
      electionData.endTimeUnix,
      metadataIpfsHash, // Use the REAL hash now
    );

    // Wait for the deployment transaction itself to be mined and get the receipt
    const deployTxReceipt = await electionContract
      .deploymentTransaction()
      ?.wait(1); // Wait for 1 confirmation
    if (!deployTxReceipt) {
      throw new Error("Failed to get deployment transaction receipt.");
    }
    const deploymentBlockNumber = deployTxReceipt.blockNumber;
    const electionContractAddress = await electionContract.getAddress();
    console.log(
      `Election contract deployed at: ${electionContractAddress} in block ${deploymentBlockNumber}`,
    );

    // --- Step 4: Store Election Details in DB (remains the same, uses new hash) ---
    const newElection = {
      title: electionData.title,
      candidates: electionData.candidates,
      startTime: new Date(electionData.startTime),
      endTime: new Date(electionData.endTime),
      electionContractAddress: electionContractAddress,
      metadataIpfsHash: metadataIpfsHash, // Use the REAL hash
      deploymentBlockNumber: deploymentBlockNumber, // Store the block number
      status: "Created",
      createdAt: new Date(),
    };
    const insertResult = await electionsCollection.insertOne(newElection);
    console.log("Election details saved to MongoDB.");

    return NextResponse.json(
      {
        message: "Election created and metadata pinned!",
        electionId: insertResult.insertedId,
        contractAddress: electionContractAddress,
        ipfsHash: metadataIpfsHash,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Error creating election:", error);
    if (error instanceof Error) {
      if (error.message && error.message.includes("Pinata")) {
        return NextResponse.json(
          { message: `IPFS Upload Error: ${error.message}` },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { message: `An internal server error occurred: ${error.message}` },
        { status: 500 },
      );
    }
  } finally {
    await client.close();
  }
}
