import { headers } from "next/headers";
import { IAuditLog } from "@/models/AuditLog";
import AuditLog from "@/models/AuditLog";

/**
 * Get client IP address from request headers
 */
export function getClientIP(headersList: Headers): string {
  // Check various headers that might contain the client IP
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIP = headersList.get("x-real-ip");
  if (realIP) return realIP.trim();

  // For development/local testing
  if (headersList.get("host")?.includes("localhost")) {
    return "127.0.0.1";
  }

  return "unknown";
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(headersList: Headers): string {
  return headersList.get("user-agent") || "unknown";
}

/**
 * Get user role from string
 */
export function getUserRoleFromRole(role: string): "client" | "lawyer" | "judge" | "admin" | undefined {
  const validRoles = ["client", "lawyer", "judge", "admin"] as const;
  if (validRoles.includes(role as typeof validRoles[number])) {
    return role as typeof validRoles[number];
  }
  return undefined;
}

/**
 * Create an audit log entry
 * @param userId - The ID of the user performing the action
 * @param otherUserId - The ID of another user involved in the action (optional)
 * @param action - The action description
 * @param entity - The type of entity involved (optional)
 * @param details - Additional details about the action (optional)
 * @param userRole - The role of the user performing the action (optional)
 * @param otherUserRole - The role of the other user involved (optional)
 * @param ipAddress - The IP address of the client (optional, auto-detected if not provided)
 * @param userAgent - The user agent of the client (optional, auto-detected if not provided)
 * @returns The created audit log entry
 */
export async function createAuditLog(
  userId: string,
  otherUserId: string | undefined,
  action: string,
  entity: IAuditLog["entity"] | undefined,
  details?: Record<string, unknown>,
  userRole?: "client" | "lawyer" | "judge" | "admin",
  otherUserRole?: "client" | "lawyer" | "judge" | "admin",
  ipAddress?: string,
  userAgent?: string
): Promise<IAuditLog> {
  try {
    const auditLog = new AuditLog({
      userId,
      otherUserId,
      action,
      entity,
      details,
      timestamp: new Date(),
      userRole,
      otherUserRole,
      ipAddress,
      userAgent,
    });
    
    await auditLog.save();
    return auditLog;
  } catch (error) {
    console.error("Error creating audit log:", error);
    throw error;
  }
}

/**
 * Create an audit log entry with auto-detected IP and user agent from headers
 */
export async function createAuditLogFromHeaders(
  userId: string,
  otherUserId: string | undefined,
  action: string,
  entity: IAuditLog["entity"] | undefined,
  details?: Record<string, unknown>,
  userRole?: "client" | "lawyer" | "judge" | "admin",
  otherUserRole?: "client" | "lawyer" | "judge" | "admin"
): Promise<IAuditLog> {
  const headersList = await headers();
  const ipAddress = getClientIP(headersList);
  const userAgent = getUserAgent(headersList);
  
  return createAuditLog(
    userId,
    otherUserId,
    action,
    entity,
    details,
    userRole,
    otherUserRole,
    ipAddress,
    userAgent
  );
}

/**
 * Log user login event
 */
export async function logUserLogin(userId: string, role: "client" | "lawyer" | "judge" | "admin"): Promise<IAuditLog> {
  return createAuditLog(userId, undefined, "User logged in", "login", { role }, role);
}

/**
 * Log user registration event
 */
export async function logUserRegistration(userId: string, role: "client" | "lawyer" | "judge" | "admin"): Promise<IAuditLog> {
  return createAuditLog(userId, undefined, "User registered", "register", { role }, role);
}

/**
 * Log password reset event
 */
export async function logPasswordReset(userId: string, role: "client" | "lawyer" | "judge" | "admin"): Promise<IAuditLog> {
  return createAuditLog(userId, undefined, "Password reset", "forgot_password", { role }, role);
}

/**
 * Log password change event
 */
export async function logPasswordChange(userId: string, role: "client" | "lawyer" | "judge" | "admin"): Promise<IAuditLog> {
  return createAuditLog(userId, undefined, "Password changed", "password_change", { role }, role);
}

/**
 * Log verification request event
 */
export async function logVerificationRequest(userId: string, role: "client" | "lawyer", details?: Record<string, unknown>): Promise<IAuditLog> {
  return createAuditLog(userId, undefined, "Verification request submitted", "verification_request", details, role);
}

/**
 * Log user verification approval/rejection event (admin action)
 */
export async function logUserVerification(
  targetUserId: string,
  status: "accepted" | "rejected",
  adminId: string
): Promise<IAuditLog> {
  return createAuditLog(
    adminId,
    targetUserId,
    status === "accepted" ? "Verification approved" : "Verification rejected",
    "user_verification",
    { status },
    "admin",
    undefined
  );
}

/**
 * Log case creation event
 */
export async function logCaseCreation(
  caseId: string,
  clientId: string,
  lawyerId: string,
  details?: Record<string, unknown>
): Promise<IAuditLog> {
  return createAuditLog(
    clientId,
    lawyerId,
    "Case created",
    "case_created",
    { caseId, ...details },
    "client",
    "lawyer"
  );
}

/**
 * Log vault access event
 */
export async function logVaultAccess(
  vaultId: string,
  userId: string,
  role: "client" | "lawyer" | "judge",
  action: string,
  details?: Record<string, unknown>
): Promise<IAuditLog> {
  return createAuditLog(
    userId,
    undefined,
    `Vault ${action}`,
    "vault_access",
    { vaultId, ...details },
    role
  );
}

/**
 * Log case assignment event
 */
export async function logCaseAssignment(
  caseId: string,
  lawyerId: string,
  details?: Record<string, unknown>
): Promise<IAuditLog> {
  return createAuditLog(
    lawyerId,
    undefined,
    "Case assigned to lawyer",
    "case_assignment",
    { caseId, ...details },
    "lawyer"
  );
}

/**
 * Log case update event
 */
export async function logCaseUpdate(
  caseId: string,
  userId: string,
  role: "client" | "lawyer" | "judge",
  details?: Record<string, unknown>
): Promise<IAuditLog> {
  return createAuditLog(
    userId,
    undefined,
    "Case updated",
    "case_update",
    { caseId, ...details },
    role
  );
}

/**
 * Log evidence upload event
 */
export async function logEvidenceUpload(
  vaultId: string,
  userId: string,
  role: "client" | "lawyer",
  fileName: string,
  fileType: string
): Promise<IAuditLog> {
  return createAuditLog(
    userId,
    undefined,
    "Evidence uploaded",
    "vault_upload",
    { vaultId, fileName, fileType },
    role
  );
}

/**
 * Log admin action event
 */
export async function logAdminAction(
  adminId: string,
  targetUserId: string,
  action: string,
  details?: Record<string, unknown>
): Promise<IAuditLog> {
  return createAuditLog(
    adminId,
    targetUserId,
    action,
    "admin_action",
    details,
    "admin",
    undefined
  );
}

/**
 * Log verification approval/rejection event
 */
export async function logVerificationResult(
  adminId: string,
  targetUserId: string,
  approved: boolean,
  details?: Record<string, unknown>
): Promise<IAuditLog> {
  return createAuditLog(
    adminId,
    targetUserId,
    approved ? "Verification approved" : "Verification rejected",
    "verification_request",
    { approved, ...details },
    "admin",
    undefined
  );
}

/**
 * Log case request response event (lawyer accepting/rejecting a case request)
 */
export async function logCaseRequestResponse(
  lawyerId: string,
  clientId: string,
  messageId: string,
  action: "accept" | "reject"
): Promise<IAuditLog> {
  return createAuditLog(
    lawyerId,
    clientId,
    action === "accept" ? "Case request accepted" : "Case request rejected",
    "user_request",
    { messageId, action },
    "lawyer",
    "client"
  );
}
