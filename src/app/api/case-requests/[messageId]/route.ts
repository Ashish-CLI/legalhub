import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import { Messages } from "@/models/Messages";
import { logCaseRequestResponse } from "@/lib/audit";
import mongoose from "mongoose";

export async function GET(req: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const { messageId } = await params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return ApiResponse.badRequest("Invalid case request id.");
    }

    const message = await Messages.findById(messageId);
    if (!message || message.messageType !== "case_request" || !message.caseRequest) {
      return ApiResponse.notFound("Case request");
    }

    const { clientId, lawyerId } = message.caseRequest;
    if (![clientId, lawyerId].includes(user.userId)) {
      return ApiResponse.forbidden();
    }

    return ApiResponse.success({ message });
  } catch (error) {
    console.error("GET /api/case-requests/[messageId]:", error);
    return ApiResponse.error("Internal Server Error");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();
    if (user.role !== "lawyer") {
      return ApiResponse.error("Only lawyers can respond to case requests.", 403);
    }

    const body = await req.json();
    const action = body?.action;
    if (!["accept", "reject"].includes(action)) {
      return ApiResponse.badRequest("Action must be accept or reject.");
    }

    const { messageId } = await params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return ApiResponse.badRequest("Invalid case request id.");
    }

    const message = await Messages.findById(messageId);
    if (!message || message.messageType !== "case_request" || !message.caseRequest) {
      return ApiResponse.notFound("Case request");
    }

    if (message.caseRequest.lawyerId !== user.userId) {
      return ApiResponse.forbidden();
    }

    if (message.caseRequest.status !== "pending") {
      return ApiResponse.badRequest("This case request has already been responded to.");
    }

    message.caseRequest.status = action === "accept" ? "accepted" : "rejected";
    message.caseRequest.respondedAt = new Date();
    await message.save();

    // Log case request response action
    try {
      await logCaseRequestResponse(
        user.userId,
        message.caseRequest.clientId,
        message._id.toString(),
        action
      );
    } catch (auditError) {
      console.error("Failed to create audit log for case request response:", auditError);
    }

    return ApiResponse.success({ message });
  } catch (error) {
    console.error("POST /api/case-requests/[messageId]:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
