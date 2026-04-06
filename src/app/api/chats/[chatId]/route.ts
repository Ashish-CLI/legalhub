import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { fetchUserById } from "@/lib/fetchUser";
import { ApiResponse } from "@/lib/apiResponse";
import { connectDB } from "@/app/lib/db";
import { Chat } from "@/models/Chat";

export async function GET(req: NextRequest, { params }: { params: { chatId: string } }) {
  try {
    await connectDB();
    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const { chatId } = params;
    const chat = await Chat.findById(chatId);
    if (!chat) return ApiResponse.notFound("Chat");

    if (!chat.users.some((id: any) => id.toString() === user.userId)) {
      return ApiResponse.forbidden();
    }

    const otherUserId = chat.users.find((id: any) => id.toString() !== user.userId)?.toString();
    let otherUser = null;
    if (otherUserId) {
      otherUser = await fetchUserById(otherUserId);
    }

    return ApiResponse.success({
      chat: { ...chat.toObject(), otherUser: otherUser || { _id: otherUserId, name: "Unknown User" } },
    });
  } catch (e) {
    console.error("GET /api/chats/[chatId]:", e);
    return ApiResponse.error("Internal Server Error");
  }
}
