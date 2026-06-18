// POST /api/searchlens/fix/deploy { artifact_id, connection_id, target_post_id? }
// Routes the artifact to the connection's target adapter. v1 ships WordPress;
// other targets respond 501 until their adapters land.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/email/encryption";
import { deployWordPress } from "@/lib/searchlens/deploy-wordpress";
import type { FixArtifact } from "@/lib/searchlens/fix-types";
import type { CmsConnection, WordPressCreds } from "@/lib/searchlens/cms-types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Schema = z.object({
  artifact_id: z.string().uuid(),
  connection_id: z.string().uuid(),
  target_post_id: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const p = parsed.data;

  const supabase = createAdminClient();
  const { data: artifact, error: aErr } = await supabase
    .from("ais_fix_artifacts")
    .select("*")
    .eq("id", p.artifact_id)
    .eq("org_id", ORG_ID)
    .single();
  if (aErr || !artifact) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });

  const { data: conn, error: cErr } = await supabase
    .from("ais_cms_connections")
    .select("*")
    .eq("id", p.connection_id)
    .eq("org_id", ORG_ID)
    .single();
  if (cErr || !conn) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  let creds: unknown;
  try {
    creds = JSON.parse(decrypt(conn.credentials_encrypted));
  } catch {
    return NextResponse.json({ error: "Failed to decrypt credentials" }, { status: 500 });
  }

  if (conn.target !== "wordpress") {
    return NextResponse.json({ error: `Target '${conn.target}' deploy adapter not implemented yet` }, { status: 501 });
  }

  const result = await deployWordPress(
    creds as WordPressCreds,
    artifact as FixArtifact,
    { target_post_id: p.target_post_id },
  );

  await supabase
    .from("ais_fix_artifacts")
    .update({
      deployed_at: result.ok ? new Date().toISOString() : null,
      deploy_target_url: result.target_url,
      deploy_status: result.status,
      deploy_connection_id: (conn as CmsConnection).id,
      deploy_error: result.error,
    })
    .eq("id", p.artifact_id);

  await supabase
    .from("ais_cms_connections")
    .update({ last_used_at: new Date().toISOString(), last_status: result.status })
    .eq("id", p.connection_id);

  return NextResponse.json({ data: { result } }, { status: result.ok ? 200 : 400 });
}
