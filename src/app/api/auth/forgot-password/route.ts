import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Otp from '@/models/Otp';
import { sendOtp } from '@/lib/email';

const MAX_PER_EMAIL = 3;
const MAX_PER_IP = 6;
const ONE_HOUR = 60 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;

const schema = z.object({
  email: z.string().email('Must be a valid email address'),
});

function makeOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json(
        { message: 'If an account with this email exists, an OTP has been sent.' },
        { status: 200 }
      );
    }

    const now = new Date();
    const since = new Date(now.getTime() - ONE_HOUR);

    const emailCount = await Otp.countDocuments({
      email,
      createdAt: { $gte: since },
    });

    if (emailCount >= MAX_PER_EMAIL) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please try again after 1 hour.' },
        { status: 429 }
      );
    }

    if (ip !== 'unknown') {
      const ipCount = await Otp.countDocuments({
        ip,
        createdAt: { $gte: since },
      });

      if (ipCount >= MAX_PER_IP) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again after 1 hour.' },
          { status: 429 }
        );
      }
    }

    await Otp.deleteMany({ email, verified: false });

    const otp = makeOtp();
    const hashed = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(now.getTime() + FIVE_MINUTES);

    await Otp.create({
      email,
      otp: hashed,
      ip,
      expiresAt,
      attempts: 0,
    });

    try {
      await sendOtp({ to: email, otp, purpose: 'password-reset' });
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Email sending failed:', err);
      }
      return NextResponse.json(
        { error: 'Failed to send OTP email. Please try again.' },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Password Reset OTP for ${email}: ${otp}`);
    }

    return NextResponse.json(
      {
        message: 'If an account with this email exists, an OTP has been sent.',
        expiresIn: '5 minutes',
      },
      { status: 200 }
    );

  } catch (error: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Forgot Password Error:', error);
    }
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
