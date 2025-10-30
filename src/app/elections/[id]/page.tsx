"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ethers } from "ethers";
import { useWeb3 } from "@/context/Web3Context";
import {
  Vote as VoteIcon,
  Info,
  Loader2,
  CalendarDays,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileCheck,
  UserCheck,
  UserX,
  Trophy,
} from "lucide-react";
import ElectionABI from "@/lib/ElectionABI.json";
import { REGISTRY_CONTRACT_ABI } from "@/lib/constants";
const REGISTRY_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS;

interface ElectionDetails {
  _id: string;
  title: string;
  startTime: string;
  endTime: string;
  electionContractAddress: string;
  metadataIpfsHash: string;
  status: string;
  resultsIpfsHash?: string | null;
  winner?: string | null;
}
interface ElectionMetadata {
  name: string;
  description: string;
  attributes: { trait_type: string; value: string[] }[];
}

export default function ElectionDetailPage() {
  // --- Hooks ---
  const params = useParams();
  const electionId = params.id as string;
  const { account, signer, provider } = useWeb3();

  const [electionDetails, setElectionDetails] =
    useState<ElectionDetails | null>(null);
  const [metadata, setMetadata] = useState<ElectionMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(
    null,
  );
  const [isVoting, setIsVoting] = useState(false); // State for voting transaction loading
  const [voteFeedback, setVoteFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null); // State for vote feedback
  const [hasAlreadyVoted, setHasAlreadyVoted] = useState<boolean | null>(null); // State to track if user voted
  const [hasValidNFT, setHasValidNFT] = useState<boolean | null>(null); // Still need to fetch this

  const [isAdmin, setIsAdmin] = useState(false);
  const [isTallying, setIsTallying] = useState(false);
  const [tallyFeedback, setTallyFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Data Fetching Effect
  useEffect(() => {
    if (!electionId) return;
    const fetchElectionData = async () => {
      setIsLoading(true);
      setError(null);
      setElectionDetails(null);
      setMetadata(null);
      setHasAlreadyVoted(null);
      try {
        const apiRes = await fetch(`/api/get-election-details/${electionId}`);
        if (!apiRes.ok)
          throw new Error((await apiRes.json()).message || "Failed fetch");
        const responseData = await apiRes.json();
        const details: ElectionDetails = JSON.parse(responseData.data);
        setElectionDetails(details);
        if (details.metadataIpfsHash) {
          const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${details.metadataIpfsHash}`;
          const ipfsRes = await fetch(ipfsUrl);
          if (!ipfsRes.ok) throw new Error("Failed IPFS fetch");
          const ipfsData: ElectionMetadata = await ipfsRes.json();
          setMetadata(ipfsData);
        } else throw new Error("Metadata hash missing.");
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchElectionData();
  }, [electionId]);

  // Effect to Check Voting Status
  useEffect(() => {
    const checkVotingStatus = async () => {
      if (
        !account ||
        !provider ||
        !electionDetails ||
        !electionDetails.electionContractAddress
      ) {
        setHasAlreadyVoted(null); // Reset if account or contract info is missing
        return;
      }
      try {
        const electionContract = new ethers.Contract(
          electionDetails.electionContractAddress,
          ElectionABI,
          provider,
        );
        const voted = await electionContract.hasVoted(account);
        setHasAlreadyVoted(voted);
      } catch (err) {
        console.error("Failed to check voting status:", err);
        setHasAlreadyVoted(null); // Indicate uncertainty on error
      }
    };

    checkVotingStatus();
  }, [account, provider, electionDetails]); // Re-check when account or election details load

  useEffect(() => {
    const checkOwnerStatus = async () => {
      if (!provider || !account || !REGISTRY_CONTRACT_ADDRESS) {
        setIsAdmin(false);
        return;
      }
      try {
        const contract = new ethers.Contract(
          REGISTRY_CONTRACT_ADDRESS,
          REGISTRY_CONTRACT_ABI,
          provider,
        );
        const owner = await contract.owner();
        setIsAdmin(account.toLowerCase() === owner.toLowerCase());
      } catch (error) {
        console.error("Failed admin check on detail page:", error);
        setIsAdmin(false);
      }
    };
    checkOwnerStatus();
  }, [account, provider]);

  useEffect(() => {
    const checkNFTStatus = async () => {
      // Guard clause: Exit if essential data isn't ready
      if (!account || !provider || !REGISTRY_CONTRACT_ADDRESS) {
        setHasValidNFT(false); // Assume invalid if we can't check
        return;
      }
      try {
        // Create a read-only instance of the GlobalRegistry contract
        const registryContract = new ethers.Contract(
          REGISTRY_CONTRACT_ADDRESS,
          REGISTRY_CONTRACT_ABI,
          provider,
        );
        // Call the hasMinted function (secure check due to SBT nature)
        const valid = await registryContract.hasMinted(account);
        setHasValidNFT(valid); // Update state with the result
      } catch (err) {
        console.error("Failed to check Voter ID NFT status:", err);
        setHasValidNFT(false); // Assume invalid on any error during check
      } finally {
      }
    };

    checkNFTStatus();
  }, [account, provider]);

  const candidates =
    metadata?.attributes?.find((attr) => attr.trait_type === "Candidates")
      ?.value || [];

  const getCalculatedStatus = (
    start: string | Date,
    end: string | Date,
  ): { text: string; color: string; isActive: boolean } => {
    const now = new Date();
    // Ensure start/end are Date objects for comparison
    const startTime = typeof start === "string" ? new Date(start) : start;
    const endTime = typeof end === "string" ? new Date(end) : end;

    if (now < startTime)
      return { text: "Upcoming", color: "text-blue-400", isActive: false };
    if (now >= startTime && now < endTime)
      return {
        text: "Active",
        color: "text-green-400 animate-pulse",
        isActive: true,
      };
    if (now >= endTime)
      return { text: "Ended", color: "text-yellow-400", isActive: false };
    return { text: "Unknown", color: "text-gray-400", isActive: false };
  };

  const currentStatus = electionDetails
    ? getCalculatedStatus(electionDetails.startTime, electionDetails.endTime)
    : { text: "Loading...", color: "text-gray-400", isActive: false };

  // --- CORE VOTING LOGIC ---
  const handleVote = async () => {
    if (
      !signer ||
      !account ||
      !metadata ||
      !electionDetails ||
      !selectedCandidate ||
      !currentStatus.isActive ||
      hasAlreadyVoted
    ) {
      setVoteFeedback({
        type: "error",
        message:
          "Cannot vote. Check connection, selection, election status, and if you already voted.",
      });
      return;
    }

    setIsVoting(true);
    setVoteFeedback(null);
    setError(null); // Clear previous page-level errors

    if (!signer || !account) {
      setVoteFeedback({
        type: "error",
        message: "Wallet not connected. Please connect your wallet.",
      });
      setIsVoting(false);
      return;
    }
    if (!electionDetails || !metadata) {
      setVoteFeedback({
        type: "error",
        message: "Election data not loaded correctly.",
      });
      setIsVoting(false);
      return;
    }
    if (!currentStatus.isActive) {
      setVoteFeedback({
        type: "error",
        message: "This election is not currently active.",
      });
      setIsVoting(false);
      return;
    }
    if (!selectedCandidate) {
      setVoteFeedback({
        type: "error",
        message: "Please select a candidate before casting your vote.",
      });
      setIsVoting(false);
      return;
    }
    // Explicitly check NFT and Voted status here
    if (hasValidNFT !== true) {
      setVoteFeedback({
        type: "error",
        message: "You do not hold a valid Voter ID NFT for this account.",
      });
      setIsVoting(false);
      return;
    }
    if (hasAlreadyVoted !== false) {
      // Handle both null (still checking) and true (already voted)
      setVoteFeedback({
        type: "error",
        message:
          hasAlreadyVoted === true
            ? "You have already voted in this election."
            : "Could not confirm voting status. Please wait or refresh.",
      });
      setIsVoting(false);
      return;
    }

    try {
      // 2. Prepare Contract Interaction
      const electionContract = new ethers.Contract(
        electionDetails.electionContractAddress,
        ElectionABI,
        signer,
      );

      // 3. Send Transaction
      console.log("Submitting vote transaction...");
      const tx = await electionContract.submitVote(selectedCandidate);
      console.log("Transaction sent:", tx.hash);
      setVoteFeedback({
        type: "success",
        message: `Vote transaction sent (${tx.hash.substring(0, 10)}...). Waiting for confirmation...`,
      });

      await tx.wait(); // Wait for the transaction to be mined

      console.log("Vote confirmed!");
      setVoteFeedback({
        type: "success",
        message:
          "Your vote has been successfully cast and recorded on the blockchain!",
      });
      setHasAlreadyVoted(true); // Update UI immediately
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Voting failed:", error);
        const reason = error.message || "An unknown error occurred.";
        setVoteFeedback({ type: "error", message: `Voting failed: ${reason}` });
      }
    } finally {
      setIsVoting(false);
    }
  };

  const handleTally = async () => {
    if (!electionId || !isAdmin) return;

    setIsTallying(true);
    setTallyFeedback(null);
    setError(null); // Clear page-level errors

    try {
      const res = await fetch("/api/tally-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: electionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Tally failed");
      setTallyFeedback({
        type: "success",
        message: data.message || "Tally successful!",
      });
      // Optionally: Re-fetch election details to update status display immediately
      // await fetchElectionData(); // You'd need to extract fetchElectionData
    } catch (error: unknown) {
      if (error instanceof Error) {
        setTallyFeedback({ type: "error", message: `Error: ${error.message}` });
      }
    } finally {
      setIsTallying(false);
    }
  };

  // Loading, Error states
  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-16 md:py-24 text-center">
        <Loader2 className="animate-spin h-12 w-12 text-blue-400 mx-auto mb-4" />
        <p className="text-gray-400">Loading Election Details...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="container mx-auto px-6 py-16 md:py-24 text-center">
        <div className="max-w-xl mx-auto p-6 bg-red-900/50 border border-red-700 rounded-lg">
          <h2 className="text-xl font-semibold text-red-300 mb-2">
            Error Loading Election
          </h2>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }
  if (!electionDetails || !metadata) {
    return (
      <div className="container mx-auto px-6 py-16 md:py-24 text-center text-gray-500">
        Election data not available.
      </div>
    );
  }

  const resultsAvailable =
    electionDetails.status === "Tallied" && !!electionDetails?.resultsIpfsHash;

  // --- MAIN RENDER ---
  // Since we passed the checks (isLoading, error, !electionDetails || !metadata) before this,
  // we know electionDetails and metadata are guaranteed non-null here.
  return (
    <div className="container mx-auto px-6 py-16 md:py-24">
      <div className="max-w-3xl mx-auto bg-gray-800 border border-gray-700 rounded-2xl shadow-lg p-8">
        {/* Header Section */}
        <h1 className="text-4xl font-bold mb-4">
          {metadata.name || electionDetails.title}
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-center sm:text-left p-4 bg-gray-700/50 rounded-lg border border-gray-600">
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wider">
              Status
            </span>
            <p className={`text-lg font-semibold ${currentStatus.color}`}>
              {currentStatus.text}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wider flex items-center justify-center sm:justify-start">
              <CalendarDays size={14} className="mr-1.5" /> Starts
            </span>
            <p className="text-lg font-medium">
              {new Date(electionDetails.startTime).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wider flex items-center justify-center sm:justify-start">
              <Clock size={14} className="mr-1.5" /> Ends
            </span>
            <p className="text-lg font-medium">
              {new Date(electionDetails.endTime).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-300 mb-8">{metadata.description}</p>

        {/* --- Conditionally Render Candidates or Results --- */}
        {resultsAvailable ? (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-5 border-b border-gray-600 pb-2">
              Election Results
            </h2>
            {/* Accessing resultsIpfsHash is now safe */}
            {electionDetails.winner && (
              <div className="text-center p-6 bg-yellow-900/50 border border-yellow-700 rounded-lg mb-6">
                <Trophy className="mx-auto h-12 w-12 text-yellow-400" />
                <h3 className="mt-4 text-lg font-semibold text-gray-200">
                  Winner
                </h3>
                <p className="text-3xl font-bold text-white mt-1">
                  {electionDetails.winner}
                </p>
              </div>
            )}
            <p className="text-gray-400 italic">
              Full tally results are stored permanently on IPFS.
            </p>
            {electionDetails.resultsIpfsHash && (
              <a
                href={`https://gateway.pinata.cloud/ipfs/${electionDetails.resultsIpfsHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline text-sm mt-2 block"
              >
                View Raw Results on IPFS
              </a>
            )}
          </div>
        ) : (
          <div className="mb-12">
            {" "}
            {/* Increased margin */}
            <h2 className="text-2xl font-semibold mb-5 border-b border-gray-600 pb-2">
              Select a Candidate
            </h2>
            {Array.isArray(candidates) && candidates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {candidates.map((candidate, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedCandidate(candidate)}
                    className={`w-full p-4 bg-gray-700 rounded-lg text-left shadow-sm border transition-all duration-150
                          ${
                            selectedCandidate === candidate
                              ? "border-blue-500 ring-2 ring-blue-500/50" // Selected style
                              : "border-gray-600 hover:border-blue-600" // Default style
                          }
                          ${!currentStatus.isActive ? "cursor-not-allowed opacity-70" : "hover:border-blue-500"}
                        `}
                    disabled={
                      !currentStatus.isActive || // Only disable based on election status
                      isVoting
                    }
                  >
                    <span
                      className={`text-lg font-medium ${selectedCandidate === candidate ? "text-blue-100" : "text-gray-100"}`}
                    >
                      {candidate}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No candidates listed.</p>
            )}
          </div>
        )}
        {/* --- END Conditional Rendering --- */}

        {/* --- Voting / Tallying Action Area --- */}
        <div className="text-center border-t border-gray-600 pt-8">
          {" "}
          {/* Increased padding */}
          {/* Display Vote Feedback (if any) */}
          {voteFeedback && (
            <div
              className={`mb-6 p-4 rounded-md text-center text-sm ${
                voteFeedback.type === "success"
                  ? "bg-green-900/50 text-green-300 border border-green-700"
                  : "bg-red-900/50 text-red-300 border border-red-700"
              }`}
            >
              {voteFeedback.type === "success" ? (
                <CheckCircle className="inline mr-2" size={18} />
              ) : (
                <XCircle className="inline mr-2" size={18} />
              )}
              {voteFeedback.message}
            </div>
          )}
          {/* Display Already Voted Message */}
          {hasAlreadyVoted === true &&
            !voteFeedback &&
            !resultsAvailable && ( // Added !resultsAvailable
              <div className="mb-6 p-4 rounded-md text-center text-sm bg-blue-900/50 text-blue-300 border border-blue-700">
                <CheckCircle className="inline mr-2" size={18} /> You have
                already voted in this election.
              </div>
            )}
          {/* Display Tally Feedback (if any) */}
          {tallyFeedback && (
            <div
              className={`mb-6 p-4 rounded-md text-center text-sm ${
                tallyFeedback.type === "success"
                  ? "bg-green-900/50 text-green-300 border border-green-700"
                  : tallyFeedback.type === "error"
                    ? "bg-red-900/50 text-red-300 border border-red-700"
                    : "" // Should ideally not happen if loading state handled by button
              }`}
            >
              {tallyFeedback.type === "success" ? (
                <CheckCircle className="inline mr-2" size={18} />
              ) : tallyFeedback.type === "error" ? (
                <XCircle className="inline mr-2" size={18} />
              ) : null}
              {tallyFeedback.message}
            </div>
          )}
          {/* --- Conditional Button Logic --- */}
          {/* Show Tally Button if Admin, Ended, and Not Tallied */}
          {isAdmin &&
            currentStatus.text === "Ended" &&
            electionDetails.status !== "Tallied" && (
              <button
                onClick={handleTally}
                disabled={isTallying}
                className="inline-flex items-center justify-center px-8 py-4 font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-all shadow-lg hover:shadow-purple-500/50 text-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                <FileCheck className="mr-2 h-6 w-6" />
                {isTallying ? "Tallying..." : "Tally Results"}
              </button>
            )}
          {/* Show Vote Button if Active and Not Admin (and results not available) */}
          {!isAdmin && currentStatus.isActive && !resultsAvailable && (
            <button
              onClick={handleVote}
              className="inline-flex items-center justify-center px-8 py-4 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-all shadow-lg hover:shadow-green-500/50 text-lg disabled:bg-gray-600 disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-50"
              disabled={
                isVoting || !selectedCandidate // Only disable if voting or no selection
              }
            >
              {isVoting ? (
                <Loader2 className="animate-spin mr-2 h-6 w-6" />
              ) : (
                <VoteIcon className="mr-2 h-6 w-6" />
              )}
              {isVoting ? "Submitting..." : "Cast Vote"}
            </button>
          )}
          {/* Show "Voting Ended" Button if Ended and Not Tallied (for non-admins) */}
          {!isAdmin &&
            currentStatus.text === "Ended" &&
            electionDetails.status !== "Tallied" && (
              <button
                className="inline-flex items-center justify-center px-8 py-4 font-bold text-white bg-gray-600 rounded-lg cursor-not-allowed opacity-50 text-lg"
                disabled={true}
              >
                <VoteIcon className="mr-2 h-6 w-6" /> Voting Ended
              </button>
            )}
          {/* --- Messages --- */}
          {/* Show message if Upcoming */}
          {currentStatus.text === "Upcoming" && (
            <p className="text-sm text-blue-400 mt-4">
              {" "}
              {/* Increased margin */}
              <Info size={14} className="inline mr-1" />
              Voting is not yet open for this election.
            </p>
          )}
          {/* Show message if Ended and Tallied (Results Ready) */}
          {resultsAvailable && (
            <p className="text-sm text-green-400 mt-4">
              {" "}
              {/* Increased margin */}
              <CheckCircle size={14} className="inline mr-1" />
              Election results have been tallied. See results section above.
            </p>
          )}
          {/* Show message if wallet not connected */}
          {!account && (
            <p className="text-sm text-yellow-400 mt-4">
              {" "}
              {/* Increased margin */}
              <AlertTriangle size={14} className="inline mr-1" />
              Please connect your wallet to participate.
            </p>
          )}
          {/* Message to select candidate if eligible but hasn't selected */}
          {!isAdmin &&
            currentStatus.isActive &&
            !resultsAvailable &&
            !selectedCandidate &&
            !isVoting &&
            hasAlreadyVoted !== true && (
              <p className="text-sm text-blue-400 mt-4">
                Please select a candidate above before casting your vote.
              </p>
            )}
        </div>
        {/* --- END Action Area --- */}

        {/* Contract Link */}
        <div className="text-center mt-8 pt-4 border-t border-gray-700">
          <a
            href={`https://sepolia.etherscan.io/address/${electionDetails.electionContractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs text-blue-400 hover:underline font-mono"
          >
            View Election Contract <ExternalLink size={12} className="ml-1.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
