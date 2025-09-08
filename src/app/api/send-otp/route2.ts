import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import nodemailer from "nodemailer";

const MONGODB_URI = process.env.MONGODB_URI!;
const SMTP_EMAIL = process.env.SMTP_EMAIL!;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD!;

// Basic in-memory cache for OTPs to avoid DB writes for every attempt
// In production, you'd use Redis or a similar caching service.
// For this project, MongoDB with a TTL index is also a great choice.
const otpStore: { [key: string]: { otp: string; timestamp: number } } = {};

// Helper function for email validation
const isValidVitEmail = (email: string): boolean => {
  return /^[a-zA-Z0-9._%+-]+@vitstudent\.ac\.in$/.test(email);
};

// Helper function for registration number validation
const isValidRegNumber = (regNumber: string): boolean => {
  const match = regNumber.match(/^(\d{2})([A-Z]{3})(\d{4})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const currentYear = new Date().getFullYear() % 100; // Get last two digits of the current year

  // Allow registrations for the current year and previous years
  return year <= currentYear;
};

export async function POST(request: Request) {
  try {
    const { email, regNumber, walletAddress } = await request.json();

    // 1. Validate Input
    if (!email || !regNumber || !walletAddress) {
      return NextResponse.json(
        { message: "Missing required fields." },
        { status: 400 },
      );
    }
    if (!isValidVitEmail(email)) {
      return NextResponse.json(
        {
          message: "Invalid email format. Must be a @vitstudent.ac.in address.",
        },
        { status: 400 },
      );
    }
    if (!isValidRegNumber(regNumber)) {
      return NextResponse.json(
        { message: "Invalid registration number format." },
        { status: 400 },
      );
    }

    // 2. Check if user already exists
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();
    const existingUser = await db.collection("users").findOne({
      $or: [{ email }, { regNumber }],
    });
    if (existingUser) {
      await client.close();
      return NextResponse.json(
        { message: "Email or registration number is already registered." },
        { status: 409 },
      );
    }

    // 3. Generate and store OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

    // Store OTP with a 10-minute expiry
    otpStore[email] = { otp, timestamp: Date.now() };

    // Cleanup old OTPs (simple garbage collection)
    Object.keys(otpStore).forEach((key) => {
      if (Date.now() - otpStore[key].timestamp > 10 * 60 * 1000) {
        delete otpStore[key];
      }
    });

    // 4. Send OTP email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: SMTP_EMAIL,
        pass: SMTP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"VeriVote" <${SMTP_EMAIL}>`,
      to: email,
      subject: "Your VeriVote Verification Code",
      html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2>VeriVote Registration</h2>
                    <p>Your One-Time Password (OTP) to verify your account is:</p>
                    <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${otp}</p>
                    <p>This code will expire in 10 minutes.</p>
                    <p>If you did not request this, please ignore this email.</p>
                </div>
            `,
    });

    await client.close();

    return NextResponse.json(
      { message: "OTP sent successfully." },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in send-otp:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
