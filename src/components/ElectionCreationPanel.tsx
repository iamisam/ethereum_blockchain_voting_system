"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "@/context/Web3Context";
import { REGISTRY_CONTRACT_ABI } from "@/lib/constants";
import { ShieldAlert, PlusCircle, Trash2 } from "lucide-react";

const REGISTRY_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS;

export default function ElectionCreationPanel() {
  const { account, provider } = useWeb3();
  const [isAdmin, setIsAdmin] = useState(false);
  const [contractOwner, setContractOwner] = useState<string | null>(null);

  const [electionTitle, setElectionTitle] = useState("");
  const [candidates, setCandidates] = useState<string[]>([""]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Effect to check if the connected user is the admin
  useEffect(() => {
    const checkOwnerStatus = async () => {
      if (!provider || !account) {
        setIsAdmin(false);
        return;
      }
      try {
        const contract = new ethers.Contract(
          REGISTRY_CONTRACT_ADDRESS!,
          REGISTRY_CONTRACT_ABI,
          provider,
        );
        const owner = await contract.owner();
        setContractOwner(owner.toLowerCase());
        setIsAdmin(account.toLowerCase() === owner.toLowerCase());
      } catch (error) {
        console.error("Failed to fetch contract owner:", error);
        setIsAdmin(false);
      }
    };
    checkOwnerStatus();
  }, [account, provider]);

  const handleCandidateChange = (index: number, value: string) => {
    const newCandidates = [...candidates];
    newCandidates[index] = value;
    setCandidates(newCandidates);
  };

  const addCandidateField = () => {
    setCandidates([...candidates, ""]);
  };

  const removeCandidateField = (index: number) => {
    if (candidates.length <= 1) return;
    const newCandidates = candidates.filter((_, i) => i !== index);
    setCandidates(newCandidates);
  };

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setFeedback({ type: "error", message: "You are not authorized." });
      return;
    }

    const finalCandidates = candidates
      .map((c) => c.trim())
      .filter((c) => c !== "");

    if (
      !electionTitle ||
      finalCandidates.length < 2 ||
      !startTime ||
      !endTime
    ) {
      setFeedback({
        type: "error",
        message: "Please fill all fields and provide at least two candidates.",
      });
      return;
    }
    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);
    if (startDateTime >= endDateTime) {
      setFeedback({
        type: "error",
        message: "End time must be after start time.",
      });
      return;
    }
    if (startDateTime <= new Date()) {
      setFeedback({
        type: "error",
        message: "Start time cannot be in the past.",
      });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const electionData = {
        title: electionTitle,
        candidates: finalCandidates,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      };

      const res = await fetch("/api/create-election", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(electionData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create election.");
      }

      setFeedback({
        type: "success",
        message: `Election created! Contract: ${data.contractAddress}`,
      });
      setElectionTitle("");
      setCandidates([""]);
      setStartTime("");
      setEndTime("");
    } catch (error: unknown) {
      console.error("Failed to create election:", error);
      if (error instanceof Error) {
        setFeedback({ type: "error", message: `Error: ${error.message}` });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Conditional Rendering Logic
  if (!REGISTRY_CONTRACT_ADDRESS) {
    return (
      <p className="text-red-500">
        Configuration Error: Contract address is not set.
      </p>
    );
  }
  if (!account) {
    return (
      <div className="text-center p-8 border border-gray-700 rounded-lg max-w-2xl mx-auto">
        <ShieldAlert className="mx-auto h-12 w-12 text-yellow-400" />
        <h3 className="mt-4 text-xl font-bold">Create Election</h3>
        <p className="mt-2 text-gray-400">
          Please connect your wallet to continue.
        </p>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="text-center p-8 border border-red-700 bg-red-900/50 rounded-lg max-w-2xl mx-auto">
        <ShieldAlert className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-xl font-bold">Access Denied</h3>
        <p className="mt-2 text-red-300">
          You are not the contract owner. This section is for administrative use
          only.
        </p>
        <p className="mt-4 text-xs font-mono text-gray-400">
          Connected: {account}
        </p>
        <p className="text-xs font-mono text-gray-400">
          Owner: {contractOwner || "Loading..."}
        </p>
      </div>
    );
  }

  // Admin UI for Creating Elections
  return (
    <div className="w-full max-w-2xl p-8 bg-gray-800 border border-gray-700 rounded-2xl shadow-lg">
      <div className="flex items-center mb-6">
        <PlusCircle className="h-8 w-8 text-blue-400 mr-4" />
        <h2 className="text-3xl font-bold">Create New Election</h2>
      </div>
      <p className="text-gray-400 mb-6">
        Define the details for a new election. This will generate keys, deploy a
        new smart contract, and save the information.
      </p>

      <form onSubmit={handleCreateElection} className="space-y-6">
        <div>
          <label
            htmlFor="electionTitle"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Election Title
          </label>
          <input
            type="text"
            id="electionTitle"
            value={electionTitle}
            onChange={(e) => setElectionTitle(e.target.value)}
            placeholder="e.g., Student Body President 2025"
            required
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Candidates
          </label>
          {candidates.map((candidate, index) => (
            <div key={index} className="flex items-center space-x-2 mb-2">
              <input
                type="text"
                value={candidate}
                onChange={(e) => handleCandidateChange(index, e.target.value)}
                placeholder={`Candidate ${index + 1} Name`}
                required={index < 2}
                className="flex-grow p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                disabled={isLoading}
              />
              {candidates.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCandidateField(index)}
                  className="p-2 text-red-400 hover:text-red-300 disabled:text-gray-500"
                  disabled={isLoading}
                  title="Remove Candidate"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addCandidateField}
            className="mt-2 text-sm text-blue-400 hover:text-blue-300 flex items-center"
            disabled={isLoading}
          >
            <PlusCircle size={16} className="mr-1" /> Add Candidate
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="startTime"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Start Time
            </label>
            <input
              type="datetime-local"
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-300"
              disabled={isLoading}
            />
          </div>
          <div>
            <label
              htmlFor="endTime"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              End Time
            </label>
            <input
              type="datetime-local"
              id="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-300"
              disabled={isLoading}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center px-6 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          {isLoading ? "Creating Election..." : "Create Election"}
        </button>
        {feedback && (
          <div
            className={`mt-4 p-4 rounded-md text-center ${feedback.type === "success" ? "bg-green-900/50 text-green-300 border border-green-700" : "bg-red-900/50 text-red-300 border border-red-700"}`}
          >
            {feedback.message}
          </div>
        )}
      </form>
    </div>
  );
}
