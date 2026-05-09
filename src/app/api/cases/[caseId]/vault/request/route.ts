import { NextRequest } from "next/server";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import Case from "@/models/Case";
import Vault from "@/models/Vault";
import User from "@/models/User";
import { getMailer } from "@/lib/email";
import { logVaultAccess } from "@/lib/audit";

const TEN_MINUTES = 10 * 60 * 1000;

function makeOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

async function sendVaultOtpEmail(to: string, otp: string, caseId: string): Promise<void> {
  await getMailer().sendMail({
    from: `"LegalHub" <${process.env.GMAIL_USER}>`,
    to,
    subject: `LegalHub - Vault Access Code for ${caseId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #f8fafc; border-radius: 16px;">
        <h1 style="color: #0f172a; margin: 0 0 12px;">LegalHub Vault Access</h1>
        <p style="color: #475569; font-size: 15px;">Use this code to verify your side of the dual OTP vault access request for case <strong>${caseId}</strong>.</p>
        <div style="margin: 24px 0; padding: 18px; border-radius: 12px; background: #e2e8f0; text-align: center;">
          <span style="font-size: 34px; letter-spacing: 8px; font-weight: 800; color: #0f172a;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">This code expires in <strong>10 minutes</strong>. The vault opens only after both client and lawyer verify their separate OTPs.</p>
      </div>
    `,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();

    const { caseId } = await params;
    const caseItem = await Case.findOne({ caseId, status: "active" });
    if (!caseItem) return ApiResponse.notFound("Active case");

    if (![caseItem.clientId, caseItem.lawyerId].includes(user.userId)) {
      return ApiResponse.forbidden();
    }

    const vault = await Vault.findOne({ caseId: caseItem.caseId });
    if (!vault) return ApiResponse.notFound("Vault");

    const [client, lawyer] = await Promise.all([
      User.findOne({ userId: caseItem.clientId }),
      User.findOne({ userId: caseItem.lawyerId }),
    ]);

    if (!client?.email || !lawyer?.email) {
      return ApiResponse.badRequest("Client and lawyer emails are required for vault OTP access.");
    }

    const clientOtp = makeOtp();
    const lawyerOtp = makeOtp();
    const now = Date.now();

    vault.accessStatus = "closed";
    vault.accessRequestedBy = user.userId;
    vault.accessRequestedAt = new Date(now);
    vault.clientOtpHash = await bcrypt.hash(clientOtp, 10);
    vault.lawyerOtpHash = await bcrypt.hash(lawyerOtp, 10);
    vault.clientOtpVerified = false;
    vault.lawyerOtpVerified = false;
    vault.clientOtpAttempts = 0;
    vault.lawyerOtpAttempts = 0;
    vault.otpExpiresAt = new Date(now + TEN_MINUTES);
    vault.openedAt = undefined;
    vault.openedUntil = undefined;
    vault.judgeAccessGranted = false;
    vault.judgeAccessGrantedAt = undefined;
    vault.judgeAccessGrantedBy = undefined;
    await vault.save();

     await Promise.all([
       sendVaultOtpEmail(client.email, clientOtp, caseItem.caseId),
       sendVaultOtpEmail(lawyer.email, lawyerOtp, caseItem.caseId),
     ]);

     // Log vault access request
     try {
       await logVaultAccess(
         vault.vaultId,
         user.userId,
         user.role as "client" | "lawyer" | "judge",
         "accessed",
         { caseId: caseItem.caseId, otpRequested: true }
       );
     } catch (auditError) {
       console.error("Failed to create audit log for vault access:", auditError);
     }

     return ApiResponse.success({
       message: "Vault OTPs sent to client and lawyer.",
       expiresAt: vault.otpExpiresAt,
     });
  } catch (error) {
    console.error("POST /api/cases/[caseId]/vault/request:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
