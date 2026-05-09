import { NextRequest } from "next/server";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import Otp from "@/models/Otp";
import User from "@/models/User";
import { getMailer } from "@/lib/email";

const FIVE_MINUTES = 5 * 60 * 1000;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 10;
const ONE_HOUR = 60 * 60 * 1000;

function makeOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

async function sendProfileOtpEmail(to: string, otp: string): Promise<void> {
  await getMailer().sendMail({
    from: `"LegalHub" <${process.env.GMAIL_USER}>`,
    to,
    subject: "LegalHub - Profile Update Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #f8fafc; border-radius: 16px;">
        <h1 style="color: #0f172a; margin: 0 0 12px;">LegalHub Profile Update</h1>
        <p style="color: #475569; font-size: 15px;">Use this code to confirm changes to your profile details.</p>
        <div style="margin: 24px 0; padding: 18px; border-radius: 12px; background: #e2e8f0; text-align: center;">
          <span style="font-size: 34px; letter-spacing: 8px; font-weight: 800; color: #0f172a;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">This code expires in <strong>5 minutes</strong>. Your profile photo does not require this code.</p>
      </div>
    `,
  });
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const authUser = getAuthUser(req);
    if (!authUser) return ApiResponse.unauthorized();

    const user = await User.findOne({ userId: authUser.userId });
    if (!user) return ApiResponse.notFound("User");

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";
    const since = new Date(Date.now() - ONE_HOUR);

    const emailCount = await Otp.countDocuments({
      email: user.email,
      createdAt: { $gte: since },
    });

    if (emailCount >= MAX_PER_EMAIL) {
      return ApiResponse.error("Too many OTP requests for this email. Please try again after 1 hour.", 429);
    }

    if (ip !== "unknown") {
      const ipCount = await Otp.countDocuments({
        ip,
        createdAt: { $gte: since },
      });

      if (ipCount >= MAX_PER_IP) {
        return ApiResponse.error("Too many OTP requests. Please try again after 1 hour.", 429);
      }
    }

    const otp = makeOtp();

    await Otp.deleteMany({ email: user.email, verified: false });
    await Otp.create({
      email: user.email,
      otp: await bcrypt.hash(otp, 10),
      ip,
      expiresAt: new Date(Date.now() + FIVE_MINUTES),
      attempts: 0,
    });

    await sendProfileOtpEmail(user.email, otp);

    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Profile update OTP for ${user.email}: ${otp}`);
    }

    return ApiResponse.success({
      message: "OTP sent to your registered email.",
      expiresIn: "5 minutes",
    });
  } catch (error) {
    console.error("POST /api/profile/otp:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
