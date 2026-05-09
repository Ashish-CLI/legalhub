import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let mailer: Transporter | null = null;

function getMailer(): Transporter {
  if (!mailer) {
    mailer = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return mailer;
}

interface SendOtpOptions {
  to: string;
  otp: string;
  purpose?: 'registration' | 'password-reset' | 'vault-access';
}

export async function sendOtp({ to, otp, purpose = 'registration' }: SendOtpOptions): Promise<void> {
  const subject = purpose === 'registration'
    ? 'LegalHub — Verify Your Email'
    : 'LegalHub — Password Reset Code';

  const action = purpose === 'registration'
    ? 'complete your registration'
    : 'reset your password';

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 28px; font-weight: 700; color: #1e293b; margin: 0;">
          Legal<span style="color: #2563eb;">Hub</span>
        </h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">India's Digital Legal Platform</p>
      </div>
      
      <div style="background: white; border-radius: 12px; padding: 32px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
          Use the following code to ${action}:
        </p>
        
        <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1e293b;">
            ${otp}
          </span>
        </div>
        
        <p style="color: #94a3b8; font-size: 13px; margin-bottom: 0;">
          This code expires in <strong>5 minutes</strong>. Do not share it with anyone.
        </p>
      </div>
      
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
        If you didn't request this code, please ignore this email.
      </p>
    </div>
  `;

  await getMailer().sendMail({
    from: `"LegalHub" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

export { getMailer };
