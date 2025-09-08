import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { ethers } from "ethers";
import bcrypt from "bcryptjs";
import {
  REGISTRY_CONTRACT_ADDRESS,
  REGISTRY_CONTRACT_ABI,
} from "@/lib/constants";

const MONGODB_URI = process.env.MONGODB_URI!;
const BACKEND_WALLET_PRIVATE_KEY = process.env.BACKEND_WALLET_PRIVATE_KEY!;
const SEPOLIA_RPC_URL = "https://rpc.sepolia.org"; // Public Sepolia RPC

// Same temporary OTP store as in send-otp
const otpStore: { [key: string]: { otp: string; timestamp: number } } = {};

export async function POST(request: Request) {
  try {
    const { email, regNumber, walletAddress, otp } = await request.json();

    // 1. Validate Input
    if (!email || !regNumber || !walletAddress || !otp) {
      return NextResponse.json(
        { message: "Missing required fields." },
        { status: 400 },
      );
    }

    // 2. Verify OTP
    const storedOtpData = otpStore[email];
    if (!storedOtpData) {
      return NextResponse.json(
        { message: "OTP not found or expired. Please try again." },
        { status: 400 },
      );
    }
    if (Date.now() - storedOtpData.timestamp > 10 * 60 * 1000) {
      // 10-minute expiry
      delete otpStore[email];
      return NextResponse.json(
        { message: "OTP has expired. Please request a new one." },
        { status: 400 },
      );
    }
    if (storedOtpData.otp !== otp) {
      return NextResponse.json({ message: "Invalid OTP." }, { status: 400 });
    }

    // OTP is correct, clear it
    delete otpStore[email];

    // 3. Connect to blockchain as the backend (contract owner)
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const ownerWallet = new ethers.Wallet(BACKEND_WALLET_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      REGISTRY_CONTRACT_ADDRESS,
      REGISTRY_CONTRACT_ABI,
      ownerWallet,
    );

    // 4. Call the addToWhitelist function on the smart contract
    console.log(`Whitelisting address: ${walletAddress}`);
    const tx = await contract.addToWhitelist(walletAddress);
    const receipt = await tx.wait(); // Wait for transaction to be mined
    console.log(`Transaction successful with hash: ${receipt.transactionHash}`);

    // 5. Store hashed user data in MongoDB
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    const salt = await bcrypt.genSalt(10);
    const hashedEmail = await bcrypt.hash(email, salt);
    const hashedRegNumber = await bcrypt.hash(regNumber, salt);

    await db.collection("users").insertOne({
      walletAddress,
      email: hashedEmail, // Store hashed email
      regNumber: hashedRegNumber, // Store hashed reg number
      isWhitelisted: true,
      createdAt: new Date(),
    });

    await client.close();

    return NextResponse.json(
      { message: "Verification successful! You are now whitelisted." },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in verify-otp:", error);

    // Type guard to safely check the error structure
    if (typeof error === "object" && error !== null && "code" in error) {
      const ethersError = error as { code: string }; // Type assertion
      if (ethersError.code === "CALL_EXCEPTION") {
        return NextResponse.json(
          {
            message:
              "Blockchain transaction failed. The address may already be whitelisted or another on-chain error occurred.",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
