// POST /api/email/oauth/google/start
// Returns { url } — frontend redirects user to Google consent.

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { buildConsentUrl } from "@/lib/email/gmail-oauth";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // State binds the callback to this user; checked in callback route.
  const stateRaw = randomBytes(16).toString("hex");
  const state = `${user.id}.${stateRaw}`;

  const url = buildConsentUrl(state);
  const res = NextResponse.json({ url });
  res.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
