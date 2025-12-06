import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { ethers } from "ethers";
import bcryptjs from "bcryptjs"; // Make sure bcryptjs is imported
import { REGISTRY_CONTRACT_ABI } from "@/lib/constants";

export async function POST(request: Request) {
  const { email, regNumber, walletAddress, otp } = await request.json();

  if (!email || !regNumber || !walletAddress || !otp) {
    return NextResponse.json(
      { message: "Missing required fields." },
      { status: 400 },
    );
  }

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
      "Missing critical server environment variables for verify-otp.",
    );
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 500 },
    );
  }

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();
  const usersCollection = db.collection("users");

  try {
    const user = await usersCollection.findOne({
      email,
      regNumber,
      walletAddress,
    });

    // 1. Check if the user exists first.
    if (!user) {
      return NextResponse.json(
        {
          message:
            "User not found. Please start the registration process again.",
        },
        { status: 404 },
      );
    }

    // 2. Use bcryptjs.compare to securely check the OTP.
    const isOtpValid = await bcryptjs.compare(otp, user.otp);

    // 3. Check for all failure conditions: invalid OTP or expired OTP.
    if (!isOtpValid || user.otpExpires < new Date()) {
      return NextResponse.json(
        { message: "OTP not found or expired. Please try again." },
        { status: 400 },
      );
    }
    const combinedString = `${email.toLowerCase()}|${regNumber.toUpperCase()}|${walletAddress.toLowerCase()}`;
    console.log(combinedString);
    const identityHash = ethers.keccak256(ethers.toUtf8Bytes(combinedString));

    // If OTP is valid, proceed to whitelist the user on the blockchain
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    const registryContract = new ethers.Contract(
      REGISTRY_CONTRACT_ADDRESS,
      REGISTRY_CONTRACT_ABI,
      ownerWallet,
    );

    try {
      const tx = await registryContract.addToWhitelist(
        walletAddress,
        identityHash,
      );
      await tx.wait(); // Wait for the transaction to be mined
    } catch (error: unknown) {
      console.error("Blockchain transaction failed:", error);

      // Type guard for error object
      if (error && typeof error === "object" && "revert" in error) {
        const contractError = error as { revert: { args: string[] } };
        return NextResponse.json(
          { message: `Contract Error: ${contractError.revert.args[0]}` },
          { status: 400 },
        );
      }

      // Handle generic error message
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to whitelist on the blockchain.";

      return NextResponse.json({ message: errorMessage }, { status: 500 });
    }

    // Mark the user as whitelisted in the database
    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { isWhitelisted: true }, $unset: { otp: "", otpExpires: "" } },
    );

    return NextResponse.json(
      { message: "Successfully verified and whitelisted!" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in verify-otp:", error);
    return NextResponse.json(
      { message: "An internal server error occurred." },
      { status: 500 },
    );
  } finally {
    await client.close();
  }
}
