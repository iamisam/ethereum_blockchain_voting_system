"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { REGISTRY_CONTRACT_ABI } from "@/lib/constants";
import { useWeb3 } from "@/context/Web3Context";

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

const REGISTRY_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS;

export default function VoterIdManager() {
  const { account, provider, signer, connectWallet } = useWeb3();

  const [state, setState] = useState<FlowState>("CONNECT_WALLET");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [otp, setOtp] = useState("");

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

  // --- THIS FUNCTION IS NOW FIXED AND SMARTER ---
  const checkStatus = useCallback(async () => {
    if (!account) return;

    setState("CHECKING_STATUS");
    setLoadingMessage("Checking your status...");
    setErrorMessage("");

    try {
      // Step 1: Check our own database first. It's faster.
      const dbStatusRes = await fetch("/api/get-user-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: account }),
      });

      if (dbStatusRes.ok) {
        const dbStatus = await dbStatusRes.json();
        if (dbStatus.exists) {
          if (dbStatus.hasMintedNFT) {
            setState("MINTED");
            return;
          }
          if (dbStatus.isWhitelisted) {
            setState("WHITELISTED");
            return;
          }
        }
      }

      // Step 2: If not found in DB or not yet whitelisted, check the blockchain as the source of truth.
      if (!provider) throw new Error("Wallet provider not available.");

      setLoadingMessage("Checking status on the blockchain...");
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
      setErrorMessage(
        "Could not check status. Please ensure your wallet is connected to the Sepolia network and try again.",
      );
    } finally {
      setLoadingMessage("");
    }
  }, [account, provider, getContract]);

  useEffect(() => {
    if (account) {
      checkStatus();
    } else {
      setState("CONNECT_WALLET");
    }
  }, [account, checkStatus]);

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

  // --- THIS FUNCTION IS NOW FIXED ---
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("LOADING");
    setLoadingMessage("Verifying OTP and whitelisting...");
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

      // Optimistically update the UI to the next state
      setState("WHITELISTED");
    } catch (error: unknown) {
      setState("ENTER_OTP");
      if (error instanceof Error) {
        // Show the error message, not set it as the loading message
        setErrorMessage(error.message);
      }
    } finally {
      // This 'finally' block GUARANTEES the loader will stop.
      setLoadingMessage("");
    }
  };

  const claimVoterId = async () => {
    if (!signer || !account) return;

    setState("LOADING");
    setLoadingMessage("Preparing transaction...");
    setErrorMessage("");
    try {
      const contract = getContract(signer);
      const tx = await contract.claimVoterId();

      setLoadingMessage("Minting your Voter ID...");
      await tx.wait();

      setLoadingMessage("Syncing mint status with database...");
      await fetch("/api/confirm-mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: account }),
      });

      await checkStatus();
    } catch (error: unknown) {
      console.error("Failed to claim Voter ID:", error);
      setState("WHITELISTED");
      setErrorMessage("Transaction failed or was rejected.");
    } finally {
      setLoadingMessage("");
    }
  };

  const renderContent = () => {
    // ... (Your renderContent function remains the same as it correctly uses the state variables)
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
              onClick={() => checkStatus()}
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

  if (!REGISTRY_CONTRACT_ADDRESS) {
    return (
      <div className="w-full max-w-lg p-8 bg-red-900/50 border border-red-700 rounded-2xl text-center">
        <h2 className="text-2xl font-bold mb-4">Configuration Error</h2>
        <p className="text-red-200">
          The smart contract address is missing. Please contact the site
          administrator.
        </p>
        <p className="font-mono text-xs mt-4 text-red-300">
          Error: NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS is not set.
        </p>
      </div>
    );
  }

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
