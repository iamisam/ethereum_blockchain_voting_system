import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { ethers } from "ethers";
import { REGISTRY_CONTRACT_ABI } from "@/lib/constants";

// Helper type guard for Ethers errors
function isEthersRevertError(
  error: unknown,
): error is { revert: { args: string[] } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "revert" in error &&
    typeof (error as any).revert === "object" &&
    (error as any).revert !== null &&
    "args" in (error as any).revert &&
    Array.isArray((error as any).revert.args)
  );
}

export async function POST(request: Request) {
  const { walletAddress } = await request.json();

  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return NextResponse.json(
      { message: "Invalid or missing wallet address." },
      { status: 400 },
    );
  }

  // Load all necessary server-side environment variables
  const MONGODB_URI = process.env.MONGODB_URI;
  const OWNER_PRIVATE_KEY = process.env.BACKEND_WALLET_PRIVATE_KEY;
  const REGISTRY_CONTRACT_ADDRESS =
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS;
  const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;

  if (
    !MONGODB_URI ||
    !OWNER_PRIVATE_KEY ||
    !REGISTRY_CONTRACT_ADDRESS ||
    !SEPOLIA_RPC_URL
  ) {
    console.error(
      "Missing critical server environment variables for revoke-access.",
    );
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 500 },
    );
  }

  // --- Step 1: Perform the On-Chain Action ---
  try {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    const registryContract = new ethers.Contract(
      REGISTRY_CONTRACT_ADDRESS,
      REGISTRY_CONTRACT_ABI,
      ownerWallet,
    );

    const tx = await registryContract.revokeAccess(walletAddress);
    await tx.wait(); // Wait for the blockchain transaction to be confirmed
  } catch (error: unknown) {
    console.error("Blockchain transaction failed during revoke:", error);
    if (isEthersRevertError(error)) {
      return NextResponse.json(
        { message: `Contract Error: ${error.revert.args[0]}` },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "An on-chain error occurred while revoking access." },
      { status: 500 },
    );
  }

  // --- Step 2: Perform the Off-Chain Action (if on-chain was successful) ---
  const client = await MongoClient.connect(MONGODB_URI);
  try {
    const db = client.db();
    const usersCollection = db.collection("users");

    // Update the user's document to reflect their revoked status
    const result = await usersCollection.updateOne(
      { walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") } },
      { $set: { isWhitelisted: false, hasMintedNFT: false } },
    );

    if (result.matchedCount === 0) {
      // This is okay; it just means there was no DB record, but the on-chain revoke still worked.
      return NextResponse.json(
        {
          message:
            "On-chain access revoked. No matching user found in database.",
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { message: "User access successfully revoked on-chain and in database." },
      { status: 200 },
    );
  } catch (error) {
    console.error("Database update failed after successful revoke:", error);
    // Even if the DB fails, the on-chain action succeeded, so we inform the admin of this partial success.
    return NextResponse.json(
      {
        message:
          "On-chain access revoked, but database update failed. Please check logs.",
      },
      { status: 500 },
    );
  } finally {
    await client.close();
  }
}
