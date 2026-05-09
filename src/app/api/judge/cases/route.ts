import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import { hasJudgeGrant } from "@/lib/vault-access";
import Case from "@/models/Case";
import Vault, { IVaultEvidence } from "@/models/Vault";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    if (user.role !== "judge") {
      return ApiResponse.forbidden("Only judges can access this endpoint.");
    }

    const cases = await Case.find({ judgeId: user.userId }).lean().exec();

    const result = await Promise.all(
      cases.map(async (c) => {
        const vault = await Vault.findOne({ caseId: c.caseId }).lean().exec();
        const judgeCanAccessVault = hasJudgeGrant(vault, c.judgeId, user.userId);
        const evidence = judgeCanAccessVault && vault
          ? vault.evidence.map((e: IVaultEvidence) => ({
              _id: String(e._id),
              type: e.type,
              originalName: e.originalName,
            }))
          : [];

        return {
          caseId: c.caseId,
          title: c.title,
          description: c.description,
          status: c.status,
          clientId: c.clientId,
          lawyerId: c.lawyerId,
          caseFile: c.caseFile,
          decision: c.decision ? {
            summary: c.decision.summary,
            decidedAt: c.decision.decidedAt,
            judgeId: c.decision.judgeId,
          } : null,
          vault: vault ? {
            vaultId: vault.vaultId,
            canAccess: judgeCanAccessVault,
            judgeAccessGranted: hasJudgeGrant(vault, c.judgeId),
            openedUntil: vault.openedUntil ?? null,
            evidenceCount: vault.evidence.length,
            evidence,
          } : null,
        };
      })
    );

    const response = ApiResponse.success({ cases: result });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (err) {
    console.error("GET /api/judge/cases:", err);
    return ApiResponse.error("Internal Server Error");
  }
}
