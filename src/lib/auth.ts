import { NextRequest } from "next/server";

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

export function getAuthUser(req: NextRequest): AuthUser | null {
  const userId = req.headers.get("x-user-id");
  const email = req.headers.get("x-user-email");
  const role = req.headers.get("x-user-role");

  if (!userId || !email) {
    return null;
  }

  return {
    userId,
    email,
    role: role || "user",
  };
}

export function requireRole(
  req: NextRequest,
  allowedRoles: string[]
): AuthUser | null {
  const user = getAuthUser(req);
  if (!user) return null;
  if (!allowedRoles.includes(user.role)) return null;
  return user;
}