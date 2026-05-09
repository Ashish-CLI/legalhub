import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import User from "@/models/User";

const ONLINE_WINDOW_MS = 90 * 1000;

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS);
    const users = await User.find(
      { lastSeen: { $gte: onlineSince } },
      { userId: 1, _id: 0 }
    ).lean();

    return ApiResponse.success({
      onlineUserIds: users.map((onlineUser) => onlineUser.userId),
    });
  } catch (error) {
    console.error("GET /api/users/presence:", error);
    return ApiResponse.error("Internal Server Error");
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    await User.updateOne(
      { userId: user.userId },
      { $set: { lastSeen: new Date() } }
    );

    return ApiResponse.success({ ok: true });
  } catch (error) {
    console.error("POST /api/users/presence:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
