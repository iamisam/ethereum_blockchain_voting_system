"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  REGISTRY_CONTRACT_ADDRESS,
  REGISTRY_CONTRACT_ABI,
} from "@/lib/constants";

// Defines all possible steps in the user's registration journey
type FlowState =
  | "CONNECT_WALLET"
  | "SHOW_FORM"
  | "ENTER_OTP"
  | "CHECKING_STATUS"
  | "NOT_WHITELISTED"
  | "WHITELISTED"
  | "MINTED"
  | "LOADING"
  | "ERROR";

export default function VoterIdManager() {
  const [account, setAccount] = useState<string | null>(null);
  const [state, setState] = useState<FlowState>("CONNECT_WALLET");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Form state for user input
  const [email, setEmail] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [otp, setOtp] = useState("");

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      alert("Please install MetaMask!");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setState("ERROR");
      setErrorMessage("Failed to connect wallet.");
    }
  };

  const getContract = useCallback(
    (signerOrProvider: ethers.Signer | ethers.Provider) => {
      return new ethers.Contract(
        REGISTRY_CONTRACT_ADDRESS,
        REGISTRY_CONTRACT_ABI,
        signerOrProvider,
      );
    },
    [],
  );

  const checkStatus = useCallback(async () => {
    if (!account) return;

    setState("CHECKING_STATUS");
    setLoadingMessage("Checking your status on the blockchain...");
    try {
      // Add a specific check right here to satisfy TypeScript
      if (typeof window.ethereum === "undefined") {
        throw new Error("MetaMask is not installed or not detected.");
      }

      // Use a public provider for read-only calls
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = getContract(provider);

      const hasMinted = await contract.hasMinted(account);
      if (hasMinted) {
        setState("MINTED");
        return;
      }

      const isWhitelisted = await contract.isWhitelisted(account);
      if (isWhitelisted) {
        setState("WHITELISTED");
      } else {
        setState("NOT_WHITELISTED");
      }
    } catch (error) {
      console.error("Error checking status:", error);
      setState("ERROR");
      setErrorMessage("Could not check your on-chain status.");
    } finally {
      setLoadingMessage("");
    }
  }, [account, getContract]);

  useEffect(() => {
    if (account) {
      checkStatus();
    } else {
      setState("CONNECT_WALLET");
    }
  }, [account, checkStatus]);

  // Handles submitting the registration form to our backend
  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("LOADING");
    setLoadingMessage("Sending your details for verification...");
    setErrorMessage("");
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, regNumber, walletAddress: account }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send OTP.");
      }
      setState("ENTER_OTP");
    } catch (error: unknown) {
      setState("SHOW_FORM");
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    } finally {
      setLoadingMessage("");
    }
  };

  // Handles submitting the OTP to our backend for verification and whitelisting
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("LOADING");
    setLoadingMessage("Verifying OTP and whitelisting on-chain...");
    setErrorMessage("");
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, regNumber, walletAddress: account, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "OTP verification failed.");
      }
      // Success! Re-check status on chain to confirm the whitelist transaction
      await checkStatus();
    } catch (error: unknown) {
      setState("ENTER_OTP"); // Go back to OTP screen on failure
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    } finally {
      setLoadingMessage("");
    }
  };

  // Calls the smart contract directly from the frontend to mint the NFT
  const claimVoterId = async () => {
    if (typeof window.ethereum === "undefined" || !account) return;

    console.log(REGISTRY_CONTRACT_ADDRESS);
    setState("LOADING");
    setLoadingMessage("Preparing transaction... Please confirm in MetaMask.");
    setErrorMessage("");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = getContract(signer);

      const tx = await contract.claimVoterId();
      setLoadingMessage(
        "Minting your Voter ID... Waiting for blockchain confirmation.",
      );
      await tx.wait();

      setLoadingMessage("Success! Checking new status...");
      await checkStatus();
    } catch (error: unknown) {
      console.error("Failed to claim Voter ID:", error);
      setState("WHITELISTED"); // Go back to the previous state on failure
      if (error instanceof Error) {
        setErrorMessage("Transaction failed or was rejected.");
      }
    } finally {
      setLoadingMessage("");
    }
  };

  // Dynamically renders the UI based on the current state
  const renderContent = () => {
    switch (state) {
      case "CONNECT_WALLET":
        return (
          <button
            onClick={connectWallet}
            className="px-6 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Connect Wallet to Begin
          </button>
        );

      case "CHECKING_STATUS":
        return <p className="text-gray-300">Checking your status...</p>;

      case "NOT_WHITELISTED":
        return (
          <div>
            <p className="text-yellow-400 mb-4">
              You are not registered. Please verify your student identity to get
              started.
            </p>
            <button
              onClick={() => setState("SHOW_FORM")}
              className="px-6 py-2 font-semibold text-black bg-yellow-400 rounded-lg hover:bg-yellow-500 transition-colors"
            >
              Start Verification
            </button>
          </div>
        );

      case "SHOW_FORM":
        return (
          <form
            onSubmit={handleRegistrationSubmit}
            className="space-y-4 text-left"
          >
            <p className="text-gray-300 text-center pb-2">
              Enter your official student details to begin verification.
            </p>
            <div>
              <label className="text-sm text-gray-400">Student Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.name@vitstudent.ac.in"
                required
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">
                Registration Number
              </label>
              <input
                type="text"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                placeholder="e.g., 23BCE1234"
                required
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full px-6 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Send Verification Code
            </button>
          </form>
        );

      case "ENTER_OTP":
        return (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <p className="text-gray-300">
              An OTP has been sent to <strong>{email}</strong>. Please enter it
              below.
            </p>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit OTP"
              required
              maxLength={6}
              className="w-full p-3 text-center tracking-[0.5em] bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="w-full px-6 py-3 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              Verify & Get Whitelisted
            </button>
            <button
              type="button"
              onClick={() => setState("SHOW_FORM")}
              className="text-sm text-gray-400 hover:underline pt-2"
            >
              Change email/registration number
            </button>
          </form>
        );

      case "WHITELISTED":
        return (
          <div>
            <p className="text-green-400 mb-4">
              You are whitelisted! You can now claim your permanent Voter ID.
            </p>
            <button
              onClick={claimVoterId}
              className="px-8 py-4 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-transform transform hover:scale-105"
            >
              Claim Your Voter ID NFT
            </button>
          </div>
        );
      case "MINTED":
        return (
          <p className="text-2xl text-green-400 font-bold">
            ✅ Voter ID Secured!
          </p>
        );

      case "ERROR":
        return (
          <div>
            <p className="text-red-500 mb-4">{errorMessage}</p>
            <button
              onClick={checkStatus}
              className="px-6 py-2 font-semibold text-white bg-gray-600 rounded-lg hover:bg-gray-700"
            >
              Try Again
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-lg p-8 bg-gray-800 border border-gray-700 rounded-2xl shadow-lg text-center transition-all duration-300">
      <h2 className="text-3xl font-bold mb-4">Voter Registration</h2>
      {account && (
        <div className="mb-6">
          <p className="text-gray-400">Connected as:</p>
          <p className="font-mono text-sm bg-gray-900 p-2 rounded-md break-all">
            {account}
          </p>
        </div>
      )}

      {loadingMessage ? (
        <div className="flex flex-col items-center justify-center min-h-[150px]">
          <svg
            className="animate-spin h-8 w-8 text-white mb-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-lg text-gray-300">{loadingMessage}</p>
        </div>
      ) : (
        <>
          {errorMessage && (
            <p className="text-red-500 mb-4 bg-red-900/50 p-3 rounded-md">
              {errorMessage}
            </p>
          )}
          <div className="min-h-[150px] flex items-center justify-center">
            {renderContent()}
          </div>
        </>
      )}
    </div>
  );
}
