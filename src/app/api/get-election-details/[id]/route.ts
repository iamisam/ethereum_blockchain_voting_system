import { NextResponse } from "next/server";
import { MongoClient, ObjectId } from "mongodb";

interface ElectionDetailsParams {
  params: { id: string };
}

export async function GET(request: Request, { params }: ElectionDetailsParams) {
  const electionId = params.id;

  if (!electionId || !ObjectId.isValid(electionId)) {
    return NextResponse.json(
      { message: "Invalid election ID." },
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
    const electionsCollection = db.collection("elections");

    const election = await electionsCollection.findOne({
      _id: new ObjectId(electionId),
    });

    if (!election) {
      return NextResponse.json(
        { message: "Election not found." },
        { status: 404 },
      );
    }

    // Explicitly create a NEW plain object with only the required, simple fields.
    // This prevents any complex types (like internal Mongo types or Sets) from being included.
    const plainElectionDetails = {
      _id: election._id.toString(),
      title: election.title,
      // Ensure dates are strings
      startTime:
        election.startTime instanceof Date
          ? election.startTime.toISOString()
          : String(election.startTime),
      endTime:
        election.endTime instanceof Date
          ? election.endTime.toISOString()
          : String(election.endTime),
      electionContractAddress: election.electionContractAddress,
      metadataIpfsHash: election.metadataIpfsHash,
      publicKey: election.publicKey,
      status: election.status,
      // DO NOT include the whole 'election' object, only the fields we need.
    };

    return NextResponse.json(plainElectionDetails, { status: 200 });
  } catch (error) {
    console.error(`Error fetching election details for ${electionId}:`, error);
    return NextResponse.json(
      { message: "An internal server error occurred." },
      { status: 500 },
    );
  } finally {
    await client.close();
  }
}
