# Leads AI Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Website Leads page as a split-panel layout with AI lead qualification (scoring 0-100), automated email drafting/sending via SMTP, and a 4-step follow-up sequence.

**Architecture:** Gravity Forms leads are fetched, scored by Claude Haiku 4.5, then Claude Sonnet 4 drafts personalized emails. Nodemailer sends via Google Workspace SMTP (prabhu@creativenexus.in). Scores and emails are stored in 3 Supabase tables. A cron endpoint processes scheduled follow-ups.

**Tech Stack:** Next.js 14 App Router, Supabase PostgreSQL, Claude API (via existing `callClaude`), Nodemailer, Tailwind CSS + shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-16-leads-ai-agents-design.md`

---

## File Structure

```
NEW files:
  src/lib/email.ts                             — Nodemailer SMTP transport wrapper
  src/lib/email-signature.ts                   — Prabhu K HTML signature constant
  src/lib/leads/types.ts                       — Shared types for lead scoring, emails, followups
  src/lib/leads/prompts.ts                     — AI system prompts for qualification + email drafting
  src/app/api/leads/qualify/route.ts           — POST: score leads via Claude Haiku
  src/app/api/leads/draft-email/route.ts       — POST: draft email via Claude Sonnet
  src/app/api/leads/send-email/route.ts        — POST: send email via Nodemailer
  src/app/api/leads/[leadId]/action/route.ts   — POST: mark spam/qualified/close/stop followups
  src/app/api/leads/followups/process/route.ts — POST: process due follow-ups (cron)
  supabase/migrations/20260416120000_lead_agents.sql — 3 tables + RLS

MODIFIED files:
  src/app/(dashboard)/leads/page.tsx           — Full rewrite: split-panel layout
  src/app/(dashboard)/settings/page.tsx        — Add lead qualification threshold settings
  package.json                                 — Add nodemailer dependency
