// GET /api/email/oauth/google/callback?code=...&state=...
// Verifies HMAC-bound state cookie, exchanges code, persists encrypted refresh
// token, upserts email_accounts row only if it is unowned or owned by the same
// user (prevents cross-user account hijack).

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  GMAIL_SCOPES,
  verifyOAuthState,
} from "@/lib/email/gmail-oauth";
import { encrypt } from "@/lib/email/encryption";
import { ORG_ID } from "@/lib/email/index";

export const dynamic = "force-dynamic";

function redirectWithError(req: NextRequest, code: string, detail?: string) {
  const params = new URLSearchParams({ error: code });
  if (detail) params.set("detail", detail);
  const res = NextResponse.redirect(
    new URL(`/settings/integrations?${params.toString()}`, req.url),
  );
  res.cookies.delete("gmail_oauth_nonce");
  return res;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieNonce = req.cookies.get("gmail_oauth_nonce")?.value;

  if (!code) return redirectWithError(req, "oauth_missing_code");

  const verified = verifyOAuthState(state, cookieNonce);
  if ("error" in verified) {
    return redirectWithError(req, verified.error);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== verified.userId) {
    return redirectWithError(req, "oauth_user_mismatch");
  }

  let tokens, profile;
  try {
    tokens = await exchangeCodeForTokens(code);
    profile = await fetchGoogleUserInfo(tokens.access_token!);
  } catch (err) {
    return redirectWithError(
      req,
      "oauth_exchange",
      encodeURIComponent((err as Error).message),
    );
  }

  const admin = createAdminClient();

  // Ownership guard: if a row exists for (org_id, email), only allow update
  // when the existing row's user_id is null or matches the current user.
  // Prevents user B from silently overwriting user A's encrypted refresh token.
  const { data: existing, error: lookupErr } = await admin
    .from("email_accounts")
    .select("id, user_id")
    .eq("org_id", ORG_ID)
    .eq("email", profile.email)
    .maybeSingle();

  if (lookupErr) {
    return redirectWithError(
      req,
      "oauth_lookup",
      encodeURIComponent(lookupErr.message),
    );
  }

  if (existing && existing.user_id && existing.user_id !== user.id) {
    return redirectWithError(req, "oauth_account_owned_by_other_user");
  }

  const row = {
    user_id: user.id,
    email: profile.email,
    display_name: profile.name,
    provider: "gmail_oauth" as const,
    oauth_refresh_token_encrypted: encrypt(tokens.refresh_token!),
    oauth_access_token_encrypted: tokens.access_token
      ? encrypt(tokens.access_token)
      : null,
    oauth_expires_at:
      tokens.expiry_date && tokens.expiry_date > 0
        ? new Date(tokens.expiry_date).toISOString()
        : null,
    oauth_scopes: [...GMAIL_SCOPES],
    status: "connected" as const,
    last_error: null,
    org_id: ORG_ID,
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
    imap_host: "imap.gmail.com",
    imap_port: 993,
  };

  let writeErr: { code?: string; message: string } | null = null;
  if (existing) {
    const { error } = await admin
      .from("email_accounts")
      .update(row)
      .eq("id", existing.id);
    writeErr = error;
  } else {
    const { error } = await admin.from("email_accounts").insert(row);
    writeErr = error;
    // TOCTOU: another concurrent OAuth flow for the same (org_id, email)
    // raced past our SELECT and inserted first. Re-run the ownership check
    // so the user gets the precise reason instead of a generic persist error.
    if (error?.code === "23505") {
      const { data: now } = await admin
        .from("email_accounts")
        .select("user_id")
        .eq("org_id", ORG_ID)
        .eq("email", profile.email)
        .maybeSingle();
      if (now && now.user_id && now.user_id !== user.id) {
        return redirectWithError(req, "oauth_account_owned_by_other_user");
      }
    }
  }

  if (writeErr) {
    return redirectWithError(
      req,
      "oauth_persist",
      encodeURIComponent(writeErr.message),
    );
  }

  const res = NextResponse.redirect(
    new URL("/settings/integrations?connected=1", req.url),
  );
  res.cookies.delete("gmail_oauth_nonce");
  return res;
}
