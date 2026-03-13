import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IOtp extends Document {
  email: string;
  otp: string;
  ip?: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OtpSchema: Schema<IOtp> = new Schema({
  email: {
    type: String,
    required: true,
    index: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  otp: {
    type: String,
    required: true
  },
  ip: {
    type: String,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }
  },
  attempts: {
    type: Number,
    default: 0
  },
  verified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const Otp: Model<IOtp> = mongoose.models.Otp || mongoose.model<IOtp>('Otp', OtpSchema);

export default Otp;