```

---

### Task 1: Install Nodemailer and Create Database Tables

**Files:**
- Modify: `package.json`
- Create: `supabase/migrations/20260416120000_lead_agents.sql`

- [ ] **Step 1: Install nodemailer**

```bash
cd "/Users/New Mac files/cnx ai plans 2026/CNX Agency Command Centre 2026"
npm install nodemailer @types/nodemailer
```

Expected: Package added to `package.json` dependencies.

- [ ] **Step 2: Create the migration SQL file**

Create `supabase/migrations/20260416120000_lead_agents.sql`:

```sql
-- Lead Qualification Scores
CREATE TABLE IF NOT EXISTS lead_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text UNIQUE NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  reasoning text NOT NULL DEFAULT '',
  qualified boolean NOT NULL DEFAULT false,
  spam boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'closed', 'spam')),
  org_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_scores_lead_id ON lead_scores(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_score ON lead_scores(score);
CREATE INDEX IF NOT EXISTS idx_lead_scores_org_id ON lead_scores(org_id);

ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_scores_org_access" ON lead_scores
  FOR ALL USING (org_id = 'a0000000-0000-0000-0000-000000000001'::uuid);

-- Lead Emails (drafts, sent, follow-ups)
CREATE TABLE IF NOT EXISTS lead_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL,
  email_type text NOT NULL CHECK (email_type IN ('acknowledgement', 'followup_1', 'followup_2', 'followup_3', 'followup_4')),
  to_email text NOT NULL,
  cc_emails text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  error text,
  org_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_emails_lead_id ON lead_emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_emails_status ON lead_emails(status);
CREATE INDEX IF NOT EXISTS idx_lead_emails_org_id ON lead_emails(org_id);

ALTER TABLE lead_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_emails_org_access" ON lead_emails
  FOR ALL USING (org_id = 'a0000000-0000-0000-0000-000000000001'::uuid);

-- Lead Follow-up Schedule
CREATE TABLE IF NOT EXISTS lead_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL,
  step integer NOT NULL CHECK (step >= 1 AND step <= 4),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'skipped')),
  email_id uuid REFERENCES lead_emails(id),
  org_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_followups_status_scheduled ON lead_followups(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_lead_followups_lead_id ON lead_followups(lead_id);

ALTER TABLE lead_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_followups_org_access" ON lead_followups
  FOR ALL USING (org_id = 'a0000000-0000-0000-0000-000000000001'::uuid);
```

- [ ] **Step 3: Apply migration to Supabase**

```bash
# Apply via Supabase MCP or direct SQL execution
# Use the Supabase MCP tool: execute_sql with the above SQL
```

- [ ] **Step 4: Verify tables exist**

Run SQL: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'lead_%';`

Expected: `lead_scores`, `lead_emails`, `lead_followups`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json supabase/migrations/20260416120000_lead_agents.sql
git commit -m "feat: add nodemailer + lead agent database tables"
```

---

### Task 2: Create Shared Types and AI Prompts

**Files:**
- Create: `src/lib/leads/types.ts`
- Create: `src/lib/leads/prompts.ts`

- [ ] **Step 1: Create lead types file**

Create `src/lib/leads/types.ts`:

```typescript
// Shared types for lead qualification, email drafting, and follow-up system

export interface LeadScore {
  id: string;
  lead_id: string;
  score: number;
  reasoning: string;
  qualified: boolean;
  spam: boolean;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
}

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "closed" | "spam";

export type EmailType = "acknowledgement" | "followup_1" | "followup_2" | "followup_3" | "followup_4";

export type EmailStatus = "draft" | "queued" | "sent" | "failed" | "cancelled";

export type FollowupStatus = "pending" | "sent" | "cancelled" | "skipped";

export interface LeadEmail {
  id: string;
  lead_id: string;
  email_type: EmailType;
  to_email: string;
  cc_emails: string[];
  subject: string;
  body_html: string;
  body_text: string;
  status: EmailStatus;
  sent_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadFollowup {
  id: string;
  lead_id: string;
  step: number;
  scheduled_for: string;
  status: FollowupStatus;
  email_id: string | null;
  created_at: string;
}

// Data shape from /api/leads/website
export interface LeadData {
  id: string;
  source: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  services: string[];
  value: number;
  status: string;
  date: string;
  meta: Record<string, unknown>;
}

// Thresholds
export const LEAD_THRESHOLDS = {
  autoSend: 85,
  review: 50,
  spam: 50,
} as const;

// Follow-up intervals in days
export const FOLLOWUP_INTERVALS = [2, 4, 7, 14] as const;

// Default org ID (single-tenant for now)
export const ORG_ID = "a0000000-0000-0000-0000-000000000001";
```

- [ ] **Step 2: Create AI prompts file**

Create `src/lib/leads/prompts.ts`:

```typescript
import { EmailType } from "./types";

export const QUALIFICATION_PROMPT = `You are a lead qualification specialist for Creative Nexus, a digital marketing and design agency in India.

Score this form submission from 0 to 100 based on how likely it is a genuine business inquiry.

Scoring criteria:
- Name quality: Real human name vs garbled/random text (0-15 points)
- Email quality: Business domain > personal domain > disposable domain (0-15 points)
- Phone format: Valid Indian/international number vs random digits (0-10 points)
- Message quality: Clear business need, coherent sentences, specific ask (0-30 points)
- Company presence: Named company > no company (0-10 points)
- Service selection: Selected specific services > none (0-10 points)
- reCAPTCHA score: High recaptcha > low/missing (0-10 points)

Red flags (reduce score significantly):
- Garbled/random characters in name or company
- reCAPTCHA score below 0.3
- Message is nonsensical or clearly automated
- Email from known spam domains
- All fields filled with identical gibberish

Return JSON only: { "score": <number>, "reasoning": "<one sentence>" }`;

export function buildEmailPrompt(emailType: EmailType, previousEmails?: string[]): string {
  const previousContext = previousEmails && previousEmails.length > 0
    ? `\n\nPREVIOUS EMAILS SENT TO THIS LEAD (do NOT repeat content):\n${previousEmails.join("\n---\n")}`
    : "";

  return `You are writing an email on behalf of Prabhu K, Co-founder & Managing Director of Creative Nexus India — a digital marketing, branding, and design agency.

VOICE AND TONE:
- Write exactly like a real person. Warm, genuine, and direct.
- Professional but not corporate. Friendly but not casual.
- NEVER sound like AI. Avoid: "I hope this email finds you well", "As per your inquiry", "I wanted to reach out", "Please don't hesitate", "Looking forward to hearing from you", "I trust this message", "At your earliest convenience".
- Use natural transitions. Write how Prabhu would actually speak to a potential client.
- Correct grammar, proper punctuation, no filler words.
- Soft and professional, not salesy or pushy.

CONTENT RULES:
- Stay locked to exactly what the person filled in their form — their name, company, services they asked about, their specific message.
- Reference their actual words or needs. Show you read what they wrote.
- Keep emails concise: 3-4 short paragraphs max.
- Every email MUST have a clear call-to-action (CTA).
- Never make up details about Creative Nexus's work that weren't provided.
- For follow-ups: provide NEW value each time (case study, stat, insight, resource). Never just "checking in".

ABOUT CREATIVE NEXUS:
- Full-service digital agency: branding, web design, SEO, social media, content, paid ads, video, UI/UX
- Offices in Bengaluru, Gurugram, Delhi
- Website: creativenexus.in / creativenexusglobal.com
- Contact page: https://www.creativenexus.in/contact

EMAIL TYPE: ${emailType}
${emailType === "acknowledgement" ? "Thank them, acknowledge their specific need, suggest next step." : ""}
${emailType === "followup_1" ? "Share a relevant insight matching their inquiry. CTA: 'Take a look and let us know if this is the direction you are thinking.'" : ""}
${emailType === "followup_2" ? "Offer a specific stat or trend in their industry. CTA: 'Happy to walk you through how this applies to your business.'" : ""}
${emailType === "followup_3" ? "Suggest a quick 15-min call. CTA: 'Pick a slot that works — no pressure, just a quick chat.' Include link: https://www.creativenexus.in/contact" : ""}
${emailType === "followup_4" ? "Final gentle nudge with a different angle or free resource. CTA: 'Whenever you are ready, we are here. Here is something useful in the meantime.'" : ""}
${previousContext}

Return JSON only: { "subject": "<subject line>", "body": "<email body in HTML paragraphs, NO signature>" }`;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/leads/types.ts src/lib/leads/prompts.ts
git commit -m "feat: add lead agent shared types and AI prompts"
```

---

### Task 3: Create Email Infrastructure

**Files:**
- Create: `src/lib/email-signature.ts`
- Create: `src/lib/email.ts`

- [ ] **Step 1: Create email signature constant**

Create `src/lib/email-signature.ts`:

```typescript
export const PRABHU_SIGNATURE_HTML = `
<br><br>
<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; color: #333; line-height: 1.5;">
  <tr><td style="padding-bottom: 8px;">
    <strong style="font-size: 14px;">Prabhu K</strong><br>
    Co-founder &amp; Managing Director
  </td></tr>
  <tr><td style="padding-bottom: 8px;">
    <strong>Creative Nexus, India</strong>
  </td></tr>
  <tr><td style="font-size: 12px; color: #555; padding-bottom: 4px;">
    <strong>Bengaluru</strong> : Wework Building : No. 78/9, Outer Ring Road, Bellandur Village Varthur Hobli Bengaluru, Karnataka 560103
  </td></tr>
  <tr><td style="font-size: 12px; color: #555; padding-bottom: 4px;">
    <strong>Gurgaon</strong> : Plot # 1SP, Sector 27, Golf Course Road, Sector 27, Gurugram, Haryana, India
  </td></tr>
  <tr><td style="font-size: 12px; color: #555; padding-bottom: 8px;">
    <strong>Regd</strong> : 149, DFA, Nimri, Ashok Vihar -IV, Delhi, India
  </td></tr>
  <tr><td style="font-size: 12px; padding-bottom: 10px;">
    <strong>Mob:</strong> +91 9999212010 / 9019321894 |
    <strong>Email:</strong> <a href="mailto:prabhu@creativenexus.in" style="color: #2563eb;">prabhu@creativenexus.in</a> |
    <strong>Web:</strong> <a href="https://www.creativenexus.in" style="color: #2563eb;">www.creativenexus.in</a> |
    <a href="https://www.creativenexus.in/contact" style="color: #dc2626; font-weight: bold; text-decoration: none;"><strong>Book a Call Now</strong></a>
  </td></tr>
  <tr><td>
    <img src="https://creativenexus.in/wp-content/uploads/creative-nexus-logo.png" alt="Creative Nexus" style="height: 40px;" />
    <br><span style="font-size: 10px; color: #999;">Connect. Create. Thrive.</span>
  </td></tr>
</table>`;
```

- [ ] **Step 2: Create Nodemailer SMTP wrapper**

Create `src/lib/email.ts`:

```typescript
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendEmailOptions {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(
  options: SendEmailOptions,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const fromName = process.env.SMTP_FROM_NAME || "Creative Nexus";
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { success: false, error: "SMTP credentials not configured" };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      cc: options.cc?.join(", "),
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""),
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP send failed";
    console.error("[email] Send failed:", message);
    return { success: false, error: message };
  }
}

export function getDefaultCc(): string[] {
  const cc = process.env.SMTP_CC || "";
  return cc.split(",").map((e) => e.trim()).filter(Boolean);
}
```

- [ ] **Step 3: Verify SMTP connection works**

```bash
cd "/Users/New Mac files/cnx ai plans 2026/CNX Agency Command Centre 2026"
npx tsx -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 587, secure: false,
  auth: { user: 'prabhu@creativenexus.in', pass: 'mmwa yclf xnbj xqqp' }
});
t.verify().then(() => console.log('SMTP OK')).catch(e => console.error('SMTP FAIL:', e.message));
"
```

Expected: `SMTP OK`

- [ ] **Step 4: Commit**

```bash
git add src/lib/email-signature.ts src/lib/email.ts
git commit -m "feat: add email signature and Nodemailer SMTP wrapper"
```

---

### Task 4: Lead Qualification API

**Files:**
- Create: `src/app/api/leads/qualify/route.ts`

- [ ] **Step 1: Create the qualification endpoint**

Create `src/app/api/leads/qualify/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { QUALIFICATION_PROMPT } from "@/lib/leads/prompts";
import { LeadData, LEAD_THRESHOLDS, ORG_ID } from "@/lib/leads/types";

