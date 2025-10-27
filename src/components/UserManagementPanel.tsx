"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "@/context/Web3Context";
import { REGISTRY_CONTRACT_ABI } from "@/lib/constants";
import { ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";

const REGISTRY_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS;

export default function UserManagementPanel() {
  const { account, provider } = useWeb3();
  const [contractOwner, setContractOwner] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [targetAddress, setTargetAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const getContract = useCallback(
    (signerOrProvider: ethers.Signer | ethers.Provider) => {
      return new ethers.Contract(
        REGISTRY_CONTRACT_ADDRESS!,
        REGISTRY_CONTRACT_ABI,
        signerOrProvider,
      );
    },
    [],
  );

  useEffect(() => {
    const checkOwnerStatus = async () => {
      if (!provider || !account) {
        setIsAdmin(false);
        return;
      }
      try {
        const contract = getContract(provider);
        const owner = await contract.owner();
        setContractOwner(owner.toLowerCase());
        setIsAdmin(account.toLowerCase() === owner.toLowerCase());
      } catch (error) {
        console.error("Failed to fetch contract owner:", error);
        setIsAdmin(false);
      }
    };

    checkOwnerStatus();
  }, [account, provider, getContract]);

  const handleRevokeAccess = async () => {
    if (!isAdmin) {
      setFeedback({ type: "error", message: "You are not authorized." });
      return;
    }
    if (!ethers.isAddress(targetAddress)) {
      setFeedback({
        type: "error",
        message: "Please enter a valid Ethereum address.",
      });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      // The frontend now calls our secure backend API
      const res = await fetch("/api/revoke-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: targetAddress }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "An unknown error occurred.");
      }

      setFeedback({ type: "success", message: data.message });
    } catch (error: unknown) {
      console.error(`Failed to revoke access via API:`, error);
      if (error instanceof Error) {
        setFeedback({ type: "error", message: `Failed: ${error.message}` });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ... (Conditional rendering for not connected / not admin remains the same)
  if (!REGISTRY_CONTRACT_ADDRESS) {
    return (
      <p className="text-red-500">
        Configuration Error: Contract address is not set.
      </p>
    );
  }
  if (!account) {
    return (
      <div className="text-center p-8 border border-gray-700 rounded-lg">
        <ShieldAlert className="mx-auto h-12 w-12 text-yellow-400" />
        <h3 className="mt-4 text-xl font-bold">Admin Panel</h3>
        <p className="mt-2 text-gray-400">
          Please connect your wallet to continue.
        </p>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="text-center p-8 border border-red-700 bg-red-900/50 rounded-lg">
        <ShieldAlert className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-xl font-bold">Access Denied</h3>
        <p className="mt-2 text-red-300">
          You are not the contract owner. This page is for administrative use
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

  // The Admin UI is now simpler
  return (
    <div className="w-full max-w-2xl p-8 bg-gray-800 border border-gray-700 rounded-2xl shadow-lg">
      <div className="flex items-center mb-6">
        <ShieldCheck className="h-8 w-8 text-green-400 mr-4" />
        <h2 className="text-3xl font-bold">Admin Control Panel</h2>
      </div>
      <p className="text-gray-400 mb-6">
        Enter a user&apos;s wallet address to completely revoke their access.
        This action will burn their Voter ID NFT (if it exists) and remove them
        from the whitelist. This is irreversible.
      </p>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="targetAddress"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            User Wallet Address to Revoke
          </label>
          <input
            type="text"
            id="targetAddress"
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
            placeholder="0x..."
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
            disabled={isLoading}
          />
        </div>

        {/* --- A SINGLE, CLEAR BUTTON --- */}
        <button
          onClick={handleRevokeAccess}
          disabled={isLoading || !targetAddress}
          className="w-full flex items-center justify-center px-6 py-3 font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="h-5 w-5 mr-2" />
          {isLoading ? "Processing Transaction..." : "Revoke User Access"}
        </button>

        {feedback && (
          <div
            className={`mt-4 p-4 rounded-md text-center ${
              feedback.type === "success"
                ? "bg-green-900/50 text-green-300 border border-green-700"
                : "bg-red-900/50 text-red-300 border border-red-700"
            }`}
          >
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  );
}
