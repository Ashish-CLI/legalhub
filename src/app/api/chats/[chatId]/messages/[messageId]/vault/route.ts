import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import { Chat } from "@/models/Chat";
import { Messages } from "@/models/Messages";
import Case from "@/models/Case";
import Vault from "@/models/Vault";
import Counter from "@/models/Counter";

async function generateVaultId(): Promise<string> {
  const counter = await Counter.findByIdAndUpdate(
    { _id: "VAULT" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `VLT${counter.seq.toString().padStart(6, "0")}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string; messageId: string }> }
) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();
    if (user.role !== "lawyer") {
      return ApiResponse.error("Only lawyers can add chat evidence to the vault.", 403);
    }

    const { chatId, messageId } = await params;
    if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(messageId)) {
      return ApiResponse.badRequest("Invalid chat or message id.");
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return ApiResponse.notFound("Chat");
    if (!chat.users.some((id: string) => id.toString() === user.userId)) {
      return ApiResponse.forbidden();
    }

    const message = await Messages.findOne({ _id: messageId, chatId });
    if (!message) return ApiResponse.notFound("Message");
    if (message.messageType !== "media" || !message.media?.url) {
      return ApiResponse.badRequest("Only media messages can be added to the vault.");
    }
    if (message.vault?.added) {
      return ApiResponse.badRequest("This media message is already in the vault.");
    }

    const otherUserId = chat.users.find((id: string) => id.toString() !== user.userId)?.toString();
    if (!otherUserId) return ApiResponse.badRequest("Could not determine the client for this chat.");

    const activeCase = await Case.findOne({
      status: "active",
      lawyerId: user.userId,
      clientId: otherUserId,
    }).sort({ updatedAt: -1 });

    if (!activeCase) {
      return ApiResponse.badRequest("No active accepted case was found for this chat.");
    }

    const vault = await Vault.findOneAndUpdate(
      { caseId: activeCase.caseId },
      {
        $setOnInsert: {
          vaultId: await generateVaultId(),
          caseId: activeCase.caseId,
          clientId: activeCase.clientId,
          lawyerId: activeCase.lawyerId,
          evidence: [],
          status: "active",
          createdDate: new Date(),
        },
        $set: {
          judgeId: activeCase.judgeId,
          updatedDate: new Date(),
        },
      },
      { new: true, upsert: true }
    );

    const sourceMessageId = String(message._id);
    const alreadyExists = vault.evidence.some((item) => item.sourceMessageId === sourceMessageId);
    if (!alreadyExists) {
      vault.evidence.push({
        sourceMessageId,
        uploadedBy: message.sender,
        url: message.media.url,
        publicId: message.media.publicId,
        originalName: message.media.originalName,
        type: message.media.type,
        addedAt: new Date(),
      });
      await vault.save();
    }

    activeCase.vaultId = vault._id;
    activeCase.updatedDate = new Date();
    await activeCase.save();

    message.vault = {
      added: true,
      vaultId: vault.vaultId,
      caseId: activeCase.caseId,
      addedAt: new Date(),
      addedBy: user.userId,
    };
    await message.save();

    return ApiResponse.success({ message, vaultId: vault.vaultId, caseId: activeCase.caseId });
  } catch (error) {
    console.error("POST /api/chats/[chatId]/messages/[messageId]/vault:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
