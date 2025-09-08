import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";

export async function POST(request: Request) {
  const { walletAddress } = await request.json();

  if (!walletAddress) {
    return NextResponse.json(
      { message: "Missing wallet address." },
      { status: 400 },
    );
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI environment variable.");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 500 },
    );
  }

  const client = await MongoClient.connect(MONGODB_URI);

  try {
    const db = client.db();
    const usersCollection = db.collection("users");

    // Check if a user with this wallet address already exists
    const existingUser = await usersCollection.findOne({ walletAddress });

    // If the user does NOT exist in our DB, create them.
    if (!existingUser) {
      console.log(
        `Syncing: User ${walletAddress} is whitelisted on-chain but not in DB. Creating record.`,
      );

      // We create a placeholder record. The critical part is setting isWhitelisted to true.
      await usersCollection.insertOne({
        walletAddress,
        isWhitelisted: true,
        // Add placeholder data for other fields
        email: `synced-${walletAddress.substring(0, 8)}@verivote.local`,
        regNumber: "SYNCED-ON-CHAIN",
      });
      return NextResponse.json(
        { message: "User synced successfully." },
        { status: 201 },
      );
    }

    // If the user already exists, do nothing.
    return NextResponse.json(
      { message: "User is already in sync." },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in sync-user:", error);
    return NextResponse.json(
      { message: "An internal server error occurred." },
      { status: 500 },
    );
  } finally {
    await client.close();
  }
}
