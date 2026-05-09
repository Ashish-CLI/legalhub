import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import Case from "@/models/Case";
import User from "@/models/User";

interface LeanCase {
  _id: unknown;
  caseId: string;
  title: string;
  description: string;
  clientId: string;
  lawyerId: string;
  caseFile: string;
  status: string;
  openDate?: Date;
  createdAt?: Date;
}

interface LeanUser {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  caseCount?: number;
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();
    if (user.role !== "admin") return ApiResponse.error("Only admins can view submitted cases.", 403);

    const cases = await Case.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .lean<LeanCase[]>();

    const participantIds = Array.from(new Set(cases.flatMap((caseItem) => [caseItem.clientId, caseItem.lawyerId])));
    const participants = await User.find(
      { userId: { $in: participantIds } },
      { userId: 1, fullName: 1, email: 1, role: 1, _id: 0 }
    ).lean<LeanUser[]>();

    const participantMap = new Map(participants.map((participant) => [participant.userId, participant]));

    const judges = await User.find(
      {
        role: "judge",
        verificationStatus: "accepted",
        $or: [{ caseCount: { $lt: 3 } }, { caseCount: { $exists: false } }],
      },
      { userId: 1, fullName: 1, email: 1, role: 1, caseCount: 1, _id: 0 }
    )
      .sort({ caseCount: 1, fullName: 1 })
      .lean<LeanUser[]>();

    const activeCounts = await Case.aggregate<{ _id: string; count: number }>([
      { $match: { status: "active", judgeId: { $exists: true, $ne: null } } },
      { $group: { _id: "$judgeId", count: { $sum: 1 } } },
    ]);
    const activeCountMap = new Map(activeCounts.map((entry) => [entry._id, entry.count]));

    const eligibleJudges = judges
      .map((judge) => ({
        userId: judge.userId,
        fullName: judge.fullName,
        email: judge.email,
        activeCaseCount: activeCountMap.get(judge.userId) ?? judge.caseCount ?? 0,
      }))
      .filter((judge) => judge.activeCaseCount < 3);

    const reviewCases = cases.map((caseItem) => ({
      _id: String(caseItem._id),
      caseId: caseItem.caseId,
      title: caseItem.title,
      description: caseItem.description,
      clientId: caseItem.clientId,
      lawyerId: caseItem.lawyerId,
      caseFile: caseItem.caseFile,
      status: caseItem.status,
      submittedAt: caseItem.createdAt ?? caseItem.openDate,
      client: participantMap.get(caseItem.clientId) ?? null,
      lawyer: participantMap.get(caseItem.lawyerId) ?? null,
    }));

    return ApiResponse.success({ cases: reviewCases, judges: eligibleJudges });
  } catch (error) {
    console.error("GET /api/admin/cases:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
