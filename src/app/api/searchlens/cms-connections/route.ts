// GET  /api/searchlens/cms-connections — list (creds redacted)
// POST /api/searchlens/cms-connections — create with encrypted creds

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/email/encryption";
import type { CmsConnection } from "@/lib/searchlens/cms-types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const CredsByTarget = {
  wordpress: z.object({
    base_url: z.string().url(),
    username: z.string().min(1).max(120),
    app_password: z.string().min(1).max(200),
  }),
  webflow: z.object({
    api_token: z.string().min(1).max(400),
    site_id: z.string().min(1).max(100),
  }),
  shopify: z.object({
    shop: z.string().min(1).max(200),
    admin_access_token: z.string().min(1).max(400),
  }),
  custom: z.object({
    endpoint_url: z.string().url(),
    bearer_token: z.string().max(400).optional(),
  }),
};

const Schema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("wordpress"), site_url: z.string().min(1), label: z.string().min(1).max(120), creds: CredsByTarget.wordpress }),
  z.object({ target: z.literal("webflow"), site_url: z.string().min(1), label: z.string().min(1).max(120), creds: CredsByTarget.webflow }),
  z.object({ target: z.literal("shopify"), site_url: z.string().min(1), label: z.string().min(1).max(120), creds: CredsByTarget.shopify }),
  z.object({ target: z.literal("custom"), site_url: z.string().min(1), label: z.string().min(1).max(120), creds: CredsByTarget.custom }),
]);

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ais_cms_connections")
    .select("id, org_id, target, site_url, label, meta_json, last_used_at, last_status, created_at, updated_at")
    .eq("org_id", ORG_ID)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { connections: (data ?? []) as CmsConnection[] } });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  let credsEnc: string;
  try {
    credsEnc = encrypt(JSON.stringify(p.creds));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Encryption failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ais_cms_connections")
    .insert({
      org_id: ORG_ID,
      target: p.target,
      site_url: p.site_url,
      label: p.label,
      credentials_encrypted: credsEnc,
      meta_json: {},
    })
    .select("id, org_id, target, site_url, label, meta_json, last_used_at, last_status, created_at, updated_at")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  return NextResponse.json({ data: { connection: data as CmsConnection } }, { status: 201 });
}
