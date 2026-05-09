import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import Case from "@/models/Case";
import User from "@/models/User";
import Vault from "@/models/Vault";
import Counter from "@/models/Counter";
import { logAdminAction } from "@/lib/audit";

async function generateVaultId(): Promise<string> {
  const counter = await Counter.findByIdAndUpdate(
    { _id: "VAULT" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `VLT${counter.seq.toString().padStart(6, "0")}`;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();
    if (user.role !== "admin") return ApiResponse.error("Only admins can review cases.", 403);

    const { caseId } = await params;
    const body = await req.json();
    const action = body?.action;

    if (!["accept", "reject"].includes(action)) {
      return ApiResponse.badRequest("Action must be accept or reject.");
    }

    const caseItem = await Case.findOne({ caseId });
    if (!caseItem) return ApiResponse.notFound("Case");

    if (caseItem.status !== "pending") {
      return ApiResponse.badRequest(`Case is already ${caseItem.status}.`);
    }

    if (action === "reject") {
      caseItem.status = "rejected";
      caseItem.acceptedByAdminId = user.userId;
      caseItem.updatedDate = new Date();
      caseItem.closeDate = new Date();
      await caseItem.save();

      try {
        await logAdminAction(user.userId, caseItem.clientId, "Case rejected by admin", {
          caseId: caseItem.caseId,
          lawyerId: caseItem.lawyerId,
          status: caseItem.status,
          title: caseItem.title,
        });
      } catch (auditError) {
        console.error("Failed to create audit log for case rejection:", auditError);
      }

      return ApiResponse.success({ case: caseItem, message: "Case rejected successfully." });
    }

    const judgeId = typeof body?.judgeId === "string" ? body.judgeId.trim() : "";
    if (!judgeId) return ApiResponse.badRequest("Judge is required when accepting a case.");

    const judge = await User.findOne({ userId: judgeId, role: "judge", verificationStatus: "accepted" });
    if (!judge) return ApiResponse.badRequest("Selected judge is not available.");

    const activeCaseCount = await Case.countDocuments({ judgeId, status: "active" });
    if (activeCaseCount >= 3 || (typeof judge.caseCount === "number" && judge.caseCount >= 3)) {
      return ApiResponse.badRequest("Selected judge already has 3 active cases.");
    }

    caseItem.status = "active";
    caseItem.judgeId = judgeId;
    caseItem.acceptedByAdminId = user.userId;
    caseItem.updatedDate = new Date();

    const vault = await Vault.findOneAndUpdate(
      { caseId: caseItem.caseId },
      {
        $setOnInsert: {
          vaultId: await generateVaultId(),
          caseId: caseItem.caseId,
          clientId: caseItem.clientId,
          lawyerId: caseItem.lawyerId,
          evidence: [],
          status: "active",
          createdDate: new Date(),
        },
        $set: {
          judgeId,
          updatedDate: new Date(),
        },
      },
      { new: true, upsert: true }
    );

    caseItem.vaultId = vault._id;
    await caseItem.save();

    judge.caseCount = activeCaseCount + 1;
    await judge.save();

    try {
      await logAdminAction(user.userId, judgeId, "Case accepted and assigned by admin", {
        caseId: caseItem.caseId,
        clientId: caseItem.clientId,
        lawyerId: caseItem.lawyerId,
        judgeId,
        status: caseItem.status,
        title: caseItem.title,
        vaultId: vault.vaultId,
      });
    } catch (auditError) {
      console.error("Failed to create audit log for case acceptance:", auditError);
    }

    return ApiResponse.success({ case: caseItem, message: "Case accepted and assigned successfully." });
  } catch (error) {
    console.error("PUT /api/admin/cases/[caseId]:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
