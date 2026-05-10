import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Otp from '@/models/Otp';
import cloudinary from '@/lib/cloudinary';
import { logUserRegistration } from '@/lib/audit';
import FileAnalysis from '@/models/FileAnalysis';
import { fileAnalysisQueue } from '@/lib/fileAnalysis';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const MAX_REQUEST_SIZE = 12 * 1024 * 1024;
const MAX_FAILED_PER_EMAIL = 5;
const MAX_FAILED_PER_PHONE = 5;
const MAX_FAILED_PER_IP = 20;
const LOCKOUT_WINDOW = 15 * 60 * 1000;

const schema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/, 'Must be a valid Indian phone number starting with +91'),
  address: z.string().min(10, 'Address must be at least 10 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  role: z.enum(['client', 'lawyer', 'judge', 'admin']),
});

const registerAttempts = new Map<string, { count: number; firstAttempt: number }>();

function checkRateLimit(key: string, max: number): { blocked: boolean; remaining: number } {
  const now = Date.now();
  const record = registerAttempts.get(key);

  if (!record || now - record.firstAttempt > LOCKOUT_WINDOW) {
    registerAttempts.set(key, { count: 1, firstAttempt: now });
    return { blocked: false, remaining: max - 1 };
  }

  record.count += 1;
  if (record.count > max) {
    return { blocked: true, remaining: 0 };
  }

  return { blocked: false, remaining: max - record.count };
}

function clearRateLimit(key: string) {
  registerAttempts.delete(key);
}

function validateFileMagicBytes(buffer: Buffer): { valid: boolean; detectedType: string } {
  // PDF:
  if (buffer.length >= 4 &&
    buffer[0] === 0x25 && buffer[1] === 0x50 &&
    buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { valid: true, detectedType: 'application/pdf' };
  }

  // JPEG:
  if (buffer.length >= 3 &&
    buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, detectedType: 'image/jpeg' };
  }

  return { valid: false, detectedType: 'unknown' };
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[^\w.\-]/g, '_')
    .slice(0, 100);
}

/**
 * Save file locally for analysis
 * Returns the file path where the file is saved
 */
