// ---------------------------------------------------------------------------
// Seed script: hr_team_members
// Run: npx tsx scripts/seed-team-members.ts
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
// Idempotent: ON CONFLICT (org_id, slug) DO UPDATE.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { callClaude, parseClaudeJson } from "../src/lib/anthropic";

// The script uses an untyped client (no generated DB types here); we alias it
// once and pass the alias around to keep call-site signatures clean.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any, any, any>;

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
const BUCKET = "team-photos";
const PHOTO_TIMEOUT_MS = 5000;

interface SeedMember {
  name: string;
  title: string;
  department: string;
  role_tag: "founder" | "mentor" | "team" | "extended" | "intern" | "alumni";
  photo_url: string;
  bio_seed?: string;
}

const TEAM: SeedMember[] = [
  { name: "K. Prabhu", title: "CEO & Co-founder", department: "Leadership", role_tag: "founder", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/k.prabhu_Co-FounderCEO.png", bio_seed: "With over 18+ yrs of experience in Global Marketing Communication & Branding. Previous to this, he worked with companies like Boston Consulting Group (BCG), KPMG, and ZS Associates, Aptara etc." },
  { name: "Rishabh Kumar", title: "CMO & Co-Founder", department: "Leadership", role_tag: "founder", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/Rishabh-Co-founder_Managing_Director.png" },
  { name: "Paras Goyal", title: "Mentor", department: "Leadership", role_tag: "mentor", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/Paras_Mentor.png" },
  { name: "Deepak Vats", title: "Sr. Consultant / Mentor", department: "Leadership", role_tag: "extended", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/Deepak_Vats.png" },
  { name: "Parshant Hadala", title: "Director, Digital Marketing", department: "Digital Marketing", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/Parshant_Hadala_-Manager_Creative_Nexus_Digital_Marketing__Communication.png" },
  { name: "Ashish Kumar", title: "Sr. Manager, Branding & Design", department: "Design", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/Ashish-1.png" },
  { name: "Tisha Garg", title: "Sr. Manager, Customer Growth", department: "Business Development", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2024/01/Tisha-Garg-Client-Growth-Manager.jpg" },
  { name: "Rajalakshmi G", title: "Head of Finance & HR", department: "Operations", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/Rajalakshmi.png" },
  { name: "Yogesh Kumar", title: "Full Stack Developer", department: "Development", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2024/01/Yogesh_Creative_Nexus_Full-Stack-Developer-New-Joinie_.png" },
  { name: "Akhil Gupta", title: "Manager - UI / UX", department: "Design", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/akhil-1.png" },
  { name: "Tarun Singla", title: "Manager - Full Stack Development", department: "Development", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2023/06/Tarun-Website_Development_Manager-FullstackDeveloper.png" },
  { name: "Birendra Singh", title: "Head of Design Operations", department: "Design", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2025/01/Birendra-Singh-Head-of-Design-Operations-at-Creative-Nexus-2025.png" },
  { name: "Hardik Barchha", title: "Sr.Lead, Content Specialist", department: "Content", role_tag: "extended", photo_url: "https://creativenexus.in/wp-content/uploads/2025/01/Hardik-Barchha-Sr.Content-Specialist-at-Creative-Nexus-2025.png" },
  { name: "Savita Ajay", title: "Asst. Manager - Content Writer", department: "Content", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/savita-1.png" },
  { name: "Nikhil Kumar", title: "Specialist - Digital Marketing", department: "Digital Marketing", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/nikhil-1.png" },
  { name: "Ashish Parmaa", title: "Graphic Designer - Social Media", department: "Design", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2024/06/Ashish-Parmar_CNX.jpg" },
  { name: "Priyanka Gupta", title: "Lead, Shopify Expert", department: "Development", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2024/06/Priyanka-Sharma.jpg" },
  { name: "Anu Kriti", title: "Graphic Design Intern", department: "Design", role_tag: "intern", photo_url: "https://creativenexus.in/wp-content/uploads/2024/06/Anu-Kriti.jpg" },
  { name: "Pratham Sharma", title: "Graphic Design Specialist", department: "Design", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2024/06/pratham-verma_CNX.jpg" },
  { name: "Akshita", title: "Specialist - Script Writer", department: "Content", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/akshita.png" },
  { name: "Arun Roy", title: "Director - Video Production", department: "Video Production", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/ArunRoy-CreativeDirector-1.png" },
  { name: "Deepak", title: "Head - Animation Artist", department: "Video Production", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/deepak.png" },
  { name: "Suraj", title: "Project Manager - Motion Graphics", department: "Video Production", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2022/04/oh__img164.5.png" },
  { name: "Muneeb Khan", title: "Specialist - Backend Developer", department: "Development", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2023/04/muneebKhan_CNX-Website-Developer-1.png" },
  { name: "Himanshu Sharma", title: "Graphic Design Associate", department: "Design", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2024/06/Himanshu-Sharma_CNX.jpg" },
  { name: "Zeba Khan", title: "Specialist - SEO", department: "Digital Marketing", role_tag: "team", photo_url: "https://creativenexus.in/wp-content/uploads/2023/04/Zeba-Khan_CNX-SEO-Developer.png" },
  { name: "Shruti Lavate", title: "Intern Digital Marketing", department: "Digital Marketing", role_tag: "intern", photo_url: "https://creativenexus.in/wp-content/uploads/2025/01/Shruti-Intern-Email-Marketing-SEO-at-Creative-Nexus-2025.webp" },
];

// Mailbox holders to attempt FK match against core_users.email
const MAILBOX_EMAIL_HINTS: Record<string, string> = {
  "k-prabhu": "prabhu@creativenexusglobal.com",
  "rishabh-kumar": "rishabh@creativenexusglobal.com",
  "tisha-garg": "tisha@creativenexusglobal.com",
};

function slugify(name: string): string {
  // Strip combining diacritical marks (U+0300 – U+036F) after NFKD decomposition.
  // We avoid the /\p{Diacritic}/u flag because tsconfig may target ES5.
  const stripDiacritics = name
    .normalize("NFKD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
  return stripDiacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function displayOrderFor(m: SeedMember): number {
  const t = m.title.toLowerCase();
  if (m.role_tag === "founder") return 10;
  if (m.role_tag === "mentor") return 20;
  if (m.role_tag === "intern") return 100;
  if (t.includes("director")) return 30;
  if (t.startsWith("head") || t.includes("head of") || t.includes("head -")) return 40;
  if (t.includes("sr.") || t.includes("sr ") || t.includes("senior")) return 50;
  if (t.startsWith("manager") || t.includes("- manager") || t.includes("manager -") || t.includes("project manager") || t.includes("asst. manager")) return 60;
  if (t.startsWith("lead") || t.includes("lead,") || t.includes("- lead")) return 70;
  if (t.includes("specialist") || t.includes("developer") || t.includes("script writer")) return 80;
  if (t.includes("designer") || t.includes("design ") || t.includes("- design")) return 90;
  return 100;
}

async function downloadAndUpload(
  supabase: AnyClient,
  slug: string,
  url: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PHOTO_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`  photo skip (${res.status}): ${slug}`);
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "image/png";
    const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg"
              : contentType.includes("webp") ? "webp"
              : "png";
    const arrayBuf = await res.arrayBuffer();
    const path = `${slug}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, new Uint8Array(arrayBuf), {
        contentType,
        upsert: true,
        cacheControl: "604800",
      });
    if (upErr) {
      console.warn(`  upload skip: ${slug} — ${upErr.message}`);
      return null;
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return pub.publicUrl;
  } catch (err) {
    console.warn(`  photo error: ${slug} — ${(err as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function ensureBucket(supabase: AnyClient) {
  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (existing) return;
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Failed to create bucket: ${error.message}`);
  }
  console.log(`Created bucket: ${BUCKET} (public)`);
}

async function generateBios(
  members: { slug: string; name: string; title: string; department: string }[],
): Promise<Record<string, string>> {
  if (members.length === 0) return {};
  const list = members
    .map((m) => `- ${m.slug} | ${m.name} | ${m.title} | ${m.department}`)
    .join("\n");

  const systemPrompt =
    'You write crisp 2-sentence professional bios for a digital marketing & design agency team page. Each bio MUST be exactly 2 sentences, total 30-50 words, professional, warm, factual. Mention their role plus one likely strength implied by their title. NEVER invent specific facts (years, schools, prior companies, project names). Return ONLY valid JSON of shape {"member-slug": "bio text"} with one entry per slug provided. No markdown, no commentary.';

  const userMessage = `Members (slug | name | title | department):\n${list}`;

  const { text } = await callClaude({
    tier: "execution",
    systemPrompt,
    userMessage,
    maxTokens: 4096,
    temperature: 0.5,
  });

  try {
    return parseClaudeJson<Record<string, string>>(text);
  } catch (err) {
    console.warn(`Bio JSON parse failed: ${(err as Error).message}`);
    return {};
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Seeding ${TEAM.length} team members...`);
  await ensureBucket(supabase);

  // Step 1: build slug map + identify who needs an AI bio.
  const enriched = TEAM.map((m) => ({ ...m, slug: slugify(m.name) }));
  const needsBio = enriched.filter((m) => !m.bio_seed);
  console.log(`Generating ${needsBio.length} bios via Claude (single call)...`);
  const aiBios = await generateBios(
    needsBio.map((m) => ({
      slug: m.slug,
      name: m.name,
      title: m.title,
      department: m.department,
    })),
  );
  console.log(`Received ${Object.keys(aiBios).length} bios.`);

  // Step 2: lookup mailbox holders in core_users.
  const emailMap: Record<string, string | null> = {};
  for (const [slug, email] of Object.entries(MAILBOX_EMAIL_HINTS)) {
    const { data } = await supabase
      .from("core_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    emailMap[slug] = (data as { id: string } | null)?.id ?? null;
    if (emailMap[slug]) console.log(`  matched core_user for ${slug}`);
  }

  // Step 3: per-member upload + upsert.
  let okCount = 0;
  for (const m of enriched) {
    const bio = m.bio_seed ?? aiBios[m.slug] ?? null;
    const photoUrl = (await downloadAndUpload(supabase, m.slug, m.photo_url)) ?? m.photo_url;
    const email = MAILBOX_EMAIL_HINTS[m.slug] ?? null;

    const row = {
      org_id: ORG_ID,
      slug: m.slug,
      name: m.name,
      title: m.title,
      department: m.department,
      role_tag: m.role_tag,
      photo_url: photoUrl,
      bio,
      email,
      display_order: displayOrderFor(m),
      status: "active" as const,
      core_user_id: emailMap[m.slug] ?? null,
    };

    const { error } = await supabase
      .from("hr_team_members")
      .upsert(row, { onConflict: "org_id,slug" });

    if (error) {
      console.error(`  FAIL ${m.slug}: ${error.message}`);
    } else {
      okCount += 1;
      console.log(`  ok  ${m.slug.padEnd(22)} order=${row.display_order}`);
    }
  }

  console.log(`\nDone. ${okCount}/${enriched.length} members upserted.`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
