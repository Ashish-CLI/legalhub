import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import { hasJudgeGrant } from "@/lib/vault-access";
import Case from "@/models/Case";
import Vault, { IVaultEvidence } from "@/models/Vault";
import { Messages } from "@/models/Messages";
import { logVaultAccess } from "@/lib/audit";

function isVaultOpen(vault: { accessStatus: string; openedUntil?: Date }): boolean {
  return Boolean(vault.accessStatus === "open" && vault.openedUntil && vault.openedUntil.getTime() > Date.now());
}

function contentTypeForEvidence(type: IVaultEvidence["type"], upstreamContentType: string | null): string {
  if (upstreamContentType && upstreamContentType !== "application/octet-stream") return upstreamContentType;

  const fallback: Record<IVaultEvidence["type"], string> = {
    image: "image/jpeg",
    pdf: "application/pdf",
    video: "video/mp4",
    audio: "audio/mpeg",
    file: "application/octet-stream",
  };

  return fallback[type];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string; evidenceId: string }> }
) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const { caseId, evidenceId } = await params;
    const caseItem = await Case.findOne({ caseId, status: "active" });
    if (!caseItem) return ApiResponse.notFound("Active case");

    const canViewAsParty = [caseItem.clientId, caseItem.lawyerId].includes(user.userId);
    const canViewAsJudge = user.role === "judge" && caseItem.judgeId === user.userId;
    if (!canViewAsParty && !canViewAsJudge) {
      return ApiResponse.forbidden();
    }

    const vault = await Vault.findOne({ caseId: caseItem.caseId });
    if (!vault) return ApiResponse.notFound("Vault");

    const hasAccess = canViewAsJudge
      ? hasJudgeGrant(vault, caseItem.judgeId, user.userId)
      : isVaultOpen(vault);
    if (!hasAccess) {
      return ApiResponse.error(
        canViewAsJudge ? "Judge does not have vault access." : "Vault is not open.",
        403
      );
    }

    const evidence = vault.evidence.find((item) => String(item._id) === evidenceId) || null;
    if (!evidence) return ApiResponse.notFound("Evidence");

    const fileResponse = await fetch(evidence.url);
    if (!fileResponse.ok) return ApiResponse.error("Unable to load evidence.", 502);

    const bytes = await fileResponse.arrayBuffer();
    const filename = (evidence.originalName || `${evidenceId}.${evidence.type}`).replace(/"/g, "");

    // Log vault access for evidence viewing
    try {
      await logVaultAccess(
        vault.vaultId,
        user.userId,
        user.userId === caseItem.clientId ? "client" : user.userId === caseItem.lawyerId ? "lawyer" : "judge",
        "viewed evidence",
        { evidenceId: evidenceId, evidenceType: evidence.type }
      );
    } catch (auditError) {
      console.error("Failed to create audit log for evidence view:", auditError);
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentTypeForEvidence(evidence.type, fileResponse.headers.get("content-type")),
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/cases/[caseId]/vault/evidence/[evidenceId]:", error);
    return ApiResponse.error("Internal Server Error");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string; evidenceId: string }> }
) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();
    if (user.role !== "lawyer") {
      return ApiResponse.error("Only lawyers can remove evidence from the vault.", 403);
    }

    const { caseId, evidenceId } = await params;
    const caseItem = await Case.findOne({ caseId, status: "active" });
    if (!caseItem) return ApiResponse.notFound("Active case");
    if (caseItem.lawyerId !== user.userId) return ApiResponse.forbidden();

    const vault = await Vault.findOne({ caseId: caseItem.caseId });
    if (!vault) return ApiResponse.notFound("Vault");
    if (!isVaultOpen(vault)) return ApiResponse.error("Vault must be open to remove evidence.", 403);
    if (hasJudgeGrant(vault, caseItem.judgeId)) {
      return ApiResponse.error("Evidence cannot be removed after the vault has been sent to the judge.", 403);
    }

    const evidenceIndex = vault.evidence.findIndex((item) => String(item._id) === evidenceId);
    if (evidenceIndex === -1) return ApiResponse.notFound("Evidence");

    const evidence = vault.evidence[evidenceIndex];
    const sourceMessageId = evidence.sourceMessageId;
    vault.evidence.splice(evidenceIndex, 1);
    await vault.save();

    // Log vault access for evidence deletion
    try {
      await logVaultAccess(
        vault.vaultId,
        user.userId,
        "lawyer",
        "removed evidence",
        { evidenceId: evidenceId, evidenceType: evidence.type }
      );
    } catch (auditError) {
      console.error("Failed to create audit log for evidence removal:", auditError);
    }

    if (sourceMessageId) {
      await Messages.updateOne(
        { _id: sourceMessageId },
        {
          $set: {
            "vault.added": false,
          },
          $unset: {
            "vault.vaultId": "",
            "vault.caseId": "",
            "vault.addedAt": "",
            "vault.addedBy": "",
          },
        }
      );
    }

    return ApiResponse.success({ message: "Evidence removed from vault." });
  } catch (error) {
    console.error("DELETE /api/cases/[caseId]/vault/evidence/[evidenceId]:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
