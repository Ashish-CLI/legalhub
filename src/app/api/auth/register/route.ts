import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Otp from '@/models/Otp';
import cloudinary from '@/lib/cloudinary';

const schema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/, 'Must be a valid Indian phone number starting with +91'),
  address: z.string().min(10, 'Address must be at least 10 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['client', 'lawyer', 'judge', 'admin']),
});

async function uploadFile(file: File, folder: string): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: `legalhub/${folder}`,
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error('Upload failed'));
        }
      }
    ).end(buffer);
  });
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const formData = await req.formData();

    const rawData = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phoneNumber: formData.get('phoneNumber'),
      address: formData.get('address'),
      password: formData.get('password'),
      role: formData.get('role') || 'client',
    };

    const parsed = schema.safeParse(rawData);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { fullName, email, phoneNumber, address, password, role } = parsed.data;

    const existing = await User.findOne({
      $or: [{ email }, { phoneNumber }]
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A user with this email or phone number already exists.' },
        { status: 409 }
      );
    }

    const verified = await Otp.findOne({
      email,
      verified: true,
      expiresAt: { $gt: new Date() },
    });

    if (!verified) {
      return NextResponse.json(
        { error: 'Email not verified. Please verify your email with OTP first.' },
        { status: 403 }
      );
    }

    const idDocument = formData.get('idDocument') as File | null;
    const professionalDocument = formData.get('professionalDocument') as File | null;

    if (!idDocument) {
      return NextResponse.json({ error: 'ID Document is required for all users.' }, { status: 400 });
    }

    if (['lawyer', 'judge', 'admin'].includes(role) && !professionalDocument) {
      return NextResponse.json({ error: `${role} registration requires a professional verification document.` }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024;
    const allowedTypes = ['application/pdf', 'image/jpeg'];

    if (idDocument.size > maxSize) {
      return NextResponse.json({ error: 'ID Document exceeds the 5MB limit.' }, { status: 400 });
    }
    if (!allowedTypes.includes(idDocument.type)) {
      return NextResponse.json({ error: 'ID Document must be a JPG or PDF.' }, { status: 400 });
    }

    if (professionalDocument) {
      if (professionalDocument.size > maxSize) {
        return NextResponse.json({ error: 'Professional Document exceeds the 5MB limit.' }, { status: 400 });
      }
      if (!allowedTypes.includes(professionalDocument.type)) {
        return NextResponse.json({ error: 'Professional Document must be a JPG or PDF.' }, { status: 400 });
      }
    }

    const idUrl = await uploadFile(idDocument, 'id-documents');
    let profUrl = undefined;
    if (professionalDocument) {
      profUrl = await uploadFile(professionalDocument, 'professional-documents');
    }

    const user = new User({
      fullName,
      email,
      phoneNumber,
      address,
      password,
      role,
      idDocument: idUrl,
      professionalDocument: profUrl,
    });

    await user.save();

    await Otp.deleteMany({ email });

    return NextResponse.json(
      {
        message: 'Registration successful! Your account is pending admin verification.',
        user: {
          userId: user.userId,
          fullName: user.fullName,
          role: user.role,
          verificationStatus: user.verificationStatus
        }
      },
      { status: 201 }
    );

  } catch (error: unknown) {
    console.error('Registration API Error:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
