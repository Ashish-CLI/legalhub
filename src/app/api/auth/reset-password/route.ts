import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Otp from '@/models/Otp';

const MAX_ATTEMPTS = 5;

const schema = z.object({
  email: z.string().email('Must be a valid email address'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, otp, newPassword } = parsed.data;

    const record = await Otp.findOne({
      email,
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) {
      return NextResponse.json(
        { error: 'No valid OTP found. Please request a new password reset.' },
        { status: 400 }
      );
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await Otp.deleteOne({ _id: record._id });
      return NextResponse.json(
        { error: 'Too many failed attempts. Please request a new OTP.' },
        { status: 429 }
      );
    }

    record.attempts += 1;

    const valid = await bcrypt.compare(otp, record.otp);
    if (!valid) {
      await record.save();
      const remaining = MAX_ATTEMPTS - record.attempts;
      return NextResponse.json(
        { error: `Invalid OTP. ${remaining} attempt(s) remaining.` },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found.' },
        { status: 404 }
      );
    }

    user.password = newPassword;
    await user.save();

    await Otp.deleteMany({ email });

    return NextResponse.json(
      { message: 'Password reset successful. You can now log in with your new password.' },
      { status: 200 }
    );

  } catch (error: unknown) {
    console.error('Reset Password Error:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
