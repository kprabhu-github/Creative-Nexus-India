// GET /api/email/oauth/google/callback?code=...&state=...
// Validates state, exchanges code for tokens, persists encrypted refresh token,
// upserts email_accounts row, redirects to /settings/integrations?connected=1.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  GMAIL_SCOPES,
} from "@/lib/email/gmail-oauth";
import { encrypt } from "@/lib/email/encryption";
import { ORG_ID } from "@/lib/email/index";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = req.cookies.get("gmail_oauth_state")?.value;

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=oauth_state_mismatch", req.url),
    );
  }

  const userId = state.split(".")[0];

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=oauth_user_mismatch", req.url),
    );
  }

  let tokens, profile;
  try {
    tokens = await exchangeCodeForTokens(code);
    profile = await fetchGoogleUserInfo(tokens.access_token!);
  } catch (err) {
    const msg = encodeURIComponent((err as Error).message);
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?error=oauth_exchange&detail=${msg}`,
        req.url,
      ),
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("email_accounts").upsert(
    {
      user_id: user.id,
      email: profile.email,
      display_name: profile.name,
      provider: "gmail_oauth",
      oauth_refresh_token_encrypted: encrypt(tokens.refresh_token!),
      oauth_access_token_encrypted: tokens.access_token
        ? encrypt(tokens.access_token)
        : null,
      oauth_expires_at: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
      oauth_scopes: [...GMAIL_SCOPES],
      status: "connected",
      last_error: null,
      org_id: ORG_ID,
      smtp_host: "smtp.gmail.com",
      smtp_port: 465,
      imap_host: "imap.gmail.com",
      imap_port: 993,
    },
    { onConflict: "org_id,email" },
  );

  if (error) {
    const msg = encodeURIComponent(error.message);
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?error=oauth_persist&detail=${msg}`,
        req.url,
      ),
    );
  }

  const res = NextResponse.redirect(
    new URL("/settings/integrations?connected=1", req.url),
  );
  res.cookies.delete("gmail_oauth_state");
  return res;
}
