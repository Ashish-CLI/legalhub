import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { ApiResponse } from "@/lib/apiResponse";
import { connectDB } from "@/app/lib/db";
import { Chat } from "@/models/Chat";
import { Messages } from "@/models/Messages";
import cloudinary from "@/lib/cloudinary";


export async function GET(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    await connectDB();
    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const { chatId } = await params;
    
    const chat = await Chat.findById(chatId);
    if (!chat) return ApiResponse.notFound("Chat");

    if (!chat.users.some((id: any) => id.toString() === user.userId)) {
      return ApiResponse.forbidden();
    }

    // Fetch messages for this chat
    const messages = await Messages.find({ chatId }).sort({ createdAt: -1 }).limit(50);

    // Mark messages as seen if they belong to the other user
    const otherUserId = chat.users.find(
      (id: any) => id.toString() !== user.userId
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
    await connectDB();
    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const { chatId } = await params;
    
    // Find the chat and ensure the user is a participant
    const chat = await Chat.findById(chatId);
    if (!chat) return ApiResponse.notFound("Chat");

    if (!chat.users.some((id: any) => id.toString() === user.userId)) {
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
      // Upload file to Cloudinary
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Determine resource type based on MIME type
      let resourceType: "image" | "raw" = "raw";
      if (file.type.startsWith("image/")) {
        resourceType = "image";
      }
      
      const base64 = buffer.toString("base64");
      const uploadResult = await cloudinary.uploader.upload(
        `data:${file.type};base64,${base64}`,
        {
          folder: "chat_media",
          resource_type: resourceType,
        }
      );

      // Determine media type for our database
      let mediaType: "image" | "pdf" | "video" | "audio" | "file" = "file";
      if (file.type.startsWith("image/")) {
        mediaType = "image";
      } else if (file.type.includes("pdf")) {
        mediaType = "pdf";
      } else if (file.type.includes("video")) {
        mediaType = "video";
      } else if (file.type.includes("audio")) {
        mediaType = "audio";
      }

      media = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
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