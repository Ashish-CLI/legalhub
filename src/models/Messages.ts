import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMessage extends Document {
  chatId: Types.ObjectId;
  sender: string;
  text?: string;
  media?: {
    url: string;
    publicId: string;
    originalName?: string;
    type: "image" | "pdf" | "video" | "audio" | "file";
  };
  caseRequest?: {
    status: "pending" | "accepted" | "rejected" | "filed";
    clientId: string;
    lawyerId: string;
    caseId?: string;
    requestedAt: Date;
    respondedAt?: Date;
    filedAt?: Date;
  };
  vault?: {
    added: boolean;
    vaultId?: string;
    caseId?: string;
    addedAt?: Date;
    addedBy?: string;
  };
  messageType: "text" | "media" | "case_request";
  seen: boolean;
  seenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IMessage>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: String,
      required: true,
    },
    text: String,
    media: {
      url: String,
      publicId: String,
      originalName: String,
      type: { type: String, enum: ["image", "pdf", "video", "audio", "file"] },
    },
    caseRequest: {
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected", "filed"],
      },
      clientId: String,
      lawyerId: String,
      caseId: String,
      requestedAt: Date,
      respondedAt: Date,
      filedAt: Date,
    },
    vault: {
      added: {
        type: Boolean,
        default: false,
      },
      vaultId: String,
      caseId: String,
      addedAt: Date,
      addedBy: String,
    },
    messageType: {
      type: String,
      enum: ["text", "media", "case_request"],
      default: "text",
    },
    seen: {
      type: Boolean,
      default: false,
    },
    seenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Messages = mongoose.models.Messages || mongoose.model<IMessage>("Messages", schema);
