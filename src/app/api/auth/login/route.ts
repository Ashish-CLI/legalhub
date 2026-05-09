import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Counter from '@/models/Counter';
import { logUserLogin } from '@/lib/audit';

const JWT_SECRET = process.env.JWT_SECRET as string;

const MAX_FAILED_PER_EMAIL = 5;
const MAX_FAILED_PER_IP = 20;
const LOCKOUT_WINDOW = 15 * 60 * 1000;

const schema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

function checkRateLimit(key: string, max: number): { blocked: boolean; remaining: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record || now - record.firstAttempt > LOCKOUT_WINDOW) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
    return { blocked: false, remaining: max - 1 };
  }

  record.count += 1;
  if (record.count > max) {
    return { blocked: true, remaining: 0 };
  }

  return { blocked: false, remaining: max - record.count };
}

function clearRateLimit(key: string) {
  loginAttempts.delete(key);
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    if (!JWT_SECRET) {
      return NextResponse.json(
        { error: 'Server configuration error.' },
        { status: 500 }
      );
    }

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

    const { email, password } = parsed.data;

    // Rate limit by email
    const emailCheck = checkRateLimit(`login:email:${email}`, MAX_FAILED_PER_EMAIL);
    if (emailCheck.blocked) {
      return NextResponse.json(
        { error: 'Too many failed login attempts. Please try again after 15 minutes.' },
        { status: 429 }
      );
    }

    // Rate limit by IP
    if (ip !== 'unknown') {
      const ipCheck = checkRateLimit(`login:ip:${ip}`, MAX_FAILED_PER_IP);
      if (ipCheck.blocked) {
        return NextResponse.json(
          { error: 'Too many login attempts. Please try again later.' },
          { status: 429 }
        );
      }
    }

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    if (!user.userId) {
      const prefixes: Record<string, string> = {
        client: 'C',
        lawyer: 'L',
        judge: 'J',
        admin: 'A'
      };
      const prefix = prefixes[user.role] || 'U';

      const counter = await Counter.findByIdAndUpdate(
        { _id: prefix },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      const num = counter.seq;
      const seq = num.toString().padStart(4, '0');
      user.userId = `${prefix}${seq}`;
      await user.save();
    }

    const passwordOk = await bcrypt.compare(password, user.password);

    if (!passwordOk) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    clearRateLimit(`login:email:${email}`);

    if (user.verificationStatus === 'pending') {
      return NextResponse.json(
        { error: 'Your account is pending admin verification. Please wait for approval.' },
        { status: 403 }
      );
    }

    if (user.verificationStatus === 'rejected') {
      return NextResponse.json(
        { error: 'Your account has been rejected. Please contact support.' },
        { status: 403 }
      );
    }

    const token = jwt.sign(
      {
        userId: user.userId,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '30m' }
    );

    const response = NextResponse.json(
      {
        message: 'Login successful.',
        user: {
          userId: user.userId,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          verificationStatus: user.verificationStatus,
        },
      },
      { status: 200 }
    );

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60,
      path: '/',
    });

    // Log successful login event
    try {
      await logUserLogin(user.userId, user.role);
    } catch (auditError) {
      console.error('Failed to create audit log for login:', auditError);
    }

    return response;

  } catch (error: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Login Error:', error);
    }
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
