// POST /api/email/oauth/google/start
// Returns { url } — frontend redirects user to Google consent.
// Cookie holds only the nonce; the state sent to Google is HMAC-bound to the
// current user_id so an attacker cannot reuse a state issued for someone else.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildConsentUrl, issueOAuthState } from "@/lib/email/gmail-oauth";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { state, nonce } = issueOAuthState(user.id);
  const url = buildConsentUrl(state);

  const res = NextResponse.json({ url });
  res.cookies.set("gmail_oauth_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/api/email/oauth/google",
  });
  return res;
}
