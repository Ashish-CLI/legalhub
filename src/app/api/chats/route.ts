import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { fetchUsersByIds } from "@/lib/fetchUser";
import { ApiResponse } from "@/lib/apiResponse";
import { connectDB } from "@/app/lib/db";
import { Chat } from "@/models/Chat";
import { Messages } from "@/models/Messages";
import Counter from "@/models/Counter";

async function generateChatId(): Promise<string> {
  const counter = await Counter.findByIdAndUpdate(
    { _id: "CHAT" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `CH${counter.seq.toString().padStart(6, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const body = await req.json();
    const { otherUserId } = body;

    if (!otherUserId) {
      return ApiResponse.badRequest("Other userId is required");
    }

    const userId = user.userId;

    const existingChat = await Chat.findOne({
      users: { $all: [userId, otherUserId], $size: 2 },
    });

    if (existingChat) {
      return ApiResponse.success({
        message: "Chat already exists",
        chatId: existingChat._id,
      });
    }

    const newChat = await Chat.create({
      chatId: await generateChatId(),
      users: [userId, otherUserId],
    });

    return ApiResponse.success(
      { message: "New Chat created", chatId: newChat._id },
      201
    );
  } catch (error) {
    console.error("POST /api/chats:", error);
    return ApiResponse.error("Internal Server Error");
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const { userId } = user;

    const chats = await Chat.find({ users: userId }).sort({ updatedAt: -1 });

    const otherUserIds = chats
      .map((chat) =>
        chat.users.find((id: string) => id.toString() !== userId)?.toString()
      )
      .filter(Boolean) as string[];

    const userMap = await fetchUsersByIds(otherUserIds);

    const chatWithUserData = await Promise.all(
      chats.map(async (chat) => {
        const otherUserId = chat.users
          .find((id: string) => id.toString() !== userId)
          ?.toString();

        const unseenCount = await Messages.countDocuments({
          chatId: chat._id,
          sender: { $ne: userId },
          seen: false,
        });

        const userData = otherUserId
          ? userMap.get(otherUserId) ?? { _id: otherUserId, name: "Unknown User" }
          : { _id: otherUserId, name: "Unknown User" };
        
        return {
          user: userData,
          chat: {
            ...chat.toObject(),
            latestMessage: chat.latestMessage || null,
            unseenCount,
          },
        };
      })
    );

    return ApiResponse.success({ chats: chatWithUserData });
  } catch (error) {
    console.error("GET /api/chats:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