async function saveFileLocally(file: File, fileId: string): Promise<string> {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';

  // Create uploads directory if it doesn't exist
  await fs.mkdir(uploadDir, { recursive: true });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Determine file extension
  const ext = path.extname(file.name) || '.pdf';
  const filePath = path.join(uploadDir, `${fileId}${ext}`);

  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';

    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: 'Request too large. Maximum total size is 12MB.' },
        { status: 413 }
      );
    }

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

    const emailCheck = checkRateLimit(`register:email:${email}`, MAX_FAILED_PER_EMAIL);
    if (emailCheck.blocked) {
      return NextResponse.json(
        { error: 'Too many registration attempts for this email. Please try again after 15 minutes.' },
        { status: 429 }
      );
    }

    const phoneCheck = checkRateLimit(`register:phone:${phoneNumber}`, MAX_FAILED_PER_PHONE);
    if (phoneCheck.blocked) {
      return NextResponse.json(
        { error: 'Too many registration attempts for this phone number. Please try again after 15 minutes.' },
        { status: 429 }
      );
    }

    if (ip !== 'unknown') {
      const ipCheck = checkRateLimit(`register:ip:${ip}`, MAX_FAILED_PER_IP);
      if (ipCheck.blocked) {
        return NextResponse.json(
          { error: 'Too many registration attempts from this IP. Please try again later.' },
          { status: 429 }
        );
      }
    }

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
    const allowedMimeTypes = ['application/pdf', 'image/jpeg'];

    if (idDocument.size > maxSize) {
      return NextResponse.json({ error: 'ID Document exceeds the 5MB limit.' }, { status: 400 });
    }
    if (!allowedMimeTypes.includes(idDocument.type)) {
      return NextResponse.json({ error: 'ID Document must be a JPG or PDF.' }, { status: 400 });
    }

    if (professionalDocument) {
      if (professionalDocument.size > maxSize) {
        return NextResponse.json({ error: 'Professional Document exceeds the 5MB limit.' }, { status: 400 });
      }
      if (!allowedMimeTypes.includes(professionalDocument.type)) {
        return NextResponse.json({ error: 'Professional Document must be a JPG or PDF.' }, { status: 400 });
      }
    }

    // Validate file content by magic bytes
    const idBytes = await idDocument.arrayBuffer();
    const idBuffer = Buffer.from(idBytes);
    const { valid: idValid, detectedType: idType } = validateFileMagicBytes(idBuffer);
    if (!idValid) {
      return NextResponse.json({ error: 'ID Document must be a valid PDF or JPEG.' }, { status: 400 });
    }

    let profValid = true;
    let profType = '';
    if (professionalDocument) {
      const profBytes = await professionalDocument.arrayBuffer();
      const profBuffer = Buffer.from(profBytes);
      const profValidation = validateFileMagicBytes(profBuffer);
      profValid = profValidation.valid;
      profType = profValidation.detectedType;
      if (!profValid) {
        return NextResponse.json({ error: 'Professional Document must be a valid PDF or JPEG.' }, { status: 400 });
      }
    }

    // NEW ASYNC FLOW: Save files locally and enqueue for analysis
    const idFileId = uuidv4();
    const idFilePath = await saveFileLocally(idDocument, idFileId);
    console.log(`[Register API] ID document saved locally: ${idFilePath}`);

    // Create FileAnalysis record for ID document
    const idAnalysisRecord = await FileAnalysis.create({
      fileId: idFileId,
      originalName: idDocument.name,
      mimeType: idType,
      size: idDocument.size,
      uploaderId: 'pending-user', // Will update after user creation
      status: 'pending',
      localPath: idFilePath,
      metadata: {
        type: 'id-document',
        userEmail: email,
        userRole: role,
      },
    });

    let profFileId: string | undefined;
    let profFilePath: string | undefined;
    let profAnalysisRecord: any;

    if (professionalDocument) {
      profFileId = uuidv4();
      profFilePath = await saveFileLocally(professionalDocument, profFileId);
      console.log(`[Register API] Professional document saved locally: ${profFilePath}`);

      // Create FileAnalysis record for professional document
      profAnalysisRecord = await FileAnalysis.create({
        fileId: profFileId,
        originalName: professionalDocument.name,
        mimeType: profType,
        size: professionalDocument.size,
        uploaderId: 'pending-user',
        status: 'pending',
        localPath: profFilePath,
        metadata: {
          type: 'professional-document',
          userEmail: email,
          userRole: role,
        },
      });
    }

    // Create user with analyzing status
    const userData: Record<string, unknown> = {
      fullName,
      email,
      phoneNumber,
      address,
      password,
      role,
      idDocumentType: idType,
      professionalDocumentType: profType || undefined,
      verificationStatus: 'analyzing', // Mark as analyzing documents
      analysisFileIds: [idFileId, ...(profFileId ? [profFileId] : [])], // Track analysis files
    };

    if (profFileId) {
      userData.professionalDocument = '';
    }

    const user = new User(userData);

    await user.save();

    // Update uploader IDs in analysis records
    await FileAnalysis.findByIdAndUpdate(idAnalysisRecord._id, {
      uploaderId: user.userId,
      'metadata.userId': user.userId,
    });

    if (profAnalysisRecord) {
      await FileAnalysis.findByIdAndUpdate(profAnalysisRecord._id, {
        uploaderId: user.userId,
        'metadata.userId': user.userId,
      });
    }

    // Enqueue files for analysis
    const idJobId = fileAnalysisQueue.enqueue(
      idFileId,
      idFilePath,
      idDocument.name,
      idType,
      idDocument.size,
      user.userId,
      { type: 'id-document', userId: user.userId, userEmail: email }
    );

    let profJobId: string | undefined;
    if (professionalDocument && profFileId && profFilePath) {
      profJobId = fileAnalysisQueue.enqueue(
        profFileId,
        profFilePath,
        professionalDocument.name,
        profType,
        professionalDocument.size,
        user.userId,
        { type: 'professional-document', userId: user.userId, userEmail: email }
      );
    }

    console.log(`[Register API] Files enqueued for analysis: id=${idJobId}, prof=${profJobId}`);

    // Log registration event (with pending status)
    try {
      await logUserRegistration(user.userId, user.role);
    } catch (auditError) {
      console.error('Failed to create audit log for registration:', auditError);
    }

    await Otp.deleteMany({ email });

    clearRateLimit(`register:email:${email}`);
    clearRateLimit(`register:phone:${phoneNumber}`);
    if (ip !== 'unknown') {
      clearRateLimit(`register:ip:${ip}`);
    }

    // Return 202 Accepted with analysis status URLs
    return NextResponse.json(
      {
        message: 'Registration successful! Documents are being analyzed for security. You will be notified once verification is complete.',
        user: {
          userId: user.userId,
          fullName: user.fullName,
          role: user.role,
          verificationStatus: user.verificationStatus,
        },
        analysisStatus: {
          idDocument: {
            fileId: idFileId,
            jobId: idJobId,
            statusUrl: `/api/internal/file-analysis/${idFileId}`,
          },
          ...(profFileId && profJobId ? {
            professionalDocument: {
              fileId: profFileId,
              jobId: profJobId,
              statusUrl: `/api/internal/file-analysis/${profFileId}`,
            }
          } : {}),
        },
      },
      { status: 202 } // HTTP 202 Accepted
    );

  } catch (error: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Registration API Error:', error);
    }
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
