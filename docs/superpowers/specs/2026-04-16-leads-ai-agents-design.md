# Leads Page Redesign + AI Qualification & Email Agents

**Date:** 2026-04-16
**Status:** Design approved
**Author:** Prabhu K / Claude

---

## Overview

Redesign the Website Leads page from a flat table into a **split-panel (mail-style) layout** with two AI agents: a **Lead Qualification Agent** that scores every lead 0-100, and an **Email Manager Agent** that drafts and sends personalized acknowledgement emails with a 4-step follow-up sequence. Emails are sent via Google Workspace SMTP from prabhu@creativenexus.in, CC'd to tisha@, prabhu@, rishabh@creativenexus.in.

---

## 1. Architecture

### Components

| Component | Purpose | Model / Tool |
|-----------|---------|-------------|
| Lead Qualification Agent | Score leads 0-100, filter spam | Claude Haiku 4.5 (fast, cheap) |
| Email Drafting Agent | Draft acknowledgement + follow-up emails | Claude Sonnet 4 (better writing) |
| Email Sender | Send via SMTP, log results | Nodemailer + Google Workspace |
| Follow-up Scheduler | Schedule and process follow-up emails | Supabase table + cron API route |
| Leads Page UI | Split-panel layout with filters and email preview | Next.js React client component |

### Data Flow

```
Gravity Forms → /api/leads/website (fetch)
                      ↓
              /api/leads/qualify (Claude Haiku)
                      ↓
                Score 85+? ──→ /api/leads/draft-email (Claude Sonnet) → Auto-send via SMTP
                Score 50-84? → /api/leads/draft-email → Queue for human review in UI
                Score <50? ──→ Flag as spam, hide from default view
                      ↓
              After send → Schedule 4 follow-ups in lead_followups table
                      ↓
              /api/leads/followups/process (hourly cron) → Send due follow-ups
```

### Stop Triggers (halt follow-up sequence)

- Team clicks "Stop Follow-ups" or "Mark Converted" or "Close" in the UI (primary method — we cannot auto-detect email replies without a mail server webhook)
- Team manually marks lead as spam
- All 4 follow-ups have been sent

---

## 2. Database Schema

### Table: `lead_scores`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| lead_id | text UNIQUE | e.g. `gf_1_829` |
| score | integer | 0-100 |
| reasoning | text | AI's explanation for the score |
| qualified | boolean | score >= 85 |
| spam | boolean | score < 50 |
| scored_at | timestamptz | When AI scored this lead |
| org_id | uuid | For RLS |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Table: `lead_emails`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| lead_id | text | Reference to lead |
| email_type | text | `acknowledgement`, `followup_1`, `followup_2`, `followup_3`, `followup_4` |
| to_email | text | Recipient email |
| cc_emails | text[] | CC list |
| subject | text | Email subject line |
| body_html | text | Full email body HTML |
| body_text | text | Plain text version |
| status | text | `draft`, `queued`, `sent`, `failed`, `cancelled` |
| sent_at | timestamptz | When actually sent |
| error | text | Error message if failed |
| org_id | uuid | For RLS |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Table: `lead_followups`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| lead_id | text | Reference to lead |
| step | integer | 1-4 |
| scheduled_for | timestamptz | When to send |
| status | text | `pending`, `sent`, `cancelled`, `skipped` |
| email_id | uuid FK | Reference to lead_emails when drafted/sent |
| org_id | uuid | For RLS |
| created_at | timestamptz | |

### Follow-up Schedule

| Step | Interval | Content Strategy | CTA |
|------|----------|-----------------|-----|
| Follow-up 1 | +2 days | Relevant case study or portfolio piece matching their inquiry | "Take a look and let us know if this is the direction you're thinking" |
| Follow-up 2 | +4 days | Specific insight or stat related to their industry/service need | "Happy to walk you through how this applies to [company]" |
| Follow-up 3 | +7 days | Suggest a quick 15-min call, provide calendar booking link | "Pick a slot that works — no pressure, just a quick chat" |
| Follow-up 4 | +14 days | Final gentle nudge with a different angle or free resource | "Whenever you're ready, we're here. Here's something useful in the meantime" |

---

