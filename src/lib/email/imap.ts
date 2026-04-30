// IMAP wrapper using imapflow.
// Each call opens a connection, performs the work, closes. No long-lived clients.

import { ImapFlow, type FetchMessageObject } from "imapflow";
import { decrypt } from "./encryption";
import type { EmailAccountRow } from "./smtp";

export interface ImapEnvelope {
  uid: number;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  fromEmail: string | null;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  sentAt: Date | null;
  isRead: boolean;
  snippet: string;
}

export interface ImapAccountRow extends EmailAccountRow {
  imap_host: string;
  imap_port: number;
}

async function open(account: ImapAccountRow): Promise<ImapFlow> {
  const password = decrypt(account.app_password_encrypted);
  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: true,
    auth: { user: account.email, pass: password },
    logger: false,
  });
  await client.connect();
  return client;
}

export async function verifyImap(account: ImapAccountRow): Promise<void> {
  const client = await open(account);
  try {
    await client.mailboxOpen("INBOX");
  } finally {
    await client.logout();
  }
}

function addrEmail(a: { address?: string } | undefined): string | null {
  return a?.address ?? null;
}

function addrName(a: { name?: string } | undefined): string | null {
  return a?.name ?? null;
}

function snippetFrom(text?: string): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

export async function fetchSinceUid(
  account: ImapAccountRow,
  sinceUid: number | null,
  maxFetch = 100,
): Promise<ImapEnvelope[]> {
  const client = await open(account);
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const range = sinceUid && sinceUid > 0 ? `${sinceUid + 1}:*` : "1:*";
      const out: ImapEnvelope[] = [];
      let count = 0;
      for await (const msg of client.fetch(
        range,
        { uid: true, envelope: true, flags: true, bodyStructure: true, source: false, headers: ["references", "in-reply-to", "message-id"] },
        { uid: true },
      ) as AsyncIterable<FetchMessageObject>) {
        if (count >= maxFetch) break;
        count++;
        const env = msg.envelope;
        if (!env) continue;
        const headers = msg.headers ? msg.headers.toString() : "";
        const refs = (headers.match(/^References:\s*(.+)$/im)?.[1] ?? "")
          .split(/\s+/)
          .filter(Boolean);
        const inReplyTo =
          (headers.match(/^In-Reply-To:\s*(.+)$/im)?.[1] ?? "").trim() || null;
        const flags = msg.flags as Set<string> | undefined;
        const isRead = flags ? flags.has("\\Seen") : false;
        out.push({
          uid: msg.uid,
          messageId: env.messageId ?? null,
          inReplyTo,
          references: refs,
          fromEmail: addrEmail(env.from?.[0]),
          fromName: addrName(env.from?.[0]),
          toEmails: (env.to ?? []).map((a) => a.address ?? "").filter(Boolean),
          ccEmails: (env.cc ?? []).map((a) => a.address ?? "").filter(Boolean),
          subject: env.subject ?? "",
          sentAt: env.date ? new Date(env.date) : null,
          isRead,
          snippet: snippetFrom(env.subject),
        });
      }
      return out;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function fetchBodyByUid(
  account: ImapAccountRow,
  uid: number,
): Promise<{ html: string | null; text: string | null }> {
  const client = await open(account);
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const result = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!result || !result.source) return { html: null, text: null };
      const raw = result.source.toString();
      const htmlMatch = raw.match(/Content-Type:\s*text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\n$)/i);
      const textMatch = raw.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\n$)/i);
      return {
        html: htmlMatch?.[1]?.trim() ?? null,
        text: textMatch?.[1]?.trim() ?? null,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function setSeen(
  account: ImapAccountRow,
  uid: number,
): Promise<void> {
  const client = await open(account);
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
