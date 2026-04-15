import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendEmailOptions {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(
  options: SendEmailOptions,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const fromName = process.env.SMTP_FROM_NAME || "Creative Nexus";
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { success: false, error: "SMTP credentials not configured" };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      cc: options.cc?.join(", "),
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""),
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP send failed";
    console.error("[email] Send failed:", message);
    return { success: false, error: message };
  }
}

export function getDefaultCc(): string[] {
  const cc = process.env.SMTP_CC || "";
  return cc.split(",").map((e) => e.trim()).filter(Boolean);
}
