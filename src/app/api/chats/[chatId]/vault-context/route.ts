import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import { Chat } from "@/models/Chat";
import Case from "@/models/Case";
import Vault from "@/models/Vault";

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

    const [firstUserId, secondUserId] = chat.users.map((id: string) => id.toString());
    const activeCase = await Case.findOne({
      status: "active",
      $or: [
        { clientId: firstUserId, lawyerId: secondUserId },
        { clientId: secondUserId, lawyerId: firstUserId },
      ],
    }).sort({ updatedAt: -1 });

    if (!activeCase) {
      return ApiResponse.success({ activeCase: null });
    }

    const vault = await Vault.findOne({ caseId: activeCase.caseId });

    return ApiResponse.success({
      activeCase: {
        caseId: activeCase.caseId,
        title: activeCase.title,
        clientId: activeCase.clientId,
        lawyerId: activeCase.lawyerId,
        vaultId: vault?.vaultId || null,
      },
    });
  } catch (error) {
    console.error("GET /api/chats/[chatId]/vault-context:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
