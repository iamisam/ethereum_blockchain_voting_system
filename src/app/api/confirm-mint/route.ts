import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";

export async function POST(request: Request) {
  const { walletAddress } = await request.json();
  if (!walletAddress) {
    return NextResponse.json(
      { message: "Wallet address is required." },
      { status: 400 },
    );
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 500 },
    );
  }

  const client = await MongoClient.connect(MONGODB_URI);
  try {
    const db = client.db();
    const usersCollection = db.collection("users");

    const result = await usersCollection.updateOne(
      { walletAddress: walletAddress },
      { $set: { hasMintedNFT: true } },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Mint status confirmed." },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in confirm-mint:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  } finally {
    await client.close();
  }
}
