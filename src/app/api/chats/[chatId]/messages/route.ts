import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { ApiResponse } from "@/lib/apiResponse";
import { connectDB } from "@/app/lib/db";
import { Chat } from "@/models/Chat";
import { Messages } from "@/models/Messages";
import cloudinary from "@/lib/cloudinary";
import mongoose from "mongoose";

const MAX_CHAT_MEDIA_SIZE = 20 * 1024 * 1024;
const MAX_CHAT_REQUEST_SIZE = 22 * 1024 * 1024;

type ChatMediaType = "image" | "pdf" | "video" | "audio" | "file";
type CloudinaryResourceType = "image" | "video" | "raw";

function detectMediaType(buffer: Buffer): ChatMediaType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image";
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "pdf";
  }

  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    return "video";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  ) {
    return "audio";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0x49 &&
    buffer[1] === 0x44 &&
    buffer[2] === 0x33
  ) {
    return "audio";
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return "audio";
  }

  return null;
}

function resourceTypeForMedia(type: ChatMediaType): CloudinaryResourceType {
  if (type === "image") return "image";
  if (type === "video" || type === "audio") return "video";
  return "raw";
}


export async function GET(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    await connectDB();
    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const { chatId } = await params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return ApiResponse.badRequest("Invalid chat id.");
    }
    
    const chat = await Chat.findById(chatId);
    if (!chat) return ApiResponse.notFound("Chat");

    if (!chat.users.some((id: string) => id.toString() === user.userId)) {
      return ApiResponse.forbidden();
    }

    const messages = (await Messages.find({ chatId }).sort({ createdAt: -1 }).limit(50)).reverse();

    // Mark messages as seen if they belong to the other user
    const otherUserId = chat.users.find(
      (id: string) => id.toString() !== user.userId
    );

    if (otherUserId) {
      await Messages.updateMany(
        {
          chatId,
          sender: otherUserId.toString(),
          seen: false,
        },
        {
          seen: true,
          seenAt: new Date(),
        }
      );
    }

    return ApiResponse.success({ messages });
  } catch (error) {
    console.error("GET /api/chats/[chatId]/messages:", error);
    return ApiResponse.error("Internal Server Error");
  }
}

// POST /api/chats/[chatId]/messages
export async function POST(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_CHAT_REQUEST_SIZE) {
      return ApiResponse.error("Request too large. Maximum chat media size is 20MB.", 413);
    }

    await connectDB();
    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const { chatId } = await params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return ApiResponse.badRequest("Invalid chat id.");
    }
    
    // Find the chat and ensure the user is a participant
    const chat = await Chat.findById(chatId);
    if (!chat) return ApiResponse.notFound("Chat");

    if (!chat.users.some((id: string) => id.toString() === user.userId)) {
      return ApiResponse.forbidden();
    }

    const formData = await req.formData();
    const text = formData.get("text") as string | null;
    const file = formData.get("file") as File | null;

    // Validate that either text or file is provided
    if (!text && !file) {
      return ApiResponse.badRequest("Either text or file is required");
    }

    let media = null;
    if (file) {
      if (file.size > MAX_CHAT_MEDIA_SIZE) {
        return ApiResponse.badRequest("Chat media exceeds the 20MB limit.");
      }

      // Upload file to Cloudinary
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const mediaType = detectMediaType(buffer);
      if (!mediaType) {
        return ApiResponse.badRequest("Unsupported or invalid media file. Upload a valid image, PDF, video, or audio file.");
      }
      const resourceType = resourceTypeForMedia(mediaType);
      
      const base64 = buffer.toString("base64");
      const uploadResult = await cloudinary.uploader.upload(
        `data:${file.type};base64,${base64}`,
        {
          folder: "chat_media",
          resource_type: resourceType,
        }
      );

      media = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        originalName: file.name,
        type: mediaType,
      };
    }

    // Create the new message
    const messageType = media ? "media" : "text";
    const newMessage = await Messages.create({
      chatId,
      sender: user.userId,
      text: text || undefined,
      media: media || undefined,
      messageType,
    });

    // Update the chat's latest message
    chat.latestMessage = {
      text: text || (media ? `${media.type} file` : "Attachment"),
      sender: user.userId,
    };
    await chat.save();

    return ApiResponse.success({ message: newMessage }, 201);
  } catch (error) {
    console.error("POST /api/chats/[chatId]/messages:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
