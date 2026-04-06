import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { fetchUserById, fetchUsersByIds } from "@/lib/fetchUser";
import { ApiResponse } from "@/lib/apiResponse";
import { connectDB } from "@/app/lib/db";
import { Chat } from "@/models/Chat";
import { Messages } from "@/models/Messages";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    let user = getAuthUser(req);
    if (!user) {
      console.warn("No auth user detected – using dev placeholder user.");
      user = { _id: "devUser", userId: "devUser", email: "dev@example.com" } as any;
    }

    const body = await req.json();
    const { otherUserId } = body;

    if (!otherUserId) {
      return ApiResponse.badRequest("Other userId is required");
    }

    const userId = (user as any).userId || (user as any)._id;

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
        chat.users.find((id: any) => id.toString() !== userId)?.toString()
      )
      .filter(Boolean) as string[];

    const userMap = await fetchUsersByIds(otherUserIds);

    const chatWithUserData = await Promise.all(
      chats.map(async (chat) => {
        const otherUserId = chat.users
          .find((id: any) => id.toString() !== userId)
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