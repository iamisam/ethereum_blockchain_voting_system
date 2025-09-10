"use client";

import { useWeb3 } from "@/context/Web3Context";
import { useState } from "react";
import { Clipboard, Check } from "lucide-react";

export default function ConnectWalletButton() {
  const { account, connectWallet, disconnectWallet } = useWeb3();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyAddress = () => {
    if (!account) return;

    const textArea = document.createElement("textarea");
    textArea.value = account;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 500);
    } catch (err) {
      console.error("Failed to copy address : ", err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="flex items-center space-x-2">
      {account ? (
        <>
          <button
            onClick={handleCopyAddress}
            className="flex items-center p-3 bg-gray-800 rounded-lg text-white border border-gray-700 hover:bg-gray-700 transition-colors group"
            title="Copy address to clipboard"
          >
            <p className="text-sm font-mono mr-3">
              {`${account.substring(0, 6)}...${account.substring(account.length - 4)}`}
            </p>
            {isCopied ? (
              <div className="flex items-center text-green-400">
                <Check size={16} className="mr-1" />
                <span className="text-xs">Copied!</span>
              </div>
            ) : (
              <Clipboard
                size={16}
                className="text-gray-400 group-hover:text-white transition-colors"
              />
            )}
          </button>
          <button
            onClick={disconnectWallet}
            className="px-4 py-3 font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            title="Disconnect Wallet"
          >
            Disconnect
          </button>
        </>
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