## 3. API Routes

### `POST /api/leads/qualify`

**Input:** Array of leads (from `/api/leads/website` response)
**Process:**
1. Filter out leads already scored in `lead_scores`
2. For each unscored lead, call Claude Haiku 4.5 with system prompt:
   - Evaluate: Is this a genuine business inquiry or spam?
   - Consider: name quality, email domain, message coherence, company name, phone format, services selected, reCAPTCHA score from meta
   - Return JSON: `{ score: number, reasoning: string }`
3. Store scores in `lead_scores`
4. For score 85+: auto-trigger `/api/leads/draft-email`
5. For score 50-84: trigger draft but set status to `draft` (not auto-send)
6. For score <50: mark as spam, no email

**Output:** `{ qualified: number, review: number, spam: number, scores: [...] }`

### `POST /api/leads/draft-email`

**Input:** `{ lead_id, lead_data, email_type, previous_emails? }`
**Process:**
1. Call Claude Sonnet 4 with system prompt (see Section 5)
2. Generate subject line + HTML body
3. Append Prabhu K signature block (HTML)
4. Store in `lead_emails` with status `draft` or `queued`
5. If auto-send eligible (score 85+ and email_type is `acknowledgement`): immediately call `/api/leads/send-email`
6. After successful acknowledgement send: create 4 rows in `lead_followups` with scheduled dates (+2, +4, +7, +14 days)

**Output:** `{ email_id, subject, body_html, status, auto_sent: boolean }`

### `POST /api/leads/send-email`

**Input:** `{ email_id }`
**Process:**
1. Load email from `lead_emails`
2. Send via Nodemailer using Google Workspace SMTP:
   - Host: smtp.gmail.com, Port: 587, TLS
   - From: "Creative Nexus" <prabhu@creativenexus.in>
   - To: lead's email
   - CC: tisha@creativenexus.in, prabhu@creativenexus.in, rishabh@creativenexus.in
3. Update `lead_emails.status` to `sent`, set `sent_at`
4. Create notification via existing `createNotification()` system
5. On failure: set status to `failed`, store error message

**Output:** `{ success: boolean, error?: string }`

### `POST /api/leads/followups/process`

**Trigger:** Called hourly (Vercel cron or manual)
**Process:**
1. Query `lead_followups` where `status = 'pending'` AND `scheduled_for <= now()`
2. For each due follow-up:
   a. Check stop triggers: has lead replied? manually closed? asked to be removed?
   b. If stopped: set status to `cancelled` for this and all remaining follow-ups
   c. If active: call `/api/leads/draft-email` with `email_type = followup_N` and `previous_emails` array
   d. Send the drafted email
   e. Update follow-up status to `sent`

**Output:** `{ processed: number, sent: number, cancelled: number, failed: number }`

### `POST /api/leads/[leadId]/action`

**Input:** `{ action: 'mark_spam' | 'mark_qualified' | 'close' | 'stop_followups' }`
**Process:** Update lead score/status, cancel pending follow-ups if needed

---

## 4. Page Layout — Split Panel

### Top Bar: 5 Metric Cards

| Metric | Value | Color |
|--------|-------|-------|
| Total Leads | Count of all leads | Neutral |
| Qualified | Count where score >= 85 | Green |
| Needs Review | Count where score 50-84 | Amber |
| Emails Sent | Count of sent emails | Blue (accent) |
| Spam Blocked | Count where score < 50 | Red |

### Left Panel (340px, scrollable)

- **Filter pills:** All / Qualified / Review / Spam (pill counts update live)
- **Search bar:** Filters by name, email, company
- **Lead rows:** Each row shows:
  - Name (bold)
  - Score badge (green 85+, amber 50-84, red <50)
  - Company + form source
  - Email status indicator: "Email sent" (green check), "Pending review" (amber clock), "Blocked" (red X)
  - Relative time (2h ago, 1d ago)
- **Spam leads:** Dimmed at 45% opacity, name strikethrough, only visible when "Spam" filter is active
- **Selected lead:** Highlighted with blue left border + light blue background

### Right Panel (flex-1, scrollable)

When a lead is selected:

