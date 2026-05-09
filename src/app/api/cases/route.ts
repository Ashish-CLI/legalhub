import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import cloudinary from "@/lib/cloudinary";
import Counter from "@/models/Counter";
import Case from "@/models/Case";
import { Messages } from "@/models/Messages";
import Vault from "@/models/Vault";
import User from "@/models/User";
import { logCaseCreation } from "@/lib/audit";
import { hasJudgeGrant } from "@/lib/vault-access";

const MAX_CASE_FILE_SIZE = 20 * 1024 * 1024;
const MAX_REQUEST_SIZE = 22 * 1024 * 1024;

function isPdfByMagicBytes(buffer: Buffer): boolean {
  return buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/[^\w.\-]/g, "_")
    .slice(0, 100);
}

async function generateCaseId(): Promise<string> {
  const counter = await Counter.findByIdAndUpdate(
    { _id: "CASE" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `CASE${counter.seq.toString().padStart(6, "0")}`;
}

async function uploadCaseFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  if (!isPdfByMagicBytes(buffer)) {
    throw new Error("Case file must be a valid PDF document.");
  }

  const safeName = sanitizeFilename(file.name).replace(/\.[^.]+$/, "");

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: "legalhub/case-files",
        resource_type: "raw",
        public_id: safeName || "case-file",
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error("Upload failed"));
        }
      }
    ).end(buffer);
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_REQUEST_SIZE) {
      return ApiResponse.badRequest("Request too large. Maximum case file size is 20MB.");
    }

    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();
    if (user.role !== "lawyer") {
      return ApiResponse.error("Only lawyers can file accepted case requests.", 403);
    }

    const formData = await req.formData();
    const requestId = (formData.get("caseRequestMessageId") || "").toString();
    const title = (formData.get("title") || "").toString().trim();
    const description = (formData.get("description") || "").toString().trim();
    const caseFile = formData.get("caseFile") as File | null;

    if (!requestId) return ApiResponse.badRequest("Case request id is required.");
    if (title.length < 3 || title.length > 150) {
      return ApiResponse.badRequest("Title must be between 3 and 150 characters.");
    }
    if (description.length < 20 || description.length > 5000) {
      return ApiResponse.badRequest("Description must be between 20 and 5000 characters.");
    }
    if (!caseFile) return ApiResponse.badRequest("Case file PDF is required.");
    if (caseFile.size > MAX_CASE_FILE_SIZE) {
      return ApiResponse.badRequest("Case file exceeds the 20MB limit.");
    }

    const requestMessage = await Messages.findById(requestId);
    if (!requestMessage || requestMessage.messageType !== "case_request" || !requestMessage.caseRequest) {
      return ApiResponse.notFound("Case request");
    }
    if (requestMessage.caseRequest.lawyerId !== user.userId) {
      return ApiResponse.forbidden();
    }
    if (requestMessage.caseRequest.status !== "accepted") {
      return ApiResponse.badRequest("Only accepted case requests can be filed.");
    }
    if (requestMessage.caseRequest.caseId) {
      return ApiResponse.badRequest("This case request has already been filed.");
    }

    const caseFileUrl = await uploadCaseFile(caseFile);
    const caseId = await generateCaseId();

    const createdCase = await Case.create({
      caseId,
      title,
      description,
      clientId: requestMessage.caseRequest.clientId,
      lawyerId: requestMessage.caseRequest.lawyerId,
      caseFile: caseFileUrl,
      status: "pending",
    });

    requestMessage.caseRequest.status = "filed";
    requestMessage.caseRequest.caseId = createdCase.caseId;
    requestMessage.caseRequest.filedAt = new Date();
    await requestMessage.save();

    // Log case creation
    try {
      await logCaseCreation(
        createdCase.caseId,
        createdCase.clientId,
        createdCase.lawyerId,
        { caseFile: createdCase.caseFile }
      );
    } catch (auditError) {
      console.error("Failed to create audit log for case creation:", auditError);
    }

    return ApiResponse.success({ case: createdCase, message: requestMessage }, 201);
  } catch (error) {
    console.error("POST /api/cases:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(message);
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const filter = user.role === "client"
      ? { clientId: user.userId }
      : user.role === "lawyer"
        ? { lawyerId: user.userId }
        : user.role === "judge"
          ? { judgeId: user.userId }
          : {};

    if (!["client", "lawyer", "judge", "admin"].includes(user.role)) {
      return ApiResponse.forbidden();
    }

    const cases = await Case.find(filter).sort({ updatedAt: -1 }).lean();
    const userIds = Array.from(
      new Set(
        cases
          .flatMap((caseItem) => [caseItem.clientId, caseItem.lawyerId, caseItem.judgeId])
          .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)
      )
    );
    const users = await User.find(
      { userId: { $in: userIds } },
      { userId: 1, fullName: 1, email: 1, role: 1, _id: 0 }
    ).lean();
    const userMap = new Map(users.map((caseUser) => [caseUser.userId, caseUser]));

    const vaults = await Vault.find({ caseId: { $in: cases.map((caseItem) => caseItem.caseId) } }).lean();
    const vaultMap = new Map(vaults.map((vault) => [vault.caseId, vault]));
    const now = Date.now();

    const responseCases = cases.map((caseItem) => {
      const vault = vaultMap.get(caseItem.caseId);
      const isVaultOpen = Boolean(vault?.accessStatus === "open" && vault.openedUntil && new Date(vault.openedUntil).getTime() > now);
      const evidence = isVaultOpen && vault
        ? vault.evidence.map((item) => ({
            _id: String(item._id),
            sourceMessageId: item.sourceMessageId,
            uploadedBy: item.uploadedBy,
            publicId: item.publicId,
            originalName: item.originalName,
            type: item.type,
            addedAt: item.addedAt,
          }))
        : [];

      return {
        _id: String(caseItem._id),
        caseId: caseItem.caseId,
        title: caseItem.title,
        description: caseItem.description,
        status: caseItem.status,
        caseFile: caseItem.caseFile,
        clientId: caseItem.clientId,
        lawyerId: caseItem.lawyerId,
        judgeId: caseItem.judgeId,
        openDate: caseItem.openDate,
        closeDate: caseItem.closeDate,
        updatedDate: caseItem.updatedDate,
        decision: caseItem.decision ? {
          summary: caseItem.decision.summary,
          decidedAt: caseItem.decision.decidedAt,
          judgeId: caseItem.decision.judgeId,
        } : null,
        client: userMap.get(caseItem.clientId) || null,
        lawyer: userMap.get(caseItem.lawyerId) || null,
        judge: caseItem.judgeId ? userMap.get(caseItem.judgeId) || null : null,
        vault: vault ? {
          vaultId: vault.vaultId,
          accessStatus: isVaultOpen ? "open" : "closed",
          judgeAccessGranted: hasJudgeGrant(vault, caseItem.judgeId),
          clientOtpVerified: vault.clientOtpVerified,
          lawyerOtpVerified: vault.lawyerOtpVerified,
          openedUntil: isVaultOpen ? vault.openedUntil : null,
          evidenceCount: vault.evidence.length,
          evidence,
        } : null,
      };
    });

    return ApiResponse.success({ cases: responseCases });
  } catch (error) {
    console.error("GET /api/cases:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
