// WordPress deployer. v1 strategy: push artifact content into the WP site
// via the REST API using an Application Password. Each artifact kind maps
// to a deterministic target:
//   - llms_txt / robots_txt → create a draft Page (slug-based). User adds a
//     File-Manager redirect once; future updates patch the same page.
//   - schema_jsonld         → create a draft Page containing the <script>
//     block; user pastes the <script> into the target page's HTML, OR
//     installs our companion mu-plugin to auto-inject.
//   - answer_block          → patch the target post's content (append at top
//     if not already present) when target_post_id is provided.
//   - meta_rewrite          → patch Yoast SEO _yoast_wpseo_title /
//     _yoast_wpseo_metadesc post meta when target_post_id is provided.
//
// All requests use Basic Auth (username:app_password) over HTTPS.

import type { FixKind } from "@/lib/searchlens/fix-types";
import type { WordPressCreds } from "@/lib/searchlens/cms-types";

export interface DeployResult {
  ok: boolean;
  status: string;
  target_url: string | null;
  error: string | null;
}

function authHeader(c: WordPressCreds): string {
  const token = Buffer.from(`${c.username}:${c.app_password}`).toString("base64");
  return `Basic ${token}`;
}

function pageSlugFor(kind: FixKind): string {
  switch (kind) {
    case "llms_txt": return "llms-txt";
    case "robots_txt": return "robots-txt";
    case "schema_jsonld": return "schema-jsonld";
    case "answer_block": return "answer-block";
    case "meta_rewrite": return "meta-rewrite";
  }
}

function pageTitleFor(kind: FixKind): string {
  switch (kind) {
    case "llms_txt": return "llms.txt";
    case "robots_txt": return "robots.txt";
    case "schema_jsonld": return "FAQ Schema JSON-LD";
    case "answer_block": return "Citable Answer Block";
    case "meta_rewrite": return "SEO Title + Meta variants";
  }
}

async function findExistingPage(base: string, slug: string, auth: string): Promise<number | null> {
  const r = await fetch(`${base.replace(/\/$/, "")}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&status=any`, {
    headers: { Authorization: auth },
  });
  if (!r.ok) return null;
  const arr = (await r.json()) as Array<{ id: number }>;
  return arr.length > 0 ? arr[0].id : null;
}

async function patchPostMeta(base: string, postId: number, auth: string, metaPatch: Record<string, unknown>): Promise<Response> {
  return fetch(`${base.replace(/\/$/, "")}/wp-json/wp/v2/posts/${postId}`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ meta: metaPatch }),
  });
}

export async function deployWordPress(
  creds: WordPressCreds,
  artifact: { kind: FixKind; output_text: string; title: string },
  options: { target_post_id?: number } = {},
): Promise<DeployResult> {
  const base = creds.base_url.replace(/\/$/, "");
  const auth = authHeader(creds);

  // Probe auth once
  const me = await fetch(`${base}/wp-json/wp/v2/users/me`, { headers: { Authorization: auth } });
  if (!me.ok) {
    return { ok: false, status: "auth_failed", target_url: null, error: `WordPress auth failed (HTTP ${me.status}). Check username + Application Password.` };
  }

  // meta_rewrite + answer_block when targeting an existing post
  if (options.target_post_id && (artifact.kind === "meta_rewrite" || artifact.kind === "answer_block")) {
    if (artifact.kind === "meta_rewrite") {
      // Best-effort: parse first variant as title and a description line
      const lines = artifact.output_text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const newTitle = lines[0] ?? "";
      const newDesc = lines[1] ?? "";
      const r = await patchPostMeta(base, options.target_post_id, auth, {
        _yoast_wpseo_title: newTitle,
        _yoast_wpseo_metadesc: newDesc,
        rank_math_title: newTitle,
        rank_math_description: newDesc,
      });
      if (!r.ok) return { ok: false, status: "patch_failed", target_url: null, error: `Post meta patch failed (HTTP ${r.status}).` };
      return { ok: true, status: "deployed", target_url: `${base}/?p=${options.target_post_id}`, error: null };
    }
    // answer_block → prepend HTML to post content
    const getR = await fetch(`${base}/wp-json/wp/v2/posts/${options.target_post_id}`, { headers: { Authorization: auth } });
    if (!getR.ok) return { ok: false, status: "fetch_failed", target_url: null, error: `Could not load post ${options.target_post_id}.` };
    const post = (await getR.json()) as { content: { raw?: string; rendered: string } };
    const existing = post.content.raw ?? post.content.rendered;
    if (existing.includes(artifact.output_text.slice(0, 80))) {
      return { ok: true, status: "already_present", target_url: `${base}/?p=${options.target_post_id}`, error: null };
    }
    const patch = await fetch(`${base}/wp-json/wp/v2/posts/${options.target_post_id}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ content: `${artifact.output_text}\n\n${existing}` }),
    });
    if (!patch.ok) return { ok: false, status: "patch_failed", target_url: null, error: `Post content patch failed (HTTP ${patch.status}).` };
    return { ok: true, status: "deployed", target_url: `${base}/?p=${options.target_post_id}`, error: null };
  }

  // Default path: upsert a draft page that holds the artifact
  const slug = pageSlugFor(artifact.kind);
  const title = pageTitleFor(artifact.kind);
  const content =
    artifact.kind === "llms_txt" || artifact.kind === "robots_txt"
      ? `<pre>${escapeHtml(artifact.output_text)}</pre>`
      : artifact.output_text;
  const existingId = await findExistingPage(base, slug, auth);
  const url = existingId
    ? `${base}/wp-json/wp/v2/pages/${existingId}`
    : `${base}/wp-json/wp/v2/pages`;
  const body = existingId
    ? { title, content, status: "draft" }
    : { title, slug, content, status: "draft" };
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, status: "page_upsert_failed", target_url: null, error: `Page upsert failed (HTTP ${r.status}).` };
  const page = (await r.json()) as { id: number; link: string };
  return { ok: true, status: existingId ? "updated" : "created", target_url: page.link, error: null };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
