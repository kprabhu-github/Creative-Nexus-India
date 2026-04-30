// POST /api/auth/signout — clears Supabase session cookies and redirects.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ data: { ok: true } });
}
