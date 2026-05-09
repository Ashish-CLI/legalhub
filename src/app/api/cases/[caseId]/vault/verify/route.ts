import { NextRequest } from "next/server";
import Vault from "@/models/Vault";

import { getAuthUser } from "@/lib/auth";
import { logVaultAccess } from "@/lib/audit";
import bcrypt from "bcrypt";
import { ApiResponse } from "@/lib/apiResponse";

const MAX_OPTAITEMPS = 5;

async function verifyOtp(otp: string, hash?: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(otp, hash);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const body = await req.json();
    const { otp, type } = body; // type should be 'client' or 'lawyer'

    if (!otp || !type || !["client", "lawyer"].includes(type)) {
      return ApiResponse.badRequest("Invalid request payload");
    }

    const { caseId } = await params;
    const vault = await Vault.findOne({ caseId });
    if (!vault) return ApiResponse.notFound("Vault" );

    // Ensure vault is closed and OTPs still exist
    if (vault.accessStatus !== "closed") {
      return ApiResponse.forbidden();
    }

    const currentTime = Date.now();
    if (vault.otpExpiresAt && currentTime > vault.otpExpiresAt.getTime()) {
      return ApiResponse.forbidden();
    }

    // Determine which hash to use based on role
    let hashField: string | undefined;
    let verifiedFlag: "clientOtpVerified" | "lawyerOtpVerified";
    let attemptsField: "clientOtpAttempts" | "lawyerOtpAttempts";
    let role: string;

    if (type === "client") {
      hashField = vault.clientOtpHash;
      verifiedFlag = "clientOtpVerified";
      attemptsField = "clientOtpAttempts";
      role = "client";
    } else {
      hashField = vault.lawyerOtpHash;
      verifiedFlag = "lawyerOtpVerified";
      attemptsField = "lawyerOtpAttempts";
      role = "lawyer";
    }

    const isMatch = await verifyOtp(otp, hashField);

    if (!isMatch) {
      // Increment attempts
      vault[attemptsField] += 1;
      await vault.save();

      if (vault[attemptsField] >= MAX_OPTAITEMPS) {
        return ApiResponse.forbidden();
      }

      return ApiResponse.forbidden();
    }

    // Set verified flag
    vault[verifiedFlag] = true;
    await vault.save();

    // If both verified, open the vault
    if (vault.clientOtpVerified && vault.lawyerOtpVerified) {
      vault.accessStatus = "open";
      vault.openedAt = new Date();
      await vault.save();
    }

    // Log audit
    try {
      await logVaultAccess(
        vault.vaultId,
        user.userId,
        user.role as "client" | "lawyer" | "judge",
        "verified",
        {
          caseId: vault.caseId,
          otpVerified: true,
          otpType: type,
        }
      );
    } catch (auditError) {
      console.error("Failed to create audit log for vault access:", auditError);
    }

    return ApiResponse.success({ alreadyOpen: !!(vault.clientOtpVerified && vault.lawyerOtpVerified) });
  } catch (error) {
    console.error("POST /api/cases/[caseId]/vault/verify:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
