import { Resend } from "resend";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing in environment variables.");
  }

  return new Resend(apiKey);
};

export const sendOtpEmail = async (
  toEmail,
  otp,
  subject = "Your Verification Code"
) => {
  const resend = getResendClient();
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

export const sendSuggestionNotificationEmail = async (toEmail, suggestion) => {
  const resend = getResendClient();
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const submittedAt = new Date(suggestion.createdAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  const category = escapeHtml(suggestion.category);
  const title = escapeHtml(suggestion.title);
  const username = escapeHtml(suggestion.username);
  const message = escapeHtml(suggestion.message).replace(/\r?\n/g, "<br />");

  const data = await resend.emails.send({
    from: `SemantEase <${fromEmail}>`,
    to: [toEmail],
    subject: `New suggestion: ${suggestion.title}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1e293b;">
        <h2 style="margin: 0 0 16px; color: #6d28d9;">New suggestion received</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: 600; width: 150px;">From</td><td style="padding: 8px;">${username}</td></tr>
          <tr style="background: #f8fafc;"><td style="padding: 8px; font-weight: 600;">Category</td><td style="padding: 8px;">${category}</td></tr>
          <tr><td style="padding: 8px; font-weight: 600;">Title</td><td style="padding: 8px;">${title}</td></tr>
          <tr style="background: #f8fafc;"><td style="padding: 8px; font-weight: 600;">Status</td><td style="padding: 8px;">Pending</td></tr>
          <tr><td style="padding: 8px; font-weight: 600;">Submitted</td><td style="padding: 8px;">${submittedAt} IST</td></tr>
        </table>
        <h3 style="margin: 24px 0 8px;">Details</h3>
        <div style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; line-height: 1.6;">${message}</div>
      </div>
    `,
  });

  if (data.error) {
    throw new Error(data.error.message || "Failed to send suggestion notification via Resend");
  }

  return data;
};
