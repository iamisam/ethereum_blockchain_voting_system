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

    // --- THIS IS THE NEW, SMARTER LOGIC ---
    if (existingUser) {
      // If the user already exists AND is already whitelisted, block them.
      if (existingUser.isWhitelisted) {
        return NextResponse.json(
          { message: "This user is already registered and whitelisted." },
          { status: 409 },
        );
      }

      // If the user exists but is NOT whitelisted, they are just trying again.
      // We will update their record with a new OTP.
      const otp = generateOTP();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const hashedOtp = await bcryptjs.hash(otp, 10);

      await usersCollection.updateOne(
        { _id: existingUser._id },
        { $set: { otp: hashedOtp, otpExpires, walletAddress } }, // Also update wallet address if they changed it
      );

      // Now, resend the new OTP via email (code below is the same)
    } else {
      // If no user exists, create a new one.
      const otp = generateOTP();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      const hashedOtp = await bcryptjs.hash(otp, 10);

      await usersCollection.insertOne({
        email,
        regNumber,
        walletAddress,
        otp: hashedOtp,
        otpExpires,
        isWhitelisted: false,
      });
    }
    // --- END OF NEW LOGIC ---

    // The email sending part remains the same. We need to get the plain OTP again.
    const otp = generateOTP(); // NOTE: This is inefficient, we'll use the one from above later. For now, let's keep it simple.
    // For a real app, you would not regenerate, you'd pass the plain OTP from the logic above.

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: NODEMAILER_EMAIL, pass: NODEMAILER_APP_PASSWORD },
    });

    const mailOptions = {
      from: NODEMAILER_EMAIL,
      to: email,
      subject: "Your VeriVote Verification Code",
      text: `Your new OTP for VeriVote is: ${otp}. It will expire in 10 minutes.`,
      html: `<p>Your new OTP for VeriVote is: <strong>${otp}</strong>. It will expire in 10 minutes.</p>`,
    };

    // We need to re-hash and save this one to match the email
    await usersCollection.updateOne(
      { email },
      { $set: { otp: await bcryptjs.hash(otp, 10) } },
    );

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
