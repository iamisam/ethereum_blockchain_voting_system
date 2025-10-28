import { NextResponse } from "next/server";
import { MongoClient, ObjectId } from "mongodb";

export async function GET(request: Request) {
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
    const electionsCollection = db.collection("elections");

    // Fetch all elections, sort by start time descending (newest first)
    const elections = await electionsCollection
      .find({})
      .sort({ startTime: -1 })
      // Select only the fields needed for the list view
      .project({
        _id: 1, // Need the ID for the link
        title: 1,
        startTime: 1,
        endTime: 1,
        status: 1,
      })
      .toArray();

    // Convert ObjectId to string for JSON serialization
    const electionsWithStringIds = elections.map((election) => ({
      ...election,
      _id: election._id.toString(),
    }));

    return NextResponse.json(electionsWithStringIds, { status: 200 });
  } catch (error) {
    console.error("Error fetching elections:", error);
    return NextResponse.json(
      { message: "An internal server error occurred." },
      { status: 500 },
    );
  } finally {
    await client.close();
  }
}
