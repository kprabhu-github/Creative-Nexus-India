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
import { resolvePublicOrigin } from "@/lib/url";

export const dynamic = "force-dynamic";

// Error redirect: code only in URL. Detail logged server-side. Prevents leaking
// DB error messages (which may include row values / constraint names) into the
// browser history / nginx access logs.
function redirectWithError(
  req: NextRequest,
  code: string,
  serverDetail?: unknown,
) {
  if (serverDetail) {
    console.error(`[oauth/callback] ${code}:`, serverDetail);
  }
  const origin = resolvePublicOrigin(req);
  const res = NextResponse.redirect(
    `${origin}/settings/integrations?error=${encodeURIComponent(code)}`,
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
    return redirectWithError(req, "oauth_exchange", err);
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
    return redirectWithError(req, "oauth_lookup", lookupErr);
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
    // raced past our SELECT and inserted first. Re-resolve ownership:
    //   - row now owned by someone else → refuse w/ precise reason
    //   - row now unowned OR owned by us → claim it via UPDATE
    if (error?.code === "23505") {
      const { data: now } = await admin
        .from("email_accounts")
        .select("id, user_id")
        .eq("org_id", ORG_ID)
        .eq("email", profile.email)
        .maybeSingle();
      if (now) {
        if (now.user_id && now.user_id !== user.id) {
          return redirectWithError(req, "oauth_account_owned_by_other_user");
        }
        const { error: updErr } = await admin
          .from("email_accounts")
          .update(row)
          .eq("id", now.id);
        writeErr = updErr;
      }
    }
  }

  if (writeErr) {
    return redirectWithError(req, "oauth_persist", writeErr);
  }

  const origin = resolvePublicOrigin(req);
  const res = NextResponse.redirect(
    `${origin}/settings/integrations?connected=1`,
  );
  res.cookies.delete("gmail_oauth_nonce");
  return res;
}
