// DELETE /api/searchlens/cms-connections/[id]

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ais_cms_connections")
    .delete()
    .eq("id", ctx.params.id)
    .eq("org_id", ORG_ID);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { ok: true } });
}
