// ---------------------------------------------------------------------------
// GET /api/skills — Marketing skills library
// ---------------------------------------------------------------------------
// Reads all folders from src/data/marketing-skills/, parses each SKILL.md
// file, and returns structured skill objects with frontmatter + body content.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// Category derivation
// ---------------------------------------------------------------------------

function deriveCategory(slug: string): string {
  if (/cro|form|signup|popup|paywall|onboarding/.test(slug)) return "CRO";
  if (/seo|schema|programmatic/.test(slug)) return "SEO";
  if (/copy|content|social/.test(slug)) return "Content";
  if (/paid|ads/.test(slug)) return "Paid Media";
  if (/email/.test(slug)) return "Email";
  if (/analytics|tracking|ab-test/.test(slug)) return "Analytics";
  return "Strategy";
}

// ---------------------------------------------------------------------------
// Prettify slug into display name
// ---------------------------------------------------------------------------

function prettifySlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => {
      // Keep common acronyms uppercased
      const upper = word.toUpperCase();
      if (["CRO", "SEO", "AB", "AI"].includes(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Parse frontmatter from SKILL.md content
// ---------------------------------------------------------------------------

function parseFrontmatter(raw: string): {
  name: string;
  description: string;
  content: string;
} {
  const trimmed = raw.trim();

  // Split on --- delimiters
  if (!trimmed.startsWith("---")) {
    return { name: "", description: "", content: trimmed };
  }

  const secondDash = trimmed.indexOf("---", 3);
  if (secondDash === -1) {
    return { name: "", description: "", content: trimmed };
  }

  const frontmatterBlock = trimmed.slice(3, secondDash).trim();
  const body = trimmed.slice(secondDash + 3).trim();

  // Parse YAML-like frontmatter (simple key: value)
  let name = "";
  let description = "";

  for (const line of frontmatterBlock.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (key === "name") name = value;
    if (key === "description") description = value;
  }

  return { name, description, content: body };
}

// ---------------------------------------------------------------------------
// Skill type
// ---------------------------------------------------------------------------

interface Skill {
  slug: string;
  name: string;
  displayName: string;
  description: string;
  content: string;
  category: string;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const skillsDir = path.join(process.cwd(), "src", "data", "marketing-skills");
    const folders = await readdir(skillsDir, { withFileTypes: true });

    const skills: Skill[] = [];

    for (const entry of folders) {
      if (!entry.isDirectory()) continue;

      const slug = entry.name;
      const skillFilePath = path.join(skillsDir, slug, "SKILL.md");

      try {
        const raw = await readFile(skillFilePath, "utf-8");
        const { name, description, content } = parseFrontmatter(raw);

        skills.push({
          slug,
          name: name || slug,
          displayName: prettifySlug(slug),
          description,
          content,
          category: deriveCategory(slug),
        });
      } catch {
        // Skip folders without a SKILL.md file
        continue;
      }
    }

    // Sort alphabetically by display name
    skills.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return NextResponse.json({ data: { skills } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load skills";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
