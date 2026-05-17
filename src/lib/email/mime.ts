// Builds RFC 5322 MIME messages with the threading headers Gmail respects.
// Output is a UTF-8 string; caller base64url-encodes for gmail.users.messages.send.

import { randomUUID } from "crypto";

export interface BuildMimeInput {
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text: string;
  messageId: string;
  inReplyTo?: string | null;
  references?: string[] | null;
}

function escapeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatAddress(email: string, name?: string): string {
  if (!name) return escapeHeader(email);
  return `${JSON.stringify(escapeHeader(name))} <${escapeHeader(email)}>`;
}

export function buildMime(input: BuildMimeInput): string {
  const boundary = `cnx-${Math.random().toString(36).slice(2)}`;
  const headers: string[] = [
    `From: ${formatAddress(input.from, input.fromName)}`,
    `To: ${input.to.map((e) => escapeHeader(e)).join(", ")}`,
  ];
  if (input.cc?.length)
    headers.push(`Cc: ${input.cc.map(escapeHeader).join(", ")}`);
  if (input.bcc?.length)
    headers.push(`Bcc: ${input.bcc.map(escapeHeader).join(", ")}`);
  headers.push(`Subject: ${escapeHeader(input.subject)}`);
  headers.push(`Message-ID: ${escapeHeader(input.messageId)}`);
  if (input.inReplyTo)
    headers.push(`In-Reply-To: ${escapeHeader(input.inReplyTo)}`);
  if (input.references?.length) {
    headers.push(
      `References: ${input.references.map(escapeHeader).join(" ")}`,
    );
  }
  headers.push("MIME-Version: 1.0");
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return headers.join("\r\n") + "\r\n\r\n" + body;
}

export function toBase64Url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

export function buildMessageId(domain: string): string {
  return `<${randomUUID()}@${domain}>`;
}
