import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import dbConnect from '@/lib/mongodb';
import Otp from '@/models/Otp';
import { sendOtp } from '@/lib/email';

const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 10;
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

    const now = new Date();
    const since = new Date(now.getTime() - ONE_HOUR);

    const emailCount = await Otp.countDocuments({
      email,
      createdAt: { $gte: since },
    });

    if (emailCount >= MAX_PER_EMAIL) {
      return NextResponse.json(
        { error: 'Too many OTP requests for this email. Please try again after 1 hour.' },
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
          { error: 'Too many OTP requests. Please try again after 1 hour.' },
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
      await sendOtp({ to: email, otp, purpose: 'registration' });
    } catch (err) {
      console.error('Email sending failed:', err);
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json(
          { error: 'Failed to send OTP email. Please try again.' },
          { status: 500 }
        );
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }

    return NextResponse.json(
      {
        message: 'OTP sent to your email.',
        expiresIn: '5 minutes',
        ...(process.env.NODE_ENV === 'development' && { otp }),
      },
      { status: 200 }
    );

  } catch (error: unknown) {
    console.error('Send OTP Error:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
