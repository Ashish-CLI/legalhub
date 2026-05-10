import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import Counter from './Counter';

export interface IUser extends Document {
  userId: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  password: string;
  address: string;
  role: 'client' | 'lawyer' | 'judge' | 'admin';
  idDocument?: string;
  idDocumentType?: string;
  professionalDocument?: string;
  professionalDocumentType?: string;
  profileImage?: string;
  verificationStatus: 'pending' | 'analyzing' | 'accepted' | 'rejected';
  analysisFileIds?: string[]; // Track files being analyzed
  caseCount?: number;
  lastSeen?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema({
  userId: {
    type: String,
    unique: true
  },
  fullName: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^\+91[6-9]\d{9}$/, 'Please enter a valid Indian phone number starting with +91']
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  address: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['client', 'lawyer', 'judge', 'admin'],
    required: true,
    default: 'client'
  },
  idDocument: {
    type: String,
    required: false
  },
  idDocumentType: {
    type: String,
    required: false
  },
  professionalDocument: {
    type: String,
    required: function (this: IUser) {
      return ['lawyer', 'judge', 'admin'].includes(this.role);
    }
  },
  professionalDocumentType: {
    type: String,
    required: false
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'analyzing', 'accepted', 'rejected'],
    default: 'pending'
  },
  analysisFileIds: [{
    type: String,
    ref: 'FileAnalysis'
  }],
  caseCount: {
    type: Number,
    min: 0,
    max: 3
  },
  profileImage: {
    type: String,
    required: false,
    default: '/default.jpg'
  },
  lastSeen: {
    type: Date,
    required: false,
    index: true
  }
}, { timestamps: true });

UserSchema.pre('save', async function () {
  if (this.isNew) {
    if (this.role === 'judge') {
      this.caseCount = this.caseCount ?? 0;
    } else {
      this.caseCount = undefined;
    }
  }

  if (!this.userId) {
    const prefixes: Record<string, string> = {
      client: 'C',
      lawyer: 'L',
      judge: 'J',
      admin: 'A'
    };
    const prefix = prefixes[this.role] || 'U';

    const counter = await Counter.findByIdAndUpdate(
      { _id: prefix },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    );

    const num = counter?.seq || 1;
    const seq = num.toString().padStart(4, '0');
    this.userId = `${prefix}${seq}`;
  }

  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

if (mongoose.models.User) {
  delete mongoose.models.User;
}

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
