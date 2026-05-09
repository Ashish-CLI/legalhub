import { ApiResponse } from "@/lib/apiResponse";
import { connectDB } from "@/app/lib/db";
import Case from "@/models/Case";
import User from "@/models/User";

export async function GET() {
  try {
    await connectDB();

    const decidedCases = await Case.find(
      { "decision.summary": { $exists: true, $ne: "" } },
      {
        caseId: 1,
        title: 1,
        description: 1,
        clientId: 1,
        lawyerId: 1,
        judgeId: 1,
        status: 1,
        closeDate: 1,
        decision: 1,
      }
    )
      .sort({ "decision.decidedAt": -1, updatedAt: -1 })
      .lean();

    const userIds = Array.from(
      new Set(
        decidedCases
          .flatMap((caseItem) => [caseItem.clientId, caseItem.lawyerId, caseItem.judgeId, caseItem.decision?.judgeId])
          .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)
      )
    );

    const users = await User.find(
      { userId: { $in: userIds } },
      { userId: 1, fullName: 1, _id: 0 }
    ).lean();

    const userMap = new Map(users.map((user) => [user.userId, user]));

    const notices = decidedCases.map((caseItem) => ({
      caseId: caseItem.caseId,
      title: caseItem.title,
      description: caseItem.description,
      client: {
        userId: caseItem.clientId,
        fullName: userMap.get(caseItem.clientId)?.fullName || caseItem.clientId || "Client unavailable",
      },
      lawyer: {
        userId: caseItem.lawyerId,
        fullName: userMap.get(caseItem.lawyerId)?.fullName || caseItem.lawyerId || "Lawyer unavailable",
      },
      judge: {
        userId: caseItem.judgeId || caseItem.decision?.judgeId || "",
        fullName: caseItem.judgeId
          ? userMap.get(caseItem.judgeId)?.fullName || caseItem.judgeId
          : caseItem.decision?.judgeId
            ? userMap.get(caseItem.decision.judgeId)?.fullName || caseItem.decision.judgeId
            : "Judge unavailable",
      },
      status: caseItem.status,
      closeDate: caseItem.closeDate ?? null,
      decision: caseItem.decision ? {
        summary: caseItem.decision.summary,
        decidedAt: caseItem.decision.decidedAt,
        judgeId: caseItem.decision.judgeId,
        judgeName: caseItem.decision.judgeId
          ? userMap.get(caseItem.decision.judgeId)?.fullName || caseItem.decision.judgeId
          : "Judge unavailable",
      } : null,
    }));

    return ApiResponse.success({ notices });
  } catch (error) {
    console.error("GET /api/notice-board:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
