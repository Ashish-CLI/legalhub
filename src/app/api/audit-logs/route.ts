import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import AuditLog from "@/models/AuditLog";
import User from "@/models/User";
import { SortOrder } from "mongoose";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    // Only admins can view all audit logs
    if (user.role !== "admin") {
      return ApiResponse.forbidden();
    }

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const searchQuery = (searchParams.get("search") || "").trim();
    const actionFilter = searchParams.get("action") || "";
    const entityFilter = searchParams.get("entity") || searchParams.get("type") || "";
    const categoryFilter = searchParams.get("category") || "";
    const userIdFilter = searchParams.get("userId") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const andFilters: Record<string, unknown>[] = [];

    if (searchQuery) {
      const searchRegex = new RegExp(searchQuery, "i");
      const matchedUsers = await User.find({
        $or: [
          { fullName: searchRegex },
          { email: searchRegex },
          { userId: searchRegex },
        ],
      })
        .select("userId")
        .lean();

      const matchedUserIds = matchedUsers.map((matchedUser) => matchedUser.userId);

      andFilters.push({
        $or: [
          { auditLogId: searchRegex },
          { action: searchRegex },
          { entity: searchRegex },
          { "details.caseId": searchRegex },
          { "details.evidenceId": searchRegex },
          { "details.fileName": searchRegex },
          { "details.messageId": searchRegex },
          { "details.status": searchRegex },
          { "details.vaultId": searchRegex },
          { ipAddress: searchRegex },
          { userId: searchRegex },
          { otherUserId: searchRegex },
          ...(matchedUserIds.length > 0
            ? [
                { userId: { $in: matchedUserIds } },
                { otherUserId: { $in: matchedUserIds } },
              ]
            : []),
        ],
      });
    }

    if (actionFilter) {
      andFilters.push({ action: actionFilter });
    }

    if (entityFilter) {
      andFilters.push({ entity: entityFilter });
    }

    if (categoryFilter) {
      andFilters.push({ $or: [{ userRole: categoryFilter }, { otherUserRole: categoryFilter }] });
    }

    if (userIdFilter) {
      andFilters.push({ $or: [{ userId: userIdFilter }, { otherUserId: userIdFilter }] });
    }

    if (startDate || endDate) {
      const createdAtFilter: Record<string, Date> = {};

      if (startDate) {
        createdAtFilter.$gte = new Date(`${startDate}T00:00:00.000Z`);
      }

      if (endDate) {
        createdAtFilter.$lte = new Date(`${endDate}T23:59:59.999Z`);
      }

      andFilters.push({ createdAt: createdAtFilter });
    }

    const filter = andFilters.length > 0 ? { $and: andFilters } : {};

    const sort: Record<string, SortOrder> = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count
    const totalCount = await AuditLog.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);

    // Get audit logs with pagination
    const auditLogs = await AuditLog.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const participantIds = Array.from(
      new Set(
        auditLogs
          .flatMap((log) => [log.userId, log.otherUserId])
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    );

    const users = participantIds.length
      ? await User.find({ userId: { $in: participantIds } }).select("userId fullName email role").lean()
      : [];

    const userMap = new Map(users.map((participant) => [participant.userId, participant]));

    const auditLogsWithDetails = auditLogs.map((log) => {
      const userDoc = log.userId ? userMap.get(log.userId) : null;
      const otherUserDoc = log.otherUserId ? userMap.get(log.otherUserId) : null;

      return {
        ...log,
        timestamp: log.timestamp || log.createdAt,
        userName: userDoc?.fullName || log.userId || "Unknown user",
        userEmail: userDoc?.email || (log.userId ? "Email unavailable" : ""),
        userRole: userDoc?.role || log.userRole || "Unknown",
        otherUserName: otherUserDoc?.fullName || log.otherUserId || "No related user",
        otherUserEmail: otherUserDoc?.email || (log.otherUserId ? "Email unavailable" : ""),
        otherUserRole: otherUserDoc?.role || log.otherUserRole || "Unknown",
      };
    });

    return ApiResponse.success({
      auditLogs: auditLogsWithDetails,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error("GET /api/audit-logs:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
