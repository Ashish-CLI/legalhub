import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import { Chat } from "@/models/Chat";
import { Messages } from "@/models/Messages";
import User from "@/models/User";
import mongoose from "mongoose";

export async function POST(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();
    if (user.role !== "client") {
      return ApiResponse.error("Only clients can send case requests.", 403);
    }

    const client = await User.findOne({ userId: user.userId });
    if (!client || client.role !== "client") {
      return ApiResponse.error("Only clients can send case requests.", 403);
    }
    if (client.verificationStatus !== "accepted") {
      return ApiResponse.error("Your client account must be verified before filing a case.", 403);
    }

    const { chatId } = await params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return ApiResponse.badRequest("Invalid chat id.");
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return ApiResponse.notFound("Chat");

    if (!chat.users.some((id: string) => id.toString() === user.userId)) {
      return ApiResponse.forbidden();
    }

    const lawyerId = chat.users.find((id: string) => id.toString() !== user.userId)?.toString();
    if (!lawyerId) return ApiResponse.badRequest("Could not determine the lawyer for this chat.");

    const lawyer = await User.findOne({ userId: lawyerId });
    if (!lawyer || lawyer.role !== "lawyer" || lawyer.verificationStatus !== "accepted") {
      return ApiResponse.badRequest("Case requests can only be sent to verified lawyers.");
    }

    const existingOpenRequest = await Messages.findOne({
      chatId,
      messageType: "case_request",
      "caseRequest.clientId": user.userId,
      "caseRequest.lawyerId": lawyerId,
      "caseRequest.status": { $in: ["pending", "accepted"] },
    });

    if (existingOpenRequest) {
      return ApiResponse.badRequest("A case request is already pending or accepted in this chat.");
    }

    const message = await Messages.create({
      chatId,
      sender: user.userId,
      text: "Case filing request",
      messageType: "case_request",
      caseRequest: {
        status: "pending",
        clientId: user.userId,
        lawyerId,
        requestedAt: new Date(),
      },
    });

    chat.latestMessage = {
      text: "Case filing request",
      sender: user.userId,
    };
    await chat.save();

    return ApiResponse.success({ message }, 201);
  } catch (error) {
    console.error("POST /api/chats/[chatId]/case-request:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
