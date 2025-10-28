"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Vote, ShieldCheck, ListChecks } from "lucide-react";
import { ethers } from "ethers";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import { useWeb3 } from "@/context/Web3Context";
import { REGISTRY_CONTRACT_ABI } from "@/lib/constants"; // Assuming this has owner()

const REGISTRY_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS;

export default function Header() {
  const { account, provider } = useWeb3();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkOwnerStatus = async () => {
      if (!provider || !account || !REGISTRY_CONTRACT_ADDRESS) {
        setIsAdmin(false);
        return;
      }
      try {
        // Read-only contract instance using provider
        const contract = new ethers.Contract(
          REGISTRY_CONTRACT_ADDRESS,
          REGISTRY_CONTRACT_ABI,
          provider,
        );
        const owner = await contract.owner();
        setIsAdmin(account.toLowerCase() === owner.toLowerCase());
      } catch (error) {
        console.error("Failed to fetch contract owner in Header:", error);
        setIsAdmin(false);
      }
    };

    checkOwnerStatus();
  }, [account, provider]);

  return (
    <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center border-b border-gray-700">
        <Link href="/" className="flex items-center">
          <h1 className="text-2xl font-bold tracking-tighter hover:text-blue-300 transition-colors">
            <Vote className="inline-block mr-2 text-blue-400" />
            VeriVote
          </h1>
        </Link>

        <nav className="flex items-center space-x-4">
          {" "}
          <Link
            href="/elections"
            className="inline-flex items-center justify-center px-5 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-blue-500/50 text-sm"
          >
            <ListChecks size={16} className="mr-1.5" />
            Elections
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="inline-flex items-center justify-center px-5 py-2 font-semibold text-black bg-yellow-400 rounded-lg hover:bg-yellow-500 transition-all shadow-md hover:shadow-yellow-500/50 text-sm"
            >
              <ShieldCheck size={16} className="mr-1.5" /> Admin
            </Link>
          )}
          <ConnectWalletButton />
        </nav>
      </div>
    </header>
  );
}
