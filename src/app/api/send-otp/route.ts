import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import nodemailer from "nodemailer";
import bcryptjs from "bcryptjs";

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export async function POST(request: Request) {
  const { email, regNumber, walletAddress } = await request.json();

  if (!email || !regNumber || !walletAddress) {
    return NextResponse.json(
      { message: "Missing required fields." },
      { status: 400 },
    );
  }

  // Using your existing variable names
  const MONGODB_URI = process.env.MONGODB_URI;
  const NODEMAILER_EMAIL = process.env.SMTP_EMAIL;
  const NODEMAILER_APP_PASSWORD = process.env.SMTP_PASSWORD;

  if (!MONGODB_URI || !NODEMAILER_EMAIL || !NODEMAILER_APP_PASSWORD) {
    console.error("Missing critical environment variables.");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 500 },
    );
  }

  const client = await MongoClient.connect(MONGODB_URI);

  try {
    const db = client.db();
    const usersCollection = db.collection("users");
    const existingUser = await usersCollection.findOne({
      $or: [{ email }, { regNumber }],
    });

    // We generate the OTP here and store it, so the same code is sent in the email and saved in the DB.
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const hashedOtp = await bcryptjs.hash(otp, 10);
    // --- END OF FIX ---

    if (existingUser) {
      if (existingUser.isWhitelisted) {
        return NextResponse.json(
          { message: "This user is already registered and whitelisted." },
          { status: 409 },
        );
      }

      // Update existing user with the new OTP generated above
      await usersCollection.updateOne(
        { _id: existingUser._id },
        { $set: { otp: hashedOtp, otpExpires, walletAddress } },
      );
    } else {
      // Create a new user with the new OTP and the new 'hasMintedNFT' field
      await usersCollection.insertOne({
        email,
        regNumber,
        walletAddress,
        otp: hashedOtp,
        otpExpires,
        isWhitelisted: false,
        hasMintedNFT: false, // Integrating your new requirement
      });
    }

    // Your existing Nodemailer transport setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: NODEMAILER_EMAIL, pass: NODEMAILER_APP_PASSWORD },
    });

    // Your existing mailOptions, now using the single, correct OTP
    const mailOptions = {
      from: NODEMAILER_EMAIL,
      to: email,
      subject: "Your VeriVote Verification Code",
      text: `Your new OTP for VeriVote is: ${otp}. It will expire in 10 minutes.`,
      html: `<p>Your new OTP for VeriVote is: <strong>${otp}</strong>. It will expire in 10 minutes.</p>`,
    };

    // The logic to resave the OTP is no longer needed as we do it correctly above.
    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { message: "OTP sent successfully." },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in send-otp:", error);
    return NextResponse.json(
      { message: "An internal server error occurred." },
      { status: 500 },
    );
  } finally {
    await client.close();
  }
}
