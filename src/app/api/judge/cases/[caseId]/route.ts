import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import { hasJudgeGrant } from "@/lib/vault-access";
import Case from "@/models/Case";
import Vault, { IVaultEvidence } from "@/models/Vault";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    await connectDB();
    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();
    if (user.role !== "judge") {
      return ApiResponse.forbidden();
    }

    const { caseId } = await params;
    if (!caseId) {
      return ApiResponse.badRequest("caseId is required");
    }

    const c = await Case.findOne({ caseId }).lean().exec();
    if (!c) {
      return ApiResponse.notFound("Case");
    }

    if (c.judgeId !== user.userId) {
      return ApiResponse.forbidden();
    }

    const vault = await Vault.findOne({ caseId: c.caseId }).lean().exec();
    const judgeCanAccessVault = hasJudgeGrant(vault, c.judgeId, user.userId);
    const evidence = judgeCanAccessVault && vault
      ? vault.evidence.map((e: IVaultEvidence) => ({
          _id: String(e._id),
          type: e.type,
          originalName: e.originalName,
        }))
      : [];

    const result = {
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

    return ApiResponse.success(result);
  } catch (err) {
    console.error("GET /api/judge/cases/[caseId]", err);
    return ApiResponse.error("Internal Server Error");
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    await connectDB();
    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();
    if (user.role !== "judge") {
      return ApiResponse.forbidden("Only judges can submit a decision.");
    }

    const { caseId } = await params;
    if (!caseId) {
      return ApiResponse.badRequest("caseId is required");
    }

    const body = await req.json().catch(() => null);
    const summary = (body?.summary || "").toString().trim();

    if (summary.length < 20 || summary.length > 5000) {
      return ApiResponse.badRequest("Decision description must be between 20 and 5000 characters.");
    }

    const caseItem = await Case.findOne({ caseId }).exec();
    if (!caseItem) {
      return ApiResponse.notFound("Case");
    }

    if (caseItem.judgeId !== user.userId) {
      return ApiResponse.forbidden("You are not assigned to this case.");
    }

    const decidedAt = new Date();
    const decision = {
      summary,
      decidedAt,
      judgeId: user.userId,
    };

    await Case.updateOne(
      { caseId },
      {
        $set: {
          decision,
          status: "closed",
          closeDate: decidedAt,
          updatedDate: decidedAt,
        },
      },
      { strict: false }
    ).exec();

    const updatedCase = await Case.findOne({ caseId }).lean().exec();
    if (!updatedCase?.decision?.summary) {
      return ApiResponse.error("Decision could not be saved. Please try again.");
    }

    return ApiResponse.success({
      message: "Decision published to the notice board.",
      decision: {
        summary: updatedCase.decision.summary,
        decidedAt: updatedCase.decision.decidedAt,
        judgeId: updatedCase.decision.judgeId,
      },
      case: {
        caseId: updatedCase.caseId,
        status: updatedCase.status,
        closeDate: updatedCase.closeDate,
      },
    });
  } catch (err) {
    console.error("POST /api/judge/cases/[caseId]", err);
    return ApiResponse.error("Internal Server Error");
  }
}
