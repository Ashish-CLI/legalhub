import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import Case from "@/models/Case";
import { Messages } from "@/models/Messages";
import User from "@/models/User";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  tone: "amber" | "blue" | "emerald" | "rose" | "slate";
  createdAt?: Date;
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const notifications: NotificationItem[] = [];

    if (user.role === "lawyer") {
      const [requests, cases] = await Promise.all([
        Messages.find({
          messageType: "case_request",
          "caseRequest.lawyerId": user.userId,
          "caseRequest.status": { $in: ["pending", "filed"] },
        })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
        Case.find({ lawyerId: user.userId, status: { $in: ["pending", "active", "rejected"] } })
          .sort({ updatedAt: -1 })
          .limit(8)
          .lean(),
      ]);

      const clientIds = Array.from(new Set([
        ...requests.map((request) => request.caseRequest?.clientId).filter(Boolean),
        ...cases.map((caseItem) => caseItem.clientId).filter(Boolean),
      ]));
      const clients = await User.find(
        { userId: { $in: clientIds } },
        { userId: 1, fullName: 1, _id: 0 }
      ).lean();
      const clientMap = new Map(clients.map((client) => [client.userId, client.fullName]));

      requests.forEach((request) => {
        const clientId = request.caseRequest?.clientId || "Client";
        const clientName = clientMap.get(clientId) || clientId;
        notifications.push({
          id: String(request._id),
          title: request.caseRequest?.status === "filed" ? "Case filed for admin review" : "New case request",
          description: request.caseRequest?.status === "filed"
            ? `${clientName}'s case has been filed and is waiting for admin verification.`
            : `${clientName} requested you to accept and file a case.`,
          tone: request.caseRequest?.status === "filed" ? "blue" : "amber",
          createdAt: request.createdAt,
        });
      });

      cases.forEach((caseItem) => {
        const clientName = clientMap.get(caseItem.clientId) || caseItem.clientId;
        const statusText = caseItem.status === "active"
          ? "accepted by admin"
          : caseItem.status === "rejected"
            ? "rejected by admin"
            : "waiting for admin verification";

        notifications.push({
          id: caseItem.caseId,
          title: `Case ${statusText}`,
          description: `${caseItem.title} for ${clientName} is ${statusText}.`,
          tone: caseItem.status === "active" ? "emerald" : caseItem.status === "rejected" ? "rose" : "blue",
          createdAt: caseItem.updatedDate,
        });
      });
    }

    if (user.role === "admin") {
      const [pendingUsers, pendingCases] = await Promise.all([
        User.find({ verificationStatus: "pending" })
          .select("userId fullName role createdAt")
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
        Case.find({ status: "pending" })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
      ]);

      pendingUsers.forEach((pendingUser) => {
        notifications.push({
          id: pendingUser.userId,
          title: "User verification request",
          description: `${pendingUser.fullName} registered as ${pendingUser.role} and is waiting for verification.`,
          tone: "amber",
          createdAt: pendingUser.createdAt,
        });
      });

      pendingCases.forEach((caseItem) => {
        notifications.push({
          id: caseItem.caseId,
          title: "Case verification request",
          description: `${caseItem.title} is waiting for admin review and judge assignment.`,
          tone: "blue",
          createdAt: caseItem.openDate,
        });
      });
    }

    notifications.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return ApiResponse.success({
      notifications: notifications.slice(0, 12),
    });
  } catch (error) {
    console.error("GET /api/dashboard/notifications:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
