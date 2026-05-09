import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IVaultEvidence {
  _id?: Types.ObjectId;
  sourceMessageId?: string;
  uploadedBy: string;
  url: string;
  publicId?: string;
  originalName?: string;
  type: "image" | "pdf" | "video" | "audio" | "file";
  addedAt: Date;
}

export interface IVault extends Document {
  vaultId: string;
  caseId: string;
  clientId: string;
  lawyerId: string;
  judgeId?: string;
  judgeAccessGranted: boolean;
  judgeAccessGrantedAt?: Date;
  judgeAccessGrantedBy?: string;
  evidence: IVaultEvidence[];
  status: "active" | "sealed" | "transferred";
  accessStatus: "closed" | "open";
  accessRequestedBy?: string;
  accessRequestedAt?: Date;
  clientOtpHash?: string;
  lawyerOtpHash?: string;
  clientOtpVerified: boolean;
  lawyerOtpVerified: boolean;
  clientOtpAttempts: number;
  lawyerOtpAttempts: number;
  otpExpiresAt?: Date;
  openedAt?: Date;
  openedUntil?: Date;
  createdDate: Date;
  updatedDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EvidenceSchema = new Schema<IVaultEvidence>(
  {
    sourceMessageId: {
      type: String,
      index: true,
    },
    uploadedBy: {
      type: String,
      required: true,
      ref: "User",
    },
    url: {
      type: String,
      required: true,
    },
    publicId: String,
    originalName: String,
    type: {
      type: String,
      enum: ["image", "pdf", "video", "audio", "file"],
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const VaultSchema: Schema<IVault> = new Schema(
  {
    vaultId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    caseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      ref: "Case",
    },
    clientId: {
      type: String,
      required: true,
      ref: "User",
      index: true,
    },
    lawyerId: {
      type: String,
      required: true,
      ref: "User",
      index: true,
    },
    judgeId: {
      type: String,
      ref: "User",
      index: true,
    },
    judgeAccessGranted: {
      type: Boolean,
      default: false,
      index: true,
    },
    judgeAccessGrantedAt: Date,
    judgeAccessGrantedBy: {
      type: String,
      ref: "User",
    },
    evidence: {
      type: [EvidenceSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "sealed", "transferred"],
      default: "active",
    },
    accessStatus: {
      type: String,
      enum: ["closed", "open"],
      default: "closed",
      index: true,
    },
    accessRequestedBy: {
      type: String,
      ref: "User",
    },
    accessRequestedAt: Date,
    clientOtpHash: String,
    lawyerOtpHash: String,
    clientOtpVerified: {
      type: Boolean,
      default: false,
    },
    lawyerOtpVerified: {
      type: Boolean,
      default: false,
    },
    clientOtpAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lawyerOtpAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    otpExpiresAt: Date,
    openedAt: Date,
    openedUntil: Date,
    createdDate: {
      type: Date,
      default: Date.now,
    },
    updatedDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

VaultSchema.pre("save", function () {
  this.updatedDate = new Date();
});

const Vault: Model<IVault> = mongoose.models.Vault || mongoose.model<IVault>("Vault", VaultSchema);

export default Vault;
