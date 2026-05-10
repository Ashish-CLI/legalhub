import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IFileAnalysis extends Document {
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploaderId: string;
  status: 'pending' | 'safe' | 'unsafe' | 'error';
  localPath: string;
  cuckooTaskId?: string;
  verdict?: {
    safe: boolean;
    threatLevel?: 'low' | 'medium' | 'high' | 'critical';
    malware?: boolean;
    behaviors?: string[];
    timestamp: Date;
    report?: object;
  };
  cloudinaryUrl?: string;
  errorMessage?: string;
  metadata?: {
    chatId?: string;
    caseId?: string;
    type?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const FileAnalysisSchema: Schema<IFileAnalysis> = new Schema(
  {
    fileId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    uploaderId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'safe', 'unsafe', 'error'],
      default: 'pending',
      index: true,
    },
    localPath: {
      type: String,
      required: true,
    },
    cuckooTaskId: {
      type: String,
      index: true,
    },
    verdict: {
      type: {
        safe: Boolean,
        threatLevel: {
          type: String,
          enum: ['low', 'medium', 'high', 'critical'],
        },
        malware: Boolean,
        behaviors: [String],
        timestamp: Date,
        report: Schema.Types.Mixed,
      },
      default: null,
    },
    cloudinaryUrl: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// TTL index: automatically delete records after 30 days
FileAnalysisSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 2592000 } // 30 days
);

const FileAnalysis: Model<IFileAnalysis> =
  mongoose.models.FileAnalysis || mongoose.model<IFileAnalysis>('FileAnalysis', FileAnalysisSchema);

export default FileAnalysis;
