import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMessage extends Document {
  chatId: Types.ObjectId;
  sender: string;
  text?: string;
  media?: {
    url: string;
    publicId: string;
    type: "image" | "pdf" | "video" | "audio" | "file";
  };
  messageType: "text" | "media";
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
      type: { type: String, enum: ["image", "pdf", "video", "audio", "file"] },
    },
    messageType: {
      type: String,
      enum: ["text", "media"],
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

export const Messages = mongoose.model<IMessage>("Messages", schema);
