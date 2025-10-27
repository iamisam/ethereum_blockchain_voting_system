"use client"; // <-- ADD THIS DIRECTIVE AT THE VERY TOP

import Link from "next/link";
import { Users, PlusSquare, ShieldCheck, ShieldAlert } from "lucide-react";
import { useWeb3 } from "@/context/Web3Context"; // Now safe to import and use

// Client component logic can now directly use the hook
function AdminDashboardClient() {
  const { account } = useWeb3();
  const isAdmin = !!account;

  return (
    <div className="w-full max-w-4xl p-8 bg-gray-800 border border-gray-700 rounded-2xl shadow-lg">
      <div className="flex items-center mb-6">
        <ShieldCheck className="h-8 w-8 text-green-400 mr-4" />
        <h2 className="text-3xl font-bold">Admin Dashboard</h2>
      </div>
      {isAdmin ? ( // Using the isAdmin check
        <>
          <p className="text-gray-400 mb-8">
            Select an administrative task below.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              href="/admin/users"
              className="block p-6 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <Users className="h-8 w-8 text-red-400 mb-3" />
              <h3 className="text-xl font-semibold mb-2">Manage Users</h3>
              <p className="text-gray-400 text-sm">
                Revoke access for existing users (burn NFT, remove whitelist).
              </p>
            </Link>
            <Link
              href="/admin/elections"
              className="block p-6 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <PlusSquare className="h-8 w-8 text-blue-400 mb-3" />
              <h3 className="text-xl font-semibold mb-2">Create Election</h3>
              <p className="text-gray-400 text-sm">
                Set up and deploy a new election smart contract.
              </p>
            </Link>
          </div>
        </>
      ) : (
        <div className="text-center p-8 border border-yellow-700 bg-yellow-900/50 rounded-lg">
          <ShieldAlert className="mx-auto h-12 w-12 text-yellow-400" />
          <h3 className="mt-4 text-xl font-bold">Connect Wallet</h3>
          <p className="mt-2 text-yellow-300">
            Please connect the contract owner wallet to access admin functions.
          </p>
        </div>
      )}
    </div>
  );
}

// The default export now just renders the client component directly
export default function AdminPage() {
  // Note: Removed the unnecessary server component wrapper
  return (
    <div className="container mx-auto px-6 flex flex-col items-center justify-center py-24 md:py-32">
      <AdminDashboardClient />
    </div>
  );
}
