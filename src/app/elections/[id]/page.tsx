"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Vote as VoteIcon,
  Info,
  Loader2,
  CalendarDays,
  ExternalLink,
  Clock,
} from "lucide-react";

// Define types for the data we expect
interface ElectionDetails {
  _id: string;
  title: string;
  startTime: string; // ISO Date string
  endTime: string; // ISO Date string
  electionContractAddress: string;
  metadataIpfsHash: string;
  publicKey: string;
  status: string;
}

interface ElectionMetadata {
  name: string;
  description: string;
  attributes: {
    trait_type: string;
    value: string[];
  }[];
}

export default function ElectionDetailPage() {
  const params = useParams();
  const electionId = params.id as string;

  const [electionDetails, setElectionDetails] =
    useState<ElectionDetails | null>(null);
  const [metadata, setMetadata] = useState<ElectionMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!electionId) return;

    const fetchElectionData = async () => {
      setIsLoading(true);
      setError(null);
      setElectionDetails(null);
      setMetadata(null);

      try {
        const apiRes = await fetch(`/api/get-election-details/${electionId}`);
        if (!apiRes.ok) {
          const errorData = await apiRes.json();
          throw new Error(
            errorData.message ||
              `Failed to fetch election details (${apiRes.status})`,
          );
        }
        const details: ElectionDetails = await apiRes.json();
        setElectionDetails(details);

        if (details.metadataIpfsHash) {
          const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${details.metadataIpfsHash}`;
          console.log("Fetching metadata from IPFS:", ipfsUrl);
          const ipfsRes = await fetch(ipfsUrl);
          if (!ipfsRes.ok) {
            throw new Error(
              `Failed to fetch metadata from IPFS (${ipfsRes.status})`,
            );
          }
          const ipfsData: ElectionMetadata = await ipfsRes.json();
          setMetadata(ipfsData);
        } else {
          throw new Error("Metadata hash missing for this election.");
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.error("Error fetching election data:", err);
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchElectionData();
  }, [electionId]);

  const candidates =
    metadata?.attributes.find((attr) => attr.trait_type === "Candidates")
      ?.value || [];

  const getCalculatedStatus = (
    start: string,
    end: string,
  ): { text: string; color: string; isActive: boolean } => {
    const now = new Date();
    const startTime = new Date(start);
    const endTime = new Date(end);

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

  // --- Placeholder for Voting Logic ---
  const handleVote = () => {
    alert("Voting functionality not yet implemented!");
  };
  // --- End Placeholder ---

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

  return (
    <div className="container mx-auto px-6 py-16 md:py-24">
      <div className="max-w-3xl mx-auto bg-gray-800 border border-gray-700 rounded-2xl shadow-lg p-8">
        {/* Header Section */}
        <h1 className="text-4xl font-bold mb-4">
          {metadata.name || electionDetails.title}
        </h1>

        {/* --- IMPROVED Status & Time Info --- */}
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
        {/* --- END IMPROVED Status & Time --- */}

        {/* Description */}
        <p className="text-gray-300 mb-8">{metadata.description}</p>

        {/* Candidates Section */}
        <div className="mb-12">
          {" "}
          {/* Increased margin-bottom here */}
          <h2 className="text-2xl font-semibold mb-6 border-b border-gray-600 pb-2">
            Candidates
          </h2>
          {Array.isArray(candidates) && candidates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {candidates.map((candidate, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-700 rounded-lg flex items-center justify-between shadow-sm border border-gray-600 hover:border-blue-500 transition-all cursor-pointer"
                >
                  <span className="text-lg font-medium text-gray-100">
                    {candidate}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">No candidates listed.</p>
          )}
        </div>

        {/* Vote Button Area */}
        <div className="text-center border-t mb-8 border-gray-600 pt-8">
          {" "}
          {/* Increased padding-top */}
          <button
            onClick={handleVote}
            className="inline-flex mt-4 items-center justify-center px-8 py-4 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-all shadow-lg hover:shadow-green-500/50 text-lg disabled:bg-gray-600 disabled:cursor-not-allowed disabled:shadow-none"
            disabled={!currentStatus.isActive}
          >
            <VoteIcon className="mr-2 h-6 w-6" />
            {currentStatus.isActive ? "Cast Vote" : "Voting Ended"}
          </button>
        </div>

        {/* Contract Link (Moved below button area) */}
        <div className="text-center mt-8 mb-2 pt-4 border-t border-gray-700">
          {" "}
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
