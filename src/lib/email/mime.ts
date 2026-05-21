// Builds RFC 5322 MIME messages with the threading headers Gmail respects.
// Output is a UTF-8 string; caller base64url-encodes for gmail.users.messages.send.
//
// Two shapes:
//   - No attachments: multipart/alternative (text + html)
//   - With attachments: multipart/mixed wrapping multipart/alternative + each file

import { randomUUID } from "crypto";

export interface MimeAttachment {
  name: string;
  mime: string;
  content: Buffer; // raw bytes; base64-encoded into the MIME during build
}

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
  attachments?: MimeAttachment[];
}

function escapeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatAddress(email: string, name?: string): string {
  if (!name) return escapeHeader(email);
  return `${JSON.stringify(escapeHeader(name))} <${escapeHeader(email)}>`;
}

// Splits base64 into RFC 2045 76-character lines.
function chunkBase64(input: string): string {
  return input.replace(/(.{76})/g, "$1\r\n");
}

// Encodes filenames containing non-ASCII per RFC 2047 (Q-encoding) for the
// Content-Disposition header. ASCII names pass through as-is.
function encodeFilename(name: string): string {
  if (/^[\x20-\x7E]+$/.test(name)) return `"${name.replace(/"/g, "\\\"")}"`;
  const b64 = Buffer.from(name, "utf-8").toString("base64");
  return `=?UTF-8?B?${b64}?=`;
}

function buildAlternativePart(html: string, text: string, boundary: string): string {
  return [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function buildAttachmentPart(att: MimeAttachment): string {
  const b64 = chunkBase64(att.content.toString("base64"));
  return [
    `Content-Type: ${att.mime}; name=${encodeFilename(att.name)}`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename=${encodeFilename(att.name)}`,
    "",
    b64,
  ].join("\r\n");
}

export function buildMime(input: BuildMimeInput): string {
  const altBoundary = `cnx-alt-${Math.random().toString(36).slice(2)}`;
  const hasAttachments = (input.attachments?.length ?? 0) > 0;
  const mixedBoundary = hasAttachments
    ? `cnx-mix-${Math.random().toString(36).slice(2)}`
    : null;

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

  const alternative = buildAlternativePart(input.html, input.text, altBoundary);

  if (!hasAttachments) {
    headers.push(
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    );
    return headers.join("\r\n") + "\r\n\r\n" + alternative;
  }

  headers.push(
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
  );

  const parts: string[] = [
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    alternative,
  ];

  for (const att of input.attachments!) {
    parts.push(`--${mixedBoundary}`);
    parts.push(buildAttachmentPart(att));
    parts.push("");
  }
  parts.push(`--${mixedBoundary}--`);
  parts.push("");

  return headers.join("\r\n") + "\r\n\r\n" + parts.join("\r\n");
}

export function toBase64Url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

export function buildMessageId(domain: string): string {
  return `<${randomUUID()}@${domain}>`;
}
