import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET as string;

const schema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not defined');
      return NextResponse.json(
        { error: 'Server configuration error.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const passwordOk = await bcrypt.compare(password, user.password);

    if (!passwordOk) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

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
      { expiresIn: '7d' }
    );

    return NextResponse.json(
      {
        message: 'Login successful.',
        token,
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

  } catch (error: unknown) {
    console.error('Login Error:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
