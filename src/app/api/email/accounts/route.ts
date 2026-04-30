// GET  /api/email/accounts — list all accounts (passwords NEVER returned)
// POST /api/email/accounts — connect new account: tests SMTP+IMAP, encrypts password, saves

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/email/encryption";
import { verifySmtp } from "@/lib/email/smtp";
import { verifyImap } from "@/lib/email/imap";
import { ORG_ID, type EmailAccount } from "@/lib/email/index";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function sanitize(row: EmailAccount) {
  const { app_password_encrypted: _omit, ...rest } = row;
  void _omit;
  return rest;
}

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("org_id", ORG_ID)
    .order("email", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    data: { accounts: (data ?? []).map((r) => sanitize(r as EmailAccount)) },
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    email?: string;
    display_name?: string;
    app_password?: string;
    smtp_host?: string;
    smtp_port?: number;
    imap_host?: string;
    imap_port?: number;
  };

  if (!body.email || !body.app_password || !body.display_name) {
    return NextResponse.json(
      { error: "Missing email, display_name, or app_password" },
      { status: 400 },
    );
  }

  const account = {
    email: body.email.trim().toLowerCase(),
    display_name: body.display_name.trim(),
    smtp_host: body.smtp_host || "smtp.gmail.com",
    smtp_port: body.smtp_port ?? 465,
    imap_host: body.imap_host || "imap.gmail.com",
    imap_port: body.imap_port ?? 993,
    app_password_encrypted: encrypt(body.app_password),
  };

  // Verify creds before persisting.
  try {
    await verifySmtp({
      id: "test",
      ...account,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMTP verify failed";
    return NextResponse.json(
      { error: `SMTP login failed: ${msg}. Make sure 2FA is enabled and you used a 16-character app password.` },
      { status: 400 },
    );
  }

  try {
    await verifyImap({
      id: "test",
      ...account,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "IMAP verify failed";
    return NextResponse.json(
      { error: `IMAP login failed: ${msg}. The app password is correct for SMTP but IMAP needs to be enabled in Gmail settings.` },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_accounts")
    .upsert(
      { ...account, org_id: ORG_ID, status: "connected", last_error: null },
      { onConflict: "org_id,email" },
    )
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Save failed: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: sanitize(data as EmailAccount) });
}