export async function POST(request: NextRequest) {
  const { leads } = (await request.json()) as { leads: LeadData[] };

  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: "No leads provided" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get already-scored lead IDs
  const leadIds = leads.map((l) => l.id);
  const { data: existing } = await supabase
    .from("lead_scores")
    .select("lead_id")
    .in("lead_id", leadIds);

  const scoredIds = new Set((existing || []).map((r) => r.lead_id));
  const unscored = leads.filter((l) => !scoredIds.has(l.id));

  if (unscored.length === 0) {
    return NextResponse.json({
      data: { qualified: 0, review: 0, spam: 0, newScores: 0, alreadyScored: leads.length },
    });
  }

  let qualified = 0;
  let review = 0;
  let spam = 0;
  const scores: Array<{ lead_id: string; score: number; reasoning: string }> = [];

  // Score each lead (batch of up to 20 at a time)
  for (const lead of unscored.slice(0, 50)) {
    try {
      const userMessage = `Lead submission:
Name: ${lead.name}
Email: ${lead.email}
Phone: ${lead.phone}
Company: ${lead.company}
Message: ${lead.message}
Services: ${lead.services.join(", ") || "none selected"}
Form: ${lead.meta.form_title || "unknown"}
reCAPTCHA: ${lead.meta.recaptcha_score ?? "not available"}
Source URL: ${lead.meta.source_url || "unknown"}`;

      const { text } = await callClaude({
        tier: "research",
        systemPrompt: QUALIFICATION_PROMPT,
        userMessage,
        maxTokens: 256,
        temperature: 0.2,
      });

      const parsed = parseClaudeJson(text) as { score: number; reasoning: string };
      const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
      const reasoning = parsed.reasoning || "";

      const isQualified = score >= LEAD_THRESHOLDS.autoSend;
      const isSpam = score < LEAD_THRESHOLDS.spam;

      // Store score
      await supabase.from("lead_scores").upsert({
        lead_id: lead.id,
        score,
        reasoning,
        qualified: isQualified,
        spam: isSpam,
        status: isSpam ? "spam" : isQualified ? "new" : "new",
        org_id: ORG_ID,
        updated_at: new Date().toISOString(),
      }, { onConflict: "lead_id" });

      if (isQualified) qualified++;
      else if (isSpam) spam++;
      else review++;

      scores.push({ lead_id: lead.id, score, reasoning });
    } catch (err) {
      console.error(`[qualify] Failed to score ${lead.id}:`, err);
    }
  }

  // Send notification summary
  await createNotification({
    title: `Qualified ${unscored.length} leads`,
    message: `${qualified} genuine, ${review} for review, ${spam} spam`,
    category: "leads",
    priority: qualified > 0 ? "high" : "medium",
    sourceModule: "leads",
    sourceUrl: "/leads",
  });

  return NextResponse.json({
    data: {
      qualified,
      review,
      spam,
      newScores: scores.length,
      alreadyScored: leads.length - unscored.length,
      scores,
    },
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/leads/qualify/route.ts
git commit -m "feat: add lead qualification API with Claude Haiku scoring"
```

---

### Task 5: Email Drafting API

**Files:**
- Create: `src/app/api/leads/draft-email/route.ts`

- [ ] **Step 1: Create the draft email endpoint**

Create `src/app/api/leads/draft-email/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRABHU_SIGNATURE_HTML } from "@/lib/email-signature";
import { buildEmailPrompt } from "@/lib/leads/prompts";
import {
  EmailType,
  EmailStatus,
  LeadData,
  LEAD_THRESHOLDS,
  FOLLOWUP_INTERVALS,
  ORG_ID,
} from "@/lib/leads/types";
import { getDefaultCc } from "@/lib/email";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    lead_id: string;
    lead_data: LeadData;
    email_type: EmailType;
    previous_emails?: string[];
    auto_send?: boolean;
  };

  const { lead_id, lead_data, email_type, previous_emails } = body;

  if (!lead_id || !lead_data || !email_type) {
    return NextResponse.json(
      { error: "Missing lead_id, lead_data, or email_type" },
      { status: 400 },
    );
  }

  if (!lead_data.email) {
    return NextResponse.json(
      { error: "Lead has no email address" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const cc = getDefaultCc();

  // Build context for Claude
  const userMessage = `Draft an email for this lead:

Name: ${lead_data.name}
Email: ${lead_data.email}
Company: ${lead_data.company || "not provided"}
Phone: ${lead_data.phone || "not provided"}
Message they sent: ${lead_data.message || "no message"}
Services interested in: ${lead_data.services.join(", ") || "not specified"}
Form they used: ${lead_data.meta.form_title || "contact form"}
Source page: ${lead_data.meta.source_url || "website"}`;

  try {
    const systemPrompt = buildEmailPrompt(email_type, previous_emails);

    const { text } = await callClaude({
      tier: "execution",
      systemPrompt,
      userMessage,
      maxTokens: 1024,
      temperature: 0.6,
    });

    const parsed = parseClaudeJson(text) as { subject: string; body: string };

    if (!parsed.subject || !parsed.body) {
      return NextResponse.json(
        { error: "AI failed to generate valid email content" },
        { status: 500 },
      );
    }

    // Append signature to body
    const fullBodyHtml = parsed.body + PRABHU_SIGNATURE_HTML;
    const fullBodyText = fullBodyHtml.replace(/<[^>]*>/g, "");

    // Determine status: auto-send if score 85+ and acknowledgement
    let status: EmailStatus = "draft";
    if (body.auto_send && email_type === "acknowledgement") {
      status = "queued";
    }

    // Store in lead_emails
    const { data: emailRow, error: insertError } = await supabase
      .from("lead_emails")
      .insert({
        lead_id,
        email_type,
        to_email: lead_data.email,
        cc_emails: cc,
        subject: parsed.subject,
        body_html: fullBodyHtml,
        body_text: fullBodyText,
        status,
        org_id: ORG_ID,
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to store email: ${insertError.message}` },
        { status: 500 },
      );
    }

    // If this is an acknowledgement and auto-send is on, schedule follow-ups
    // (actual sending happens in send-email route, follow-ups created after send)

    return NextResponse.json({
      data: {
        email_id: emailRow.id,
        subject: parsed.subject,
        body_html: fullBodyHtml,
        status,
        auto_send: status === "queued",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email draft failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/leads/draft-email/route.ts
git commit -m "feat: add email drafting API with Claude Sonnet + signature"
```

---

### Task 6: Email Sending API

**Files:**
- Create: `src/app/api/leads/send-email/route.ts`

- [ ] **Step 1: Create the send email endpoint**

Create `src/app/api/leads/send-email/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { FOLLOWUP_INTERVALS, ORG_ID } from "@/lib/leads/types";

export async function POST(request: NextRequest) {
  const { email_id } = (await request.json()) as { email_id: string };

  if (!email_id) {
    return NextResponse.json({ error: "Missing email_id" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Load the email
  const { data: emailRow, error: fetchError } = await supabase
    .from("lead_emails")
    .select("*")
    .eq("id", email_id)
    .single();

  if (fetchError || !emailRow) {
    return NextResponse.json(
      { error: `Email not found: ${fetchError?.message || "no record"}` },
      { status: 404 },
    );
  }

  if (emailRow.status === "sent") {
    return NextResponse.json(
      { error: "Email already sent" },
      { status: 400 },
    );
  }

  // Send via SMTP
  const result = await sendEmail({
    to: emailRow.to_email,
    cc: emailRow.cc_emails,
    subject: emailRow.subject,
    html: emailRow.body_html,
    text: emailRow.body_text,
  });

  if (!result.success) {
    // Mark as failed
    await supabase
      .from("lead_emails")
      .update({
        status: "failed",
        error: result.error,
        updated_at: new Date().toISOString(),
      })
      .eq("id", email_id);

    await createNotification({
      title: `Email to ${emailRow.to_email} failed`,
      message: result.error || "SMTP error",
      category: "leads",
      priority: "high",
      sourceModule: "leads",
      sourceUrl: "/leads",
    });

    return NextResponse.json(
      { error: result.error },
      { status: 500 },
    );
  }

  // Mark as sent
  const now = new Date().toISOString();
  await supabase
    .from("lead_emails")
    .update({ status: "sent", sent_at: now, updated_at: now })
    .eq("id", email_id);

  // Update lead_scores status to 'contacted'
  await supabase
    .from("lead_scores")
    .update({ status: "contacted", updated_at: now })
    .eq("lead_id", emailRow.lead_id);

  // If this is an acknowledgement, schedule follow-ups
  if (emailRow.email_type === "acknowledgement") {
    const baseDate = new Date();
    const followupRows = FOLLOWUP_INTERVALS.map((days, i) => ({
      lead_id: emailRow.lead_id,
      step: i + 1,
      scheduled_for: new Date(baseDate.getTime() + days * 86400000).toISOString(),
      status: "pending" as const,
      org_id: ORG_ID,
    }));

    await supabase.from("lead_followups").insert(followupRows);
  }

  // Notification
  const isFollowup = emailRow.email_type.startsWith("followup_");
  await createNotification({
    title: isFollowup
      ? `Follow-up ${emailRow.email_type.replace("followup_", "")} sent to ${emailRow.to_email}`
      : `Email sent to ${emailRow.to_email}`,
    message: `Subject: ${emailRow.subject}`,
    category: "leads",
    priority: "medium",
    sourceModule: "leads",
    sourceUrl: "/leads",
  });

  return NextResponse.json({
    data: { success: true, messageId: result.messageId },
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/leads/send-email/route.ts
git commit -m "feat: add email sending API with SMTP + follow-up scheduling"
```

---

### Task 7: Lead Action API

**Files:**
- Create: `src/app/api/leads/[leadId]/action/route.ts`

- [ ] **Step 1: Create the lead action endpoint**

Create `src/app/api/leads/[leadId]/action/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ID } from "@/lib/leads/types";

type LeadAction = "mark_spam" | "mark_qualified" | "close" | "stop_followups";

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } },
) {
  const { leadId } = params;
  const { action } = (await request.json()) as { action: LeadAction };

  if (!leadId || !action) {
    return NextResponse.json(
      { error: "Missing leadId or action" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  switch (action) {
    case "mark_spam": {
      await supabase
        .from("lead_scores")
        .update({ spam: true, qualified: false, status: "spam", updated_at: now })
        .eq("lead_id", leadId);

      // Cancel all pending follow-ups and emails
      await supabase
        .from("lead_followups")
        .update({ status: "cancelled" })
        .eq("lead_id", leadId)
        .eq("status", "pending");

      await supabase
        .from("lead_emails")
        .update({ status: "cancelled", updated_at: now })
        .eq("lead_id", leadId)
        .in("status", ["draft", "queued"]);

      break;
    }

    case "mark_qualified": {
      await supabase
        .from("lead_scores")
        .update({ qualified: true, spam: false, status: "qualified", updated_at: now })
        .eq("lead_id", leadId);
      break;
    }

    case "close": {
      await supabase
        .from("lead_scores")
        .update({ status: "closed", updated_at: now })
        .eq("lead_id", leadId);

      // Cancel pending follow-ups
      await supabase
        .from("lead_followups")
        .update({ status: "cancelled" })
        .eq("lead_id", leadId)
        .eq("status", "pending");

      break;
    }

    case "stop_followups": {
      await supabase
        .from("lead_followups")
        .update({ status: "cancelled" })
        .eq("lead_id", leadId)
        .eq("status", "pending");
      break;
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ data: { success: true, action, leadId } });
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npx tsc --noEmit 2>&1 | head -10
git add src/app/api/leads/\[leadId\]/action/route.ts
git commit -m "feat: add lead action API (mark spam/qualified/close/stop)"
```

---

### Task 8: Follow-up Processor API

**Files:**
- Create: `src/app/api/leads/followups/process/route.ts`

- [ ] **Step 1: Create the follow-up processor**

Create `src/app/api/leads/followups/process/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { sendEmail, getDefaultCc } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { PRABHU_SIGNATURE_HTML } from "@/lib/email-signature";
import { buildEmailPrompt } from "@/lib/leads/prompts";
import { EmailType, ORG_ID } from "@/lib/leads/types";

export async function POST() {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const cc = getDefaultCc();

  // Get due follow-ups
  const { data: dueFollowups, error: fetchError } = await supabase
    .from("lead_followups")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(20);

  if (fetchError || !dueFollowups || dueFollowups.length === 0) {
    return NextResponse.json({
      data: { processed: 0, sent: 0, cancelled: 0, failed: 0 },
    });
  }

  let sent = 0;
  let cancelled = 0;
  let failed = 0;

  for (const followup of dueFollowups) {
    try {
      // Check if lead is still active (not spam, not closed)
      const { data: scoreRow } = await supabase
        .from("lead_scores")
        .select("status, spam")
        .eq("lead_id", followup.lead_id)
        .single();

      if (!scoreRow || scoreRow.spam || scoreRow.status === "closed" || scoreRow.status === "spam") {
        // Cancel this and all remaining follow-ups for this lead
        await supabase
          .from("lead_followups")
          .update({ status: "cancelled" })
          .eq("lead_id", followup.lead_id)
          .eq("status", "pending");
        cancelled++;
        continue;
      }

      // Get previous emails for context
      const { data: previousEmails } = await supabase
        .from("lead_emails")
        .select("subject, body_text")
        .eq("lead_id", followup.lead_id)
        .eq("status", "sent")
        .order("created_at", { ascending: true });

      const previousTexts = (previousEmails || []).map(
        (e) => `Subject: ${e.subject}\n${e.body_text.slice(0, 300)}`,
      );

      // Get lead data from the acknowledgement email's to_email
      const { data: ackEmail } = await supabase
        .from("lead_emails")
        .select("to_email, body_text, subject")
        .eq("lead_id", followup.lead_id)
        .eq("email_type", "acknowledgement")
        .single();

      if (!ackEmail) {
        await supabase
          .from("lead_followups")
          .update({ status: "skipped" })
          .eq("id", followup.id);
        continue;
      }

      // Draft follow-up email
      const emailType = `followup_${followup.step}` as EmailType;
      const systemPrompt = buildEmailPrompt(emailType, previousTexts);

      // Build a minimal context from what we know
      const userMessage = `Draft follow-up ${followup.step} for this lead:

Email: ${ackEmail.to_email}
Previous acknowledgement subject: ${ackEmail.subject}
Previous email content summary: ${ackEmail.body_text.slice(0, 500)}

This is follow-up ${followup.step} of 4. Make it feel natural and provide new value.`;

      const { text } = await callClaude({
        tier: "execution",
        systemPrompt,
        userMessage,
        maxTokens: 1024,
        temperature: 0.6,
      });

      const parsed = parseClaudeJson(text) as { subject: string; body: string };

      if (!parsed.subject || !parsed.body) {
        failed++;
        continue;
      }

      const fullBodyHtml = parsed.body + PRABHU_SIGNATURE_HTML;

      // Store the email
      const { data: emailRow } = await supabase
        .from("lead_emails")
        .insert({
          lead_id: followup.lead_id,
          email_type: emailType,
          to_email: ackEmail.to_email,
          cc_emails: cc,
          subject: parsed.subject,
          body_html: fullBodyHtml,
          body_text: fullBodyHtml.replace(/<[^>]*>/g, ""),
          status: "queued",
          org_id: ORG_ID,
        })
        .select("id")
        .single();

      if (!emailRow) {
        failed++;
        continue;
      }

      // Send it
      const result = await sendEmail({
        to: ackEmail.to_email,
        cc,
        subject: parsed.subject,
        html: fullBodyHtml,
      });

      if (result.success) {
        await supabase
          .from("lead_emails")
          .update({ status: "sent", sent_at: now, updated_at: now })
          .eq("id", emailRow.id);

        await supabase
          .from("lead_followups")
          .update({ status: "sent", email_id: emailRow.id })
          .eq("id", followup.id);

        sent++;
      } else {
        await supabase
          .from("lead_emails")
          .update({ status: "failed", error: result.error, updated_at: now })
          .eq("id", emailRow.id);

        failed++;
      }
    } catch (err) {
      console.error(`[followup] Error processing ${followup.id}:`, err);
      failed++;
    }
  }

  if (sent > 0) {
    await createNotification({
      title: `${sent} follow-up email${sent > 1 ? "s" : ""} sent`,
      message: `Processed ${dueFollowups.length} due follow-ups`,
      category: "leads",
      priority: "medium",
      sourceModule: "leads",
      sourceUrl: "/leads",
    });
  }

  return NextResponse.json({
    data: { processed: dueFollowups.length, sent, cancelled, failed },
  });
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npx tsc --noEmit 2>&1 | head -10
git add src/app/api/leads/followups/process/route.ts
git commit -m "feat: add follow-up processor API with AI drafting + SMTP"
```

---

### Task 9: Rewrite Leads Page — Split Panel Layout

**Files:**
- Rewrite: `src/app/(dashboard)/leads/page.tsx`

This is the largest task. The page is a full rewrite from tabular list to split panel.

- [ ] **Step 1: Write the complete split panel page**

Rewrite `src/app/(dashboard)/leads/page.tsx`. The page must:

**State management:**
- `leads: LeadData[]` — raw leads from `/api/leads/website`
- `scores: Map<string, { score, reasoning, status }>` — from `/api/leads/qualify` and Supabase
- `emails: Map<string, LeadEmail[]>` — emails per lead from Supabase
- `followups: Map<string, LeadFollowup[]>` — follow-ups per lead
- `selectedLeadId: string | null` — currently selected lead
- `filter: "all" | "qualified" | "review" | "spam"` — left panel filter
- `search: string` — search query
- `qualifying: boolean` — loading state for AI scoring
- `draftingEmail: boolean` — loading state for email generation
- `sendingEmail: boolean` — loading state for sending

**Data flow on page load:**
1. Fetch leads from `/api/leads/website`
2. Fetch existing scores from Supabase `lead_scores`
3. Fetch existing emails from Supabase `lead_emails`
4. Fetch existing follow-ups from Supabase `lead_followups`
5. Merge scores with leads for display

**"Qualify All" button** in the header:
- Calls `POST /api/leads/qualify` with all unscored leads
- Shows progress notification
- Refreshes scores after completion

**Left panel interactions:**
- Click lead → set `selectedLeadId`, show detail in right panel
- Filter pills filter the list by score range
- Search filters by name/email/company

**Right panel interactions:**
- Shows full lead detail when selected
- "Send Email" → calls `POST /api/leads/send-email`
- "Edit Draft" → makes email body contentEditable
- "Regenerate" → calls `POST /api/leads/draft-email` again
- "Mark Spam" → calls `POST /api/leads/{id}/action`
- Follow-up timeline shows scheduled dates and statuses

**Key UI patterns** (match existing dashboard pages):
- `PageHeader` component for title + actions
- `MetricCard` for top stats
- `StatusBadge` for score/status pills
- Apple macOS styling: `bg-background-secondary`, `rounded-[10px]`, `dark:border dark:border-border`

The full page implementation is approximately 600-800 lines. The implementing agent should:
1. Build the left panel (lead list with filters) first
2. Build the right panel (detail + email preview) second
3. Wire up all API calls third
4. Add loading/error/empty states last

Reference the wireframe in `.superpowers/brainstorm/38889-1776292981/content/split-panel-detail.html` for the exact visual structure.

Reference the existing page at `src/app/(dashboard)/leads/page.tsx` for import patterns and component usage.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Test in browser**

Open `http://localhost:3000/leads` and verify:
- Left panel shows leads with scores
- Clicking a lead shows detail in right panel
- "Qualify All" button triggers scoring
- Email preview shows for scored leads
- Filters work correctly

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/leads/page.tsx
git commit -m "feat: rewrite leads page as split-panel with AI scoring + email"
```

---

### Task 10: Add Lead Threshold Settings

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Add lead qualification section to Platform Settings tab**

In `src/app/(dashboard)/settings/page.tsx`, locate the Platform Settings tab content (the second tab). Add a new section after the existing Outreach Configuration section.

Add these fields to the `AgencyConfig` interface:
```typescript
lead_auto_send_threshold?: number;
lead_review_threshold?: number;
lead_followup_intervals?: string;
lead_max_followups?: number;
```

Add a new section in the Platform Settings tab:

```tsx
{/* Lead Qualification */}
<div className="bg-background-secondary rounded-[10px] p-4 dark:border dark:border-border">
  <h3 className="text-[13px] font-semibold text-foreground mb-3">
    Lead Qualification
  </h3>
  <div className="grid grid-cols-2 gap-3">
    <div>
      <label className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
        Auto-send threshold
      </label>
      <input
        type="number"
        min={0}
        max={100}
        value={config.lead_auto_send_threshold ?? 85}
        onChange={(e) =>
          setConfig({ ...config, lead_auto_send_threshold: parseInt(e.target.value) || 85 })
        }
        className="mt-1 w-full px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm"
      />
      <p className="text-[10px] text-foreground-tertiary mt-1">
        Score at or above this auto-sends email (0-100)
      </p>
    </div>
    <div>
      <label className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
        Spam threshold
      </label>
      <input
        type="number"
        min={0}
        max={100}
        value={config.lead_review_threshold ?? 50}
        onChange={(e) =>
          setConfig({ ...config, lead_review_threshold: parseInt(e.target.value) || 50 })
        }
        className="mt-1 w-full px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm"
      />
      <p className="text-[10px] text-foreground-tertiary mt-1">
        Score below this flagged as spam (0-100)
      </p>
    </div>
    <div>
      <label className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
        Follow-up intervals (days)
      </label>
      <input
        type="text"
        value={config.lead_followup_intervals ?? "2, 4, 7, 14"}
        onChange={(e) =>
          setConfig({ ...config, lead_followup_intervals: e.target.value })
        }
        className="mt-1 w-full px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm"
      />
      <p className="text-[10px] text-foreground-tertiary mt-1">
        Comma-separated days between follow-ups
      </p>
    </div>
    <div>
      <label className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
        Max follow-ups
      </label>
      <input
        type="number"
        min={1}
        max={10}
        value={config.lead_max_followups ?? 4}
        onChange={(e) =>
          setConfig({ ...config, lead_max_followups: parseInt(e.target.value) || 4 })
        }
        className="mt-1 w-full px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm"
      />
      <p className="text-[10px] text-foreground-tertiary mt-1">
        Stop follow-up sequence after this many
      </p>
    </div>
  </div>
  <button
    onClick={() =>
      saveSection("lead_qualification", {
        lead_auto_send_threshold: config.lead_auto_send_threshold,
        lead_review_threshold: config.lead_review_threshold,
        lead_followup_intervals: config.lead_followup_intervals,
        lead_max_followups: config.lead_max_followups,
      })
    }
    className="mt-3 px-4 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
  >
    Save Lead Settings
  </button>
</div>
```

- [ ] **Step 2: Type-check and test in browser**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Open Settings page, verify the Lead Qualification section appears and saves correctly.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add lead qualification threshold settings"
```

---

### Task 11: End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No warnings or errors.

- [ ] **Step 3: Test lead qualification flow**

```bash
# Fetch leads
curl -s http://localhost:3000/api/leads/website | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Leads: {d[\"data\"][\"total\"]}')"

# Score first 5 leads
curl -s -X POST http://localhost:3000/api/leads/qualify \
  -H "Content-Type: application/json" \
  -d '{"leads": [...first 5 leads from above...]}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, indent=2))"
```

Expected: Scores returned with reasoning.

- [ ] **Step 4: Test email draft + send**

```bash
# Draft an email for a qualified lead
curl -s -X POST http://localhost:3000/api/leads/draft-email \
  -H "Content-Type: application/json" \
  -d '{"lead_id": "gf_1_829", "lead_data": {...lead data...}, "email_type": "acknowledgement"}'

# Send the drafted email
curl -s -X POST http://localhost:3000/api/leads/send-email \
  -H "Content-Type: application/json" \
  -d '{"email_id": "...id from draft response..."}'
```

Expected: Email arrives in prabhu@creativenexus.in inbox with CC to tisha@ and rishabh@.

- [ ] **Step 5: Test in browser**

Open `http://localhost:3000/leads`:
1. Verify split panel layout renders
2. Click "Qualify All" — leads get scored
3. Select a qualified lead — email draft appears
4. Click "Send Email" — email sends
5. Verify follow-ups are scheduled in the timeline

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete leads AI agents — qualification, email, follow-ups"
```
