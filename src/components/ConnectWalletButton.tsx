"use client"; // This is a client component, as it uses hooks and event listeners

import { useState, useEffect } from "react";
import { ethers } from "ethers";

export default function ConnectWalletButton() {
  const [account, setAccount] = useState<string | null>(null);

  async function connectWallet() {
    if (typeof window.ethereum !== "undefined") {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        // It will prompt user to connect their wallet
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);
      } catch (error) {
        console.error("Failed to connect wallet:", error);
      }
    } else {
      alert("Please install MetaMask!");
    }
  }

  return (
    <div>
      {account ? (
        <div className="p-3 bg-gray-800 rounded-lg text-white">
          <p className="text-sm font-mono">
            Connected:{" "}
            {`${account.substring(0, 6)}...${account.substring(account.length - 4)}`}
          </p>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          className="px-6 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Connect Wallet
        </button>
      )}
    </div>
  );
}
