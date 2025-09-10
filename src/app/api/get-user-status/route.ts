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
    console.error("Missing MONGODB_URI.");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 500 },
    );
  }

  const client = await MongoClient.connect(MONGODB_URI);
  try {
    const db = client.db();
    const usersCollection = db.collection("users");

    // Find the user by their wallet address
    const user = await usersCollection.findOne(
      { walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") } },
      // Only return the fields we need
      { projection: { isWhitelisted: 1, hasMintedNFT: 1 } },
    );

    if (user) {
      // If user is found, return their status
      return NextResponse.json(
        {
          exists: true,
          isWhitelisted: user.isWhitelisted,
          hasMintedNFT: user.hasMintedNFT,
        },
        { status: 200 },
      );
    } else {
      // If no user is found in the database
      return NextResponse.json({ exists: false }, { status: 404 });
    }
  } catch (error) {
    console.error("Error in get-user-status:", error);
    return NextResponse.json(
      { message: "An internal server error occurred." },
      { status: 500 },
    );
  } finally {
    await client.close();
  }
}
