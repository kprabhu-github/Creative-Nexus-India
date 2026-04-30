// PATCH  /api/email/accounts/[id] — update display_name (or rotate password)
// DELETE /api/email/accounts/[id] — disconnect (keeps row, sets status=disconnected)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/email/encryption";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as {
    display_name?: string;
    app_password?: string;
  };

  const updates: Record<string, unknown> = {};
  if (body.display_name) updates.display_name = body.display_name.trim();
  if (body.app_password) {
    updates.app_password_encrypted = encrypt(body.app_password);
    updates.status = "connected";
    updates.last_error = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_accounts")
    .update(updates)
    .eq("id", params.id)
    .select("id, email, display_name, status, last_sync_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("email_accounts")
    .update({ status: "disconnected" })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { ok: true } });
}
