import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import Case from "@/models/Case";
import Vault from "@/models/Vault";
import { logVaultAccess } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const { caseId } = await params;
    const body = await req.json();
    const { judgeId } = body;

    if (!judgeId || typeof judgeId !== "string") {
      return ApiResponse.badRequest("Judge ID is required.");
    }

    const caseItem = await Case.findOne({ caseId, status: "active" });
    if (!caseItem) return ApiResponse.notFound("Active case");

    if (caseItem.lawyerId !== user.userId) {
      return ApiResponse.forbidden();
    }

    const vault = await Vault.findOne({ caseId: caseItem.caseId });
    if (!vault) return ApiResponse.notFound("Vault");

    vault.judgeId = judgeId;
    vault.accessStatus = "open";
    vault.openedAt = new Date();
    vault.openedUntil = new Date(Date.now() + 15 * 60 * 1000);
    vault.judgeAccessGranted = true;
    vault.judgeAccessGrantedAt = new Date();
    vault.judgeAccessGrantedBy = user.userId;
    await vault.save();

    // Log vault access for judge granting
    try {
      await logVaultAccess(
        vault.vaultId,
        user.userId,
        "lawyer",
        "granted judge access",
        { judgeId, caseId }
      );
    } catch (auditError) {
      console.error("Failed to create audit log for judge access grant:", auditError);
    }

    return ApiResponse.success({
      message: "Judge granted access to the vault.",
      vault: {
        vaultId: vault.vaultId,
        accessStatus: vault.accessStatus,
        openedUntil: vault.openedUntil,
      },
    });
  } catch (error) {
    console.error("POST /api/cases/[caseId]/vault/grant-judge:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
