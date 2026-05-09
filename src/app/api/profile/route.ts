import { NextRequest } from "next/server";
import bcrypt from "bcrypt";
import cloudinary from "@/lib/cloudinary";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import Otp from "@/models/Otp";
import User from "@/models/User";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const MAX_REQUEST_SIZE = 6 * 1024 * 1024;
const MAX_OTP_ATTEMPTS = 5;

function publicUser(user: {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  role: string;
  profileImage?: string;
  verificationStatus: string;
  caseCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    userId: user.userId,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    address: user.address,
    role: user.role,
    profileImage: user.profileImage,
    verificationStatus: user.verificationStatus,
    caseCount: user.caseCount,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/[^\w.\-]/g, "_")
    .slice(0, 100);
}

function detectProfileImage(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

async function uploadProfilePhoto(file: File): Promise<string> {
  if (file.size > MAX_PHOTO_SIZE) {
    throw new Error("Profile photo exceeds the 5MB limit.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!detectProfileImage(buffer)) {
    throw new Error("Profile photo must be a valid JPG, PNG, or WEBP image.");
  }

  const safeName = sanitizeFilename(file.name).replace(/\.[^.]+$/, "") || "profile-photo";

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: "legalhub/profile-images",
        resource_type: "image",
        public_id: safeName,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error("Upload failed"));
        }
      }
    ).end(buffer);
  });
}

async function verifyProfileOtp(email: string, otp: string): Promise<string | null> {
  if (!/^\d{6}$/.test(otp)) return "Enter a valid 6-digit OTP.";

  const record = await Otp.findOne({
    email,
    verified: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record) return "No valid OTP found. Please request a new OTP.";

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await Otp.deleteOne({ _id: record._id });
    return "Too many failed attempts. Please request a new OTP.";
  }

  record.attempts += 1;
  const valid = await bcrypt.compare(otp, record.otp);
  if (!valid) {
    await record.save();
    return `Invalid OTP. ${MAX_OTP_ATTEMPTS - record.attempts} attempt(s) remaining.`;
  }

  await Otp.deleteOne({ _id: record._id });
  return null;
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const authUser = getAuthUser(req);
    if (!authUser) return ApiResponse.unauthorized();

    const user = await User.findOne({ userId: authUser.userId });
    if (!user) return ApiResponse.notFound("User");

    return ApiResponse.success({ user: publicUser(user) });
  } catch (error) {
    console.error("GET /api/profile:", error);
    return ApiResponse.error("Internal Server Error");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_REQUEST_SIZE) {
      return ApiResponse.error("Request too large. Maximum profile photo size is 5MB.", 413);
    }

    await connectDB();

    const authUser = getAuthUser(req);
    if (!authUser) return ApiResponse.unauthorized();

    const user = await User.findOne({ userId: authUser.userId });
    if (!user) return ApiResponse.notFound("User");

    const formData = await req.formData();
    const fullName = (formData.get("fullName") || user.fullName).toString().trim();
    const phoneNumber = (formData.get("phoneNumber") || user.phoneNumber).toString().trim();
    const address = (formData.get("address") || user.address).toString().trim();
    const otp = (formData.get("otp") || "").toString().trim();
    const profileImage = formData.get("profileImage") as File | null;

    if (fullName.length < 2 || fullName.length > 100) {
      return ApiResponse.badRequest("Full name must be between 2 and 100 characters.");
    }
    if (!/^\+91[6-9]\d{9}$/.test(phoneNumber)) {
      return ApiResponse.badRequest("Phone number must be a valid Indian number starting with +91.");
    }
    if (address.length < 10 || address.length > 500) {
      return ApiResponse.badRequest("Address must be between 10 and 500 characters.");
    }

    const detailsChanged = fullName !== user.fullName || phoneNumber !== user.phoneNumber || address !== user.address;
    if (detailsChanged) {
      const otpError = await verifyProfileOtp(user.email, otp);
      if (otpError) return ApiResponse.error(otpError, otpError.startsWith("Too many") ? 429 : 400);

      if (phoneNumber !== user.phoneNumber) {
        const existingPhone = await User.findOne({ phoneNumber, userId: { $ne: user.userId } });
        if (existingPhone) return ApiResponse.error("This phone number is already in use.", 409);
      }

      user.fullName = fullName;
      user.phoneNumber = phoneNumber;
      user.address = address;
    }

    if (profileImage && profileImage.size > 0) {
      user.profileImage = await uploadProfilePhoto(profileImage);
    }

    await user.save();

    return ApiResponse.success({
      message: detailsChanged
        ? "Profile updated after OTP verification."
        : "Profile photo updated.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("PATCH /api/profile:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(message);
  }
}
