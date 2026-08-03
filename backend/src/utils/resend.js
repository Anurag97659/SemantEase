import { Resend } from "resend";

export const sendOtpEmail = async (
  toEmail,
  otp,
  subject = "Your Verification Code"
) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing in environment variables.");
  }

  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #6d28d9; margin: 0;">SemantEase Security Verification</h2>
      </div>
      <p style="color: #334155; font-size: 16px;">Hello,</p>
      <p style="color: #334155; font-size: 14px;">Your standard verification code for <strong>${subject}</strong> is:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #6d28d9; background-color: #f3e8ff; padding: 12px 24px; border-radius: 8px; border: 1px dashed #a855f7; display: inline-block;">
          ${otp}
        </span>
      </div>
      <p style="color: #64748b; font-size: 13px; text-align: center;">This OTP is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center;">If you did not request this code, please ignore this email.</p>
    </div>
  `;

  const data = await resend.emails.send({
    from: `SemantEase <${fromEmail}>`,
    to: [toEmail],
    subject: subject,
    html: htmlContent,
  });

  if (data.error) {
    throw new Error(data.error.message || "Failed to send email via Resend");
  }

  return data;
};
