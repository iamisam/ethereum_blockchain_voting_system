"use client";

import { useWeb3 } from "@/context/Web3Context";

export default function ConnectWalletButton() {
  const { account, connectWallet, disconnectWallet } = useWeb3();

  return (
    <div className="flex items-center space-x-2">
      {account ? (
        <>
          <div className="p-3 bg-gray-800 rounded-lg text-white border border-gray-700">
            <p className="text-sm font-mono">
              {`${account.substring(0, 6)}...${account.substring(account.length - 4)}`}
            </p>
          </div>
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
