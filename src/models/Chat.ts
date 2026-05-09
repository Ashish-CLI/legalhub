import mongoose, { Document, Schema } from "mongoose";

export interface IChat extends Document {
  chatId: string;
  users: string[];
  latestMessage: {
    text: string;
    sender: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const schema: Schema<IChat> = new Schema(
  {
    chatId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    users: [{ type: String, ref: "User", required: true }],
    latestMessage: {
      text: String,
      sender: String,
    },
  },
  {
    timestamps: true,
  }
);

export const Chat = mongoose.models.Chat || mongoose.model<IChat>("Chat", schema);
