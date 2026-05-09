import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import { hasJudgeGrant } from "@/lib/vault-access";
import Case from "@/models/Case";
import Vault, { IVaultEvidence } from "@/models/Vault";
import User from "@/models/User";

export async function GET(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    if (user.role !== "judge") {
      return ApiResponse.error("Only judges can access this endpoint.", 403);
    }

    const { caseId } = await params;

    const caseItem = await Case.findOne({ caseId }).lean();
    if (!caseItem) return ApiResponse.notFound("Case");

    if (caseItem.judgeId !== user.userId) {
      return ApiResponse.forbidden();
    }

    const vault = await Vault.findOne({ caseId: caseItem.caseId }).lean();
    if (!vault) return ApiResponse.notFound("Vault");

    const judgeCanAccessVault = hasJudgeGrant(vault, caseItem.judgeId, user.userId);
    if (!judgeCanAccessVault) {
      return ApiResponse.badRequest("Vault access has not been granted to this judge yet.");
    }

    const vaultUsers = await User.find(
      { userId: { $in: [vault.clientId, vault.lawyerId] } },
      { userId: 1, fullName: 1, email: 1, role: 1, _id: 0 }
    ).lean();
    const userMap = new Map(vaultUsers.map((u) => [u.userId, u]));

    const evidenceWithMetadata = vault.evidence.map((item: IVaultEvidence) => ({
      _id: String(item._id),
      sourceMessageId: item.sourceMessageId,
      url: item.url,
      publicId: item.publicId,
      originalName: item.originalName,
      type: item.type,
      addedAt: item.addedAt,
      uploadedByUser: userMap.get(item.uploadedBy) || {
        userId: item.uploadedBy,
        fullName: "Unknown User",
        email: "",
        role: "unknown",
      },
    }));

    const response = {
      vaultId: vault.vaultId,
      caseId: vault.caseId,
      accessStatus: vault.accessStatus,
      evidenceCount: vault.evidence.length,
      evidence: evidenceWithMetadata,
      client: userMap.get(vault.clientId) || null,
      lawyer: userMap.get(vault.lawyerId) || null,
      openedAt: vault.openedAt,
      openedUntil: vault.openedUntil ?? null,
    };

    const apiResponse = ApiResponse.success(response);
    apiResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return apiResponse;
  } catch (error) {
    console.error("GET /api/cases/[caseId]/vault/judge:", error);
    return ApiResponse.error("Internal Server Error");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    if (user.role !== "judge") {
      return ApiResponse.error("Only judges can access this endpoint.", 403);
    }

    const { caseId } = await params;

    const caseItem = await Case.findOne({ caseId });
    if (!caseItem) return ApiResponse.notFound("Case");

    if (caseItem.judgeId !== user.userId) {
      return ApiResponse.forbidden();
    }

    const vault = await Vault.findOne({ caseId: caseItem.caseId });
    if (!vault) return ApiResponse.notFound("Vault");

    const judgeCanAccessVault = hasJudgeGrant(vault, caseItem.judgeId, user.userId);

    const apiResponse = ApiResponse.success({
      message: judgeCanAccessVault
        ? "Judge can view the vault."
        : "Judge is waiting for lawyer-granted vault access.",
      accessStatus: vault.accessStatus,
      canAccess: judgeCanAccessVault,
      openedUntil: vault.openedUntil ?? null,
    });
    apiResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return apiResponse;
  } catch (error) {
    console.error("POST /api/cases/[caseId]/vault/judge:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
