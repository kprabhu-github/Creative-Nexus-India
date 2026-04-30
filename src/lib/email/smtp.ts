// Per-account SMTP send via nodemailer.
// Credentials decrypted from email_accounts.app_password_encrypted at call time.

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { decrypt } from "./encryption";

export interface EmailAccountRow {
  id: string;
  email: string;
  display_name: string;
  smtp_host: string;
  smtp_port: number;
  app_password_encrypted: string;
}

export interface SendArgs {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  inReplyTo?: string;
  references?: string[];
  messageId?: string;
}

export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

function buildTransport(account: EmailAccountRow): Transporter {
  const password = decrypt(account.app_password_encrypted);
  return nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_port === 465,
    auth: { user: account.email, pass: password },
  });
}

export async function verifySmtp(account: EmailAccountRow): Promise<void> {
  const t = buildTransport(account);
  try {
    await t.verify();
  } finally {
    t.close();
  }
}

export async function sendFromAccount(
  account: EmailAccountRow,
  args: SendArgs,
): Promise<SendResult> {
  const t = buildTransport(account);
  try {
    const info = await t.sendMail({
      from: `"${account.display_name}" <${account.email}>`,
      to: Array.isArray(args.to) ? args.to.join(", ") : args.to,
      cc: args.cc?.join(", "),
      bcc: args.bcc?.join(", "),
      subject: args.subject,
      html: args.html,
      text: args.text ?? args.html.replace(/<[^>]+>/g, ""),
      inReplyTo: args.inReplyTo,
      references: args.references?.join(" "),
      messageId: args.messageId,
    });
    return {
      messageId: info.messageId,
      accepted: (info.accepted ?? []).map((a: unknown) => String(a)),
      rejected: (info.rejected ?? []).map((a: unknown) => String(a)),
    };
  } finally {
    t.close();
  }
}