1. **Header:** Lead name (16px bold), company, form source, time ago. Score badge with AI reasoning.
2. **Contact bar:** Email (clickable mailto), phone (clickable tel), source page URL
3. **Message:** Full message from the form in a subtle card
4. **Services:** Tag pills for selected services (SEO, UI/UX, etc.)
5. **Divider**
6. **AI Email Draft:** Full email preview with headers (From, To, CC, Subject) and body. Shown as a realistic email card.
7. **Action buttons:**
   - **Send Email** (primary blue) — sends the draft
   - **Edit Draft** — makes body editable inline
   - **Regenerate** — calls Claude again for a new draft
   - **Mark Spam** (red, right-aligned) — flags lead and cancels all emails
8. **Follow-up timeline** (below email): Shows scheduled follow-ups with dates and statuses

When no lead is selected: Empty state prompting "Select a lead to view details"

---

## 5. AI Agent System Prompts

### Lead Qualification Agent (Haiku 4.5)

```
You are a lead qualification specialist for Creative Nexus, a digital marketing and design agency in India.

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

Return JSON only: { "score": <number>, "reasoning": "<one sentence>" }
```

### Email Drafting Agent (Sonnet 4)

```
You are writing an email on behalf of Prabhu K, Co-founder & Managing Director of Creative Nexus India — a digital marketing, branding, and design agency.

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
- Calendar booking: include "Book a Call Now" link

EMAIL TYPES:
- acknowledgement: Thank them, acknowledge their specific need, suggest next step
- followup_1 (+2 days): Share a relevant insight matching their inquiry
- followup_2 (+4 days): Offer a specific stat or trend in their industry
- followup_3 (+7 days): Suggest a quick 15-min call with calendar link
- followup_4 (+14 days): Final gentle nudge with a helpful resource, no pressure

Return JSON: { "subject": "<subject line>", "body": "<email body in HTML>" }

Do NOT include the signature — it will be appended automatically.
```

---

## 6. Email Signature (HTML)

Appended to every email automatically:

```html
<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; color: #333; line-height: 1.5;">
  <tr><td style="padding-bottom: 8px;">
    <strong style="font-size: 14px;">Prabhu K</strong><br>
    Co-founder & Managing Director
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
</table>
```

---

## 7. Environment Variables

Already configured in `.env.local`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=prabhu@creativenexus.in
SMTP_PASS=mmwa yclf xnbj xqqp
SMTP_FROM_NAME=Creative Nexus
SMTP_FROM_EMAIL=prabhu@creativenexus.in
SMTP_CC=tisha@creativenexus.in,prabhu@creativenexus.in,rishabh@creativenexus.in
```

Additional accounts (Tisha, Rishabh) to be added later with their own app passwords.

---

## 8. Dependencies

New npm package needed:
- `nodemailer` — SMTP email sending (zero external API dependency)
- `@types/nodemailer` — TypeScript types

No other new dependencies. Uses existing:
- `callClaude()` from `src/lib/anthropic.ts`
- `createNotification()` from `src/lib/notifications.ts`
- Supabase admin client from `src/lib/supabase/admin.ts`

---

## 9. Thresholds (configurable in Settings)

| Setting | Default | Description |
|---------|---------|-------------|
| Auto-send threshold | 85 | Score at or above auto-sends |
| Review threshold | 50 | Score 50-84 queued for review |
| Spam threshold | 50 | Score below 50 flagged as spam |
| Follow-up intervals | 2, 4, 7, 14 | Days between follow-ups |
| Max follow-ups | 4 | Stop after this many |

These should be editable from the Settings page (Platform Settings tab) so the team can adjust without code changes.

---

## 10. Notification Integration

Leverage the existing `createNotification()` system:

| Event | Notification |
|-------|-------------|
| New qualified lead (85+) | "New lead: {name} from {company} — score {score}. Auto-email sent." |
| Lead needs review (50-84) | "Lead needs review: {name} — score {score}. Draft email ready." |
| Email send failed | "Email to {name} failed: {error}. Retry from Leads page." |
| Follow-up sent | "Follow-up {step} sent to {name}" |
| Bulk qualification complete | "Qualified {n} leads: {qualified} genuine, {review} for review, {spam} spam" |
