# Email Core Phase 1 — Gmail OAuth Brain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing IMAP+SMTP email integration (Track 1) into a Gmail-OAuth-powered Email Core that acts as the universal email layer for every Command Centre module via a context-tagging engine.

**Architecture:** Gmail API replaces IMAP polling as the source of truth. A new `email_contexts` join table allows any module (Leads, Proposals, CRM, Pipeline, LinkedIn) to attach one email to many contexts. A send pipeline with idempotency + a Hostinger-cron-driven worker decouples HTTP from SMTP latency. A single reusable `ContextEmailPanel` React component is consumed by every module. Realtime updates flow through Supabase Realtime — no Socket.IO or Redis is added.

**Tech Stack:**
- Next.js 14 App Router + TypeScript (existing)
- Supabase Postgres + RLS + Realtime (existing)
- `googleapis` Node SDK (new)
- AES-256-GCM via existing `src/lib/email/encryption.ts` (reused)
- Hostinger cron for polling + queue worker (existing pattern at `/api/cron/email-sync`)
- React Query (existing) for client cache
- `isomorphic-dompurify` for HTML sanitization (new)

**Pre-existing state (do not redo):**
- Tables `email_accounts`, `email_threads`, `email_messages` already exist with RLS, `org_id`, indexes (see [supabase/migrations/20260422090000_email_accounts.sql](../../../supabase/migrations/20260422090000_email_accounts.sql))
- `src/lib/email/encryption.ts` ships AES-256-GCM helpers
- `src/lib/email/sync.ts`, `imap.ts`, `smtp.ts` implement the IMAP+SMTP path
- API routes under `src/app/api/email/` (accounts, messages, send, threads) exist as IMAP+SMTP variants
- `/inbox` page is a stub at `src/app/(dashboard)/inbox/page.tsx`
- Hostinger cron hits `/api/cron/email-sync` every 2 minutes
- Seeded `ORG_ID = a0000000-0000-0000-0000-000000000001` (single-tenant for now)

**Testing posture:** The project currently has no test runner installed. Each task uses **manual verification commands** (curl, browser checks, Supabase SQL). A `vitest` setup for pure functions (encryption, context-linker rules, MIME builder) is recommended as a follow-up but is **out of scope for Phase 1**.

**Out of scope for Phase 1 (Phase 2+):**
- Gmail Pub/Sub push notifications (Phase 1 polls every 2 min like the IMAP path)
- AI context inference for unmatched emails
- Auto-summarize / suggested replies
- Templated "Send Proposal" / "Send Invoice" actions
- Attachment upload from composer (read-only attachments in Phase 1)
- Multi-tenant token isolation (single-tenant, all rows `ORG_ID`)
- Send-on-behalf-of-agent attribution rows (column added now, not wired)

---

## File Structure

**New files:**
- `supabase/migrations/20260517090000_email_core_oauth.sql` — schema migration
- `src/lib/email/gmail-oauth.ts` — Google OAuth2 client factory + scope constants
- `src/lib/email/gmail-client.ts` — per-account Gmail API client w/ token refresh
- `src/lib/email/gmail-sync.ts` — backfill + incremental sync via Gmail API
- `src/lib/email/mime.ts` — RFC 5322 MIME builder (threading headers)
- `src/lib/email/context-linker.ts` — auto-link rules engine
- `src/lib/email/sanitize.ts` — HTML sanitizer wrapper
- `src/lib/email/queue.ts` — DB-backed send job enqueue/dequeue helpers
- `src/app/api/email/oauth/google/start/route.ts` — returns Google consent URL
- `src/app/api/email/oauth/google/callback/route.ts` — exchanges code, stores tokens
- `src/app/api/cron/email-send/route.ts` — worker that consumes `email_send_jobs`
- `src/components/email/ContextEmailPanel.tsx` — reusable per-module panel
- `src/components/email/ContextEmailList.tsx`
- `src/components/email/ContextEmailReply.tsx`
- `src/lib/email/use-context-emails.ts` — React Query hook + Realtime subscription

**Modified files:**
- `src/lib/email/index.ts` — extend types with OAuth fields, contexts, queue rows
- `src/lib/email/sync.ts` — route OAuth accounts to `gmail-sync.ts`, IMAP accounts keep existing path
- `src/app/api/cron/email-sync/route.ts` — dispatch based on `provider` column
- `src/app/api/email/send/route.ts` — switch to async enqueue (idempotency + 202)
- `src/app/(dashboard)/inbox/page.tsx` — full rewrite (universal inbox)
- `src/app/(dashboard)/settings/integrations/page.tsx` — add "Connect with Google" button
- `src/app/(dashboard)/leads/[id]/page.tsx` (or equivalent) — embed `<ContextEmailPanel contextType="lead" />`
- `.env.example` — add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `EMAIL_WORKER_BATCH_SIZE`, `MAIL_DOMAIN`
- `package.json` — add `googleapis`, `isomorphic-dompurify`, `html-to-text`

**Files to migrate then delete (Task 14):**
- Direct callers of `src/lib/email.ts` singleton — search and migrate to new send endpoint

---

## Task 1: Schema migration — OAuth columns, contexts, idempotency, queue

**Files:**
- Create: `supabase/migrations/20260517090000_email_core_oauth.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ─────────────────────────────────────────────────────────────────────────
-- Email Core Phase 1: Gmail OAuth, context engine, send queue.
-- Extends Track 1 schema; preserves IMAP+SMTP path for legacy accounts.
-- ─────────────────────────────────────────────────────────────────────────

-- ── email_accounts: add OAuth columns ────────────────────────────────────
alter table public.email_accounts
  add column if not exists provider text not null default 'smtp_imap'
    check (provider in ('smtp_imap','gmail_oauth')),
  add column if not exists oauth_refresh_token_encrypted text,
  add column if not exists oauth_access_token_encrypted text,
  add column if not exists oauth_expires_at timestamptz,
  add column if not exists oauth_scopes text[] not null default '{}',
  add column if not exists gmail_history_id text,
  add column if not exists gmail_watch_expiration timestamptz,
  add column if not exists is_default boolean not null default false;

-- App-password becomes optional now that OAuth path exists.
alter table public.email_accounts
  alter column app_password_encrypted drop not null;

create index if not exists email_accounts_provider_idx
  on public.email_accounts(provider, status);

-- Only one default per org.
create unique index if not exists email_accounts_one_default_per_org
  on public.email_accounts(org_id)
  where is_default = true;

-- ── email_messages: add Gmail-native + body columns ──────────────────────
alter table public.email_messages
  add column if not exists gmail_message_id text,
  add column if not exists gmail_thread_id text,
  add column if not exists body_html text,
  add column if not exists body_text text,
  add column if not exists attachments_json jsonb,
  add column if not exists status text not null default 'received'
    check (status in ('received','queued','sending','delivered','failed','bounced')),
  add column if not exists failure_reason text,
  add column if not exists retry_count int not null default 0,
  add column if not exists sent_by_user_id uuid,
  add column if not exists sent_by_agent_id text;

create unique index if not exists email_messages_gmail_msg_unique
  on public.email_messages(account_id, gmail_message_id)
  where gmail_message_id is not null;

create index if not exists email_messages_gmail_thread_idx
  on public.email_messages(gmail_thread_id) where gmail_thread_id is not null;

create index if not exists email_messages_status_idx
  on public.email_messages(status) where status in ('queued','sending');

-- ── email_threads: add Gmail thread mapping ──────────────────────────────
alter table public.email_threads
  add column if not exists gmail_thread_id text,
  add column if not exists snippet text;

create unique index if not exists email_threads_gmail_thread_unique
  on public.email_threads(account_id, gmail_thread_id)
  where gmail_thread_id is not null;

-- ── email_contexts: the brain ────────────────────────────────────────────
create table if not exists public.email_contexts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.email_messages(id) on delete cascade,
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  context_type text not null
    check (context_type in ('lead','proposal','deal','client','campaign','project','none')),
  context_id uuid,
  link_source text not null default 'auto_domain'
    check (link_source in ('auto_domain','auto_email','auto_subject','auto_thread','manual','ai_inferred')),
  confidence numeric(3,2) not null default 1.0,
  org_id uuid not null,
  created_at timestamptz not null default now(),
  unique (message_id, context_type, context_id)
);

create index if not exists email_contexts_lookup_idx
  on public.email_contexts(context_type, context_id);
create index if not exists email_contexts_thread_idx
  on public.email_contexts(thread_id);
create index if not exists email_contexts_org_idx
  on public.email_contexts(org_id);

alter table public.email_contexts enable row level security;
drop policy if exists "email_contexts org access" on public.email_contexts;
create policy "email_contexts org access" on public.email_contexts
  for all using (true) with check (true);

-- ── email_idempotency_keys ───────────────────────────────────────────────
create table if not exists public.email_idempotency_keys (
  key text primary key,
  user_id uuid,
  response_body jsonb not null,
  org_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists email_idempotency_created_idx
  on public.email_idempotency_keys(created_at);

alter table public.email_idempotency_keys enable row level security;
drop policy if exists "email_idempotency org access" on public.email_idempotency_keys;
create policy "email_idempotency org access" on public.email_idempotency_keys
  for all using (true) with check (true);

-- ── email_send_jobs: lightweight DB queue ────────────────────────────────
create table if not exists public.email_send_jobs (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.email_messages(id) on delete cascade,
  account_id uuid not null references public.email_accounts(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','locked','done','failed')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  run_after timestamptz not null default now(),
  org_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_send_jobs_pending_idx
  on public.email_send_jobs(status, run_after) where status = 'pending';
create index if not exists email_send_jobs_locked_idx
  on public.email_send_jobs(status, locked_at) where status = 'locked';

alter table public.email_send_jobs enable row level security;
drop policy if exists "email_send_jobs org access" on public.email_send_jobs;
create policy "email_send_jobs org access" on public.email_send_jobs
  for all using (true) with check (true);

-- ── Realtime: enable on tables the UI subscribes to ──────────────────────
alter publication supabase_realtime add table public.email_messages;
alter publication supabase_realtime add table public.email_threads;
alter publication supabase_realtime add table public.email_contexts;
```

- [ ] **Step 2: Apply migration to local Supabase**

```bash
supabase db push
```

Expected: "Applied migration 20260517090000_email_core_oauth.sql".

- [ ] **Step 3: Verify schema**

Run via Supabase MCP `execute_sql`:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'email_accounts' and column_name like '%oauth%';
```

Expected rows: `oauth_refresh_token_encrypted | text | YES`, `oauth_access_token_encrypted | text | YES`, `oauth_expires_at | timestamp with time zone | YES`, `oauth_scopes | ARRAY | NO`.

```sql
select count(*) from public.email_contexts;
select count(*) from public.email_idempotency_keys;
select count(*) from public.email_send_jobs;
```

Expected: all `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260517090000_email_core_oauth.sql
git commit -m "feat(email): schema for Gmail OAuth + contexts + send queue"
```

---

## Task 2: Update TypeScript types in `src/lib/email/index.ts`

**Files:**
- Modify: `src/lib/email/index.ts`

- [ ] **Step 1: Extend `EmailAccount` interface**

Append to `EmailAccount`:

```typescript
  provider: "smtp_imap" | "gmail_oauth";
  oauth_refresh_token_encrypted: string | null;
  oauth_access_token_encrypted: string | null;
  oauth_expires_at: string | null;
  oauth_scopes: string[];
  gmail_history_id: string | null;
  gmail_watch_expiration: string | null;
  is_default: boolean;
```

Change existing `app_password_encrypted: string` to `app_password_encrypted: string | null`.

- [ ] **Step 2: Extend `EmailMessage` interface**

Append:

```typescript
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  body_html: string | null;
  body_text: string | null;
  attachments_json: unknown | null;
  status: "received" | "queued" | "sending" | "delivered" | "failed" | "bounced";
  failure_reason: string | null;
  retry_count: number;
  sent_by_user_id: string | null;
  sent_by_agent_id: string | null;
```

- [ ] **Step 3: Extend `EmailThread` interface**

Append:

```typescript
  gmail_thread_id: string | null;
  snippet: string | null;
```

- [ ] **Step 4: Add new interfaces**

```typescript
export type EmailContextType =
  | "lead" | "proposal" | "deal" | "client" | "campaign" | "project" | "none";

export type EmailLinkSource =
  | "auto_domain" | "auto_email" | "auto_subject" | "auto_thread"
  | "manual" | "ai_inferred";

export interface EmailContext {
  id: string;
  message_id: string;
  thread_id: string;
  context_type: EmailContextType;
  context_id: string | null;
  link_source: EmailLinkSource;
  confidence: number;
  org_id: string;
  created_at: string;
}

export interface EmailSendJob {
  id: string;
  message_id: string;
  account_id: string;
  status: "pending" | "locked" | "done" | "failed";
  attempts: number;
  max_attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  run_after: string;
  org_id: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 5: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors related to email types (existing unrelated errors OK).

- [ ] **Step 6: Commit**

```bash
git add src/lib/email/index.ts
git commit -m "feat(email): typescript types for OAuth + contexts + send jobs"
```

---

## Task 3: Install Gmail dependencies + env scaffolding

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install packages**

```bash
npm install googleapis isomorphic-dompurify html-to-text
npm install -D @types/html-to-text
```

Expected: `package.json` updated, lockfile regenerates. No peer warnings.

- [ ] **Step 2: Add env vars to `.env.example`**

Append:

```
# Google OAuth (Gmail Core)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/email/oauth/google/callback

# Email Core
MAIL_DOMAIN=creativenexus.in
EMAIL_WORKER_BATCH_SIZE=10
EMAIL_WORKER_CRON_SECRET=
```

- [ ] **Step 3: Create Google Cloud OAuth credentials** (manual, by Prabhu)

Steps documented in this task — execute outside the codebase:
1. Visit https://console.cloud.google.com/apis/credentials
2. Create OAuth Client ID, application type "Web application"
3. Authorized redirect URIs: `http://localhost:3000/api/email/oauth/google/callback` + production URL
4. Enable Gmail API on the project
5. Copy Client ID + Client Secret into local `.env.local` and Hostinger env vars

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore(email): add googleapis + sanitizer deps + OAuth env scaffolding"
```

---

## Task 4: Create `src/lib/email/gmail-oauth.ts`

**Files:**
- Create: `src/lib/email/gmail-oauth.ts`

- [ ] **Step 1: Write the OAuth helpers**

```typescript
// Google OAuth2 client factory + scope constants for Gmail Core.
// Uses the Web flow with offline access so we get a refresh_token on first consent.

import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
] as const;

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

export function buildOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_OAUTH_REDIRECT_URI"),
  );
}

export function buildConsentUrl(state: string): string {
  const client = buildOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",      // required to get refresh_token
    prompt: "consent",            // forces refresh_token on re-consent
    scope: [...GMAIL_SCOPES],
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = buildOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh_token. Remove app access at " +
      "https://myaccount.google.com/permissions and re-consent.",
    );
  }
  return tokens;
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const client = buildOAuthClient();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  if (!data.email) throw new Error("Google userinfo missing email");
  return {
    email: data.email,
    name: data.name ?? data.email,
    picture: data.picture ?? null,
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/gmail-oauth.ts
git commit -m "feat(email): Google OAuth2 client factory + consent URL builder"
```

---

## Task 5: OAuth start route — returns consent URL

**Files:**
- Create: `src/app/api/email/oauth/google/start/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// POST /api/email/oauth/google/start
// Returns { url } — frontend redirects user to Google consent.

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { buildConsentUrl } from "@/lib/email/gmail-oauth";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // State binds the callback to this user; checked in callback route.
  const stateRaw = randomBytes(16).toString("hex");
  const state = `${user.id}.${stateRaw}`;

  // Store state in a short-lived cookie (10 min).
  const url = buildConsentUrl(state);
  const res = NextResponse.json({ url });
  res.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
```

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```

In another shell:

```bash
curl -X POST http://localhost:3000/api/email/oauth/google/start \
  -H "Cookie: <copy from logged-in browser session>" -i
```

Expected: `200 OK` with JSON `{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }` and a `Set-Cookie: gmail_oauth_state=...` header.

If unauthorized, log in via `/login` first and copy the cookie.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/email/oauth/google/start/route.ts
git commit -m "feat(email): OAuth start route returns Google consent URL"
```

---

## Task 6: OAuth callback route — exchange code, store account

**Files:**
- Create: `src/app/api/email/oauth/google/callback/route.ts`

- [ ] **Step 1: Write the callback**

```typescript
// GET /api/email/oauth/google/callback?code=...&state=...
// Validates state, exchanges code for tokens, persists encrypted refresh token,
// upserts email_accounts row, redirects to /settings/integrations?connected=1.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  GMAIL_SCOPES,
} from "@/lib/email/gmail-oauth";
import { encrypt } from "@/lib/email/encryption";
import { ORG_ID } from "@/lib/email";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = req.cookies.get("gmail_oauth_state")?.value;

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=oauth_state_mismatch", req.url),
    );
  }

  const userId = state.split(".")[0];

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=oauth_user_mismatch", req.url),
    );
  }

  let tokens, profile;
  try {
    tokens = await exchangeCodeForTokens(code);
    profile = await fetchGoogleUserInfo(tokens.access_token!);
  } catch (err) {
    const msg = encodeURIComponent((err as Error).message);
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=oauth_exchange&detail=${msg}`, req.url),
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("email_accounts")
    .upsert(
      {
        user_id: user.id,
        email: profile.email,
        display_name: profile.name,
        provider: "gmail_oauth",
        oauth_refresh_token_encrypted: encrypt(tokens.refresh_token!),
        oauth_access_token_encrypted: tokens.access_token
          ? encrypt(tokens.access_token)
          : null,
        oauth_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        oauth_scopes: [...GMAIL_SCOPES],
        status: "connected",
        last_error: null,
        org_id: ORG_ID,
        smtp_host: "smtp.gmail.com",
        smtp_port: 465,
        imap_host: "imap.gmail.com",
        imap_port: 993,
      },
      { onConflict: "org_id,email" },
    );

  if (error) {
    const msg = encodeURIComponent(error.message);
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=oauth_persist&detail=${msg}`, req.url),
    );
  }

  const res = NextResponse.redirect(
    new URL("/settings/integrations?connected=1", req.url),
  );
  res.cookies.delete("gmail_oauth_state");
  return res;
}
```

- [ ] **Step 2: End-to-end manual test**

1. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` to `.env.local`.
2. `npm run dev`
3. Log in to dashboard.
4. Hit `POST /api/email/oauth/google/start` (via fetch in browser console).
5. Visit returned URL → consent → land back at `/settings/integrations?connected=1`.

Verify row inserted:

```sql
select email, provider, status, oauth_scopes
from public.email_accounts
where provider = 'gmail_oauth';
```

Expected: one row with `status = connected`, scopes array populated.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/email/oauth/google/callback/route.ts
git commit -m "feat(email): OAuth callback persists encrypted Gmail refresh token"
```

---

## Task 7: Gmail API client wrapper with token refresh

**Files:**
- Create: `src/lib/email/gmail-client.ts`

- [ ] **Step 1: Write the wrapper**

```typescript
// Per-account Gmail API client. Loads encrypted refresh token,
// transparently refreshes access token, persists the new one.

import { google, type gmail_v1 } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/email/encryption";
import { buildOAuthClient } from "@/lib/email/gmail-oauth";
import type { EmailAccount } from "@/lib/email";

export interface GmailClient {
  account: EmailAccount;
  gmail: gmail_v1.Gmail;
}

export async function loadGmailClient(accountId: string): Promise<GmailClient> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (error || !data) throw new Error(`Account ${accountId} not found`);
  const account = data as EmailAccount;

  if (account.provider !== "gmail_oauth") {
    throw new Error(`Account ${accountId} is not Gmail OAuth (${account.provider})`);
  }
  if (!account.oauth_refresh_token_encrypted) {
    throw new Error(`Account ${accountId} missing refresh token`);
  }

  const refreshToken = decrypt(account.oauth_refresh_token_encrypted);

  const oauth2Client = buildOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: account.oauth_access_token_encrypted
      ? decrypt(account.oauth_access_token_encrypted)
      : undefined,
    expiry_date: account.oauth_expires_at
      ? new Date(account.oauth_expires_at).getTime()
      : undefined,
  });

  // Persist refreshed access tokens back to DB.
  oauth2Client.on("tokens", (tokens) => {
    void (async () => {
      try {
        const update: Record<string, unknown> = {};
        if (tokens.access_token) {
          update.oauth_access_token_encrypted = encrypt(tokens.access_token);
        }
        if (tokens.expiry_date) {
          update.oauth_expires_at = new Date(tokens.expiry_date).toISOString();
        }
        if (Object.keys(update).length > 0) {
          await admin.from("email_accounts").update(update).eq("id", accountId);
        }
      } catch (err) {
        console.error("[gmail-client] failed to persist refreshed token", err);
      }
    })();
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  return { account, gmail };
}
```

- [ ] **Step 2: Smoke-test in a scratch route**

Create temporary `src/app/api/email/_debug/profile/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { loadGmailClient } from "@/lib/email/gmail-client";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("account_id");
  if (!id) return NextResponse.json({ error: "account_id required" }, { status: 400 });
  const { gmail } = await loadGmailClient(id);
  const { data } = await gmail.users.getProfile({ userId: "me" });
  return NextResponse.json(data);
}
```

Call it:

```bash
curl "http://localhost:3000/api/email/_debug/profile?account_id=<uuid>"
```

Expected: JSON `{ emailAddress, messagesTotal, threadsTotal, historyId }`.

- [ ] **Step 3: Delete the debug route**

```bash
rm -rf "src/app/api/email/_debug"
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/email/gmail-client.ts
git commit -m "feat(email): Gmail API client with auto-refresh + token persistence"
```

---

## Task 8: MIME builder for outbound mail with threading headers

**Files:**
- Create: `src/lib/email/mime.ts`

- [ ] **Step 1: Write the builder**

```typescript
// Builds RFC 5322 MIME messages with the threading headers Gmail respects.
// Output is a UTF-8 string; caller base64url-encodes for gmail.users.messages.send.

export interface BuildMimeInput {
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text: string;
  messageId: string;           // e.g. "<uuid@mail.creativenexus.in>"
  inReplyTo?: string | null;
  references?: string[] | null;
}

function escapeHeader(value: string): string {
  // Strip CR/LF to prevent header injection.
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatAddress(email: string, name?: string): string {
  if (!name) return escapeHeader(email);
  return `${JSON.stringify(escapeHeader(name))} <${escapeHeader(email)}>`;
}

export function buildMime(input: BuildMimeInput): string {
  const boundary = `cnx-${Math.random().toString(36).slice(2)}`;
  const headers: string[] = [
    `From: ${formatAddress(input.from, input.fromName)}`,
    `To: ${input.to.map((e) => escapeHeader(e)).join(", ")}`,
  ];
  if (input.cc?.length) headers.push(`Cc: ${input.cc.map(escapeHeader).join(", ")}`);
  if (input.bcc?.length) headers.push(`Bcc: ${input.bcc.map(escapeHeader).join(", ")}`);
  headers.push(`Subject: ${escapeHeader(input.subject)}`);
  headers.push(`Message-ID: ${escapeHeader(input.messageId)}`);
  if (input.inReplyTo) headers.push(`In-Reply-To: ${escapeHeader(input.inReplyTo)}`);
  if (input.references?.length) {
    headers.push(`References: ${input.references.map(escapeHeader).join(" ")}`);
  }
  headers.push("MIME-Version: 1.0");
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return headers.join("\r\n") + "\r\n\r\n" + body;
}

export function toBase64Url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

export function buildMessageId(domain: string): string {
  const rand = crypto.randomUUID();
  return `<${rand}@${domain}>`;
}
```

- [ ] **Step 2: Manual smoke** — quick node REPL check (optional)

```bash
node -e "
const { buildMime, toBase64Url, buildMessageId } = require('./.next/server/chunks/__app_lib_email_mime.js');
" 2>/dev/null || echo "(skip — verified at next compile)"
```

(Real verification happens in Task 10 when worker uses it.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/mime.ts
git commit -m "feat(email): RFC 5322 MIME builder with threading headers"
```

---

## Task 9: HTML sanitizer

**Files:**
- Create: `src/lib/email/sanitize.ts`

- [ ] **Step 1: Write the sanitizer**

```typescript
// Sanitize email HTML before storing or rendering.
// Strips scripts, event handlers, javascript: URLs; keeps inline styles + images.
// Image src rewriting (tracking-pixel proxy) is Phase 2.

import DOMPurify from "isomorphic-dompurify";
import { convert } from "html-to-text";

export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
    ALLOW_DATA_ATTR: false,
  });
}

export function htmlToPlainText(html: string): string {
  return convert(html, {
    wordwrap: 80,
    selectors: [{ selector: "a", options: { hideLinkHrefIfSameAsText: true } }],
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/sanitize.ts
git commit -m "feat(email): HTML sanitizer + plaintext extractor"
```

---

## Task 10: Send endpoint — idempotency + enqueue

**Files:**
- Modify: `src/app/api/email/send/route.ts`

- [ ] **Step 1: Read the existing route**

```bash
cat src/app/api/email/send/route.ts
```

Note the current handler structure (it currently calls `sendFromAccount` synchronously via SMTP). Replace its `POST` handler with the version below; keep imports it shares (auth, supabase) where applicable.

- [ ] **Step 2: Write the new POST handler**

Replace the file with:

```typescript
// POST /api/email/send
// Validates payload + Idempotency-Key, inserts queued email_messages row,
// enqueues email_send_jobs row, returns 202 with message id.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeEmailHtml, htmlToPlainText } from "@/lib/email/sanitize";
import { buildMessageId } from "@/lib/email/mime";
import { ORG_ID } from "@/lib/email";

const sendSchema = z.object({
  account_id: z.string().uuid(),
  thread_id: z.string().uuid().optional(),
  to: z.array(z.string().email()).min(1).max(20),
  cc: z.array(z.string().email()).max(20).optional(),
  bcc: z.array(z.string().email()).max(20).optional(),
  subject: z.string().min(1).max(998),
  html: z.string().min(1).max(500_000),
  context_type: z
    .enum(["lead", "proposal", "deal", "client", "campaign", "project", "none"])
    .optional(),
  context_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const idempotencyKey = req.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "Idempotency-Key header required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Replay check
  const { data: existing } = await admin
    .from("email_idempotency_keys")
    .select("response_body")
    .eq("key", idempotencyKey)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(existing.response_body, { status: 200 });
  }

  const body = await req.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidationError", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const p = parsed.data;

  // Verify account belongs to user (single-tenant for now: any connected account).
  const { data: account, error: acctErr } = await admin
    .from("email_accounts")
    .select("id, email, provider, status, gmail_thread_id:id")
    .eq("id", p.account_id)
    .eq("status", "connected")
    .single();
  if (acctErr || !account) {
    return NextResponse.json({ error: "Account not found or disconnected" }, { status: 404 });
  }

  // Resolve thread + parent message for threading headers.
  let threadRow: { id: string; gmail_thread_id: string | null } | null = null;
  let parent: { message_id: string | null; references_chain: string[] } | null = null;

  if (p.thread_id) {
    const { data: t } = await admin
      .from("email_threads")
      .select("id, gmail_thread_id")
      .eq("id", p.thread_id)
      .single();
    threadRow = t ?? null;

    const { data: parentMsg } = await admin
      .from("email_messages")
      .select("message_id, references_chain")
      .eq("thread_id", p.thread_id)
      .order("sent_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    parent = parentMsg ?? null;
  } else {
    const { data: newThread, error } = await admin
      .from("email_threads")
      .insert({
        account_id: p.account_id,
        subject: p.subject,
        participants: [...p.to, ...(p.cc ?? []), account.email],
        last_message_at: new Date().toISOString(),
        message_count: 0,
        unread_count: 0,
        org_id: ORG_ID,
      })
      .select("id, gmail_thread_id")
      .single();
    if (error || !newThread) {
      return NextResponse.json({ error: "Failed to create thread" }, { status: 500 });
    }
    threadRow = newThread;
  }

  const domain = process.env.MAIL_DOMAIN ?? "creativenexus.in";
  const messageHeaderId = buildMessageId(domain);
  const html = sanitizeEmailHtml(p.html);
  const text = htmlToPlainText(html);

  const { data: msg, error: msgErr } = await admin
    .from("email_messages")
    .insert({
      thread_id: threadRow!.id,
      account_id: p.account_id,
      message_id: messageHeaderId,
      in_reply_to: parent?.message_id ?? null,
      references_chain: parent
        ? [...parent.references_chain, ...(parent.message_id ? [parent.message_id] : [])]
        : [],
      from_email: account.email,
      to_emails: p.to,
      cc_emails: p.cc ?? [],
      subject: p.subject,
      snippet: text.slice(0, 200),
      body_html: html,
      body_text: text,
      direction: "outbound",
      status: "queued",
      sent_by_user_id: user.id,
      org_id: ORG_ID,
    })
    .select("id, thread_id")
    .single();

  if (msgErr || !msg) {
    return NextResponse.json(
      { error: "Failed to create message", detail: msgErr?.message },
      { status: 500 },
    );
  }

  await admin.from("email_send_jobs").insert({
    message_id: msg.id,
    account_id: p.account_id,
    org_id: ORG_ID,
  });

  if (p.context_type && p.context_id) {
    await admin.from("email_contexts").insert({
      message_id: msg.id,
      thread_id: threadRow!.id,
      context_type: p.context_type,
      context_id: p.context_id,
      link_source: "manual",
      confidence: 1.0,
      org_id: ORG_ID,
    });
  }

  const responseBody = {
    success: true,
    message_id: msg.id,
    thread_id: msg.thread_id,
    status: "queued",
  };

  await admin
    .from("email_idempotency_keys")
    .insert({
      key: idempotencyKey,
      user_id: user.id,
      response_body: responseBody,
      org_id: ORG_ID,
    });

  return NextResponse.json(responseBody, { status: 202 });
}

// Garbage-collect idempotency keys older than 24h (call from cleanup cron later).
export const dynamic = "force-dynamic";
```

- [ ] **Step 3: Manual smoke** — assumes a Gmail-OAuth account is connected

```bash
curl -X POST http://localhost:3000/api/email/send \
  -H "Cookie: <session>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "account_id": "<connected_account_uuid>",
    "to": ["you@yourself.com"],
    "subject": "Phase 1 send smoke",
    "html": "<p>Hello from Email Core</p>"
  }' -i
```

Expected: `202 Accepted` with body `{ success: true, message_id, thread_id, status: "queued" }`.

Verify rows:

```sql
select id, status, subject from email_messages order by created_at desc limit 1;
select status, attempts from email_send_jobs order by created_at desc limit 1;
```

Expected: message row `status='queued'`, job row `status='pending'`.

Replay check:

```bash
# Same Idempotency-Key as above
curl -X POST http://localhost:3000/api/email/send \
  -H "Cookie: <session>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: <same key>" \
  -d '{ "account_id": "...", "to": ["..."], "subject": "...", "html": "..." }' -i
```

Expected: `200 OK` with the cached response body. No new rows inserted.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/email/send/route.ts
git commit -m "feat(email): async send endpoint with idempotency + queue enqueue"
```

---

## Task 11: Send worker cron — `/api/cron/email-send`

**Files:**
- Create: `src/app/api/cron/email-send/route.ts`

- [ ] **Step 1: Write the worker**

```typescript
// GET /api/cron/email-send
// Hostinger cron pings this every minute.
// Locks up to EMAIL_WORKER_BATCH_SIZE pending jobs, sends via Gmail API,
// updates status. Retries with exponential backoff up to max_attempts.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadGmailClient } from "@/lib/email/gmail-client";
import { buildMime, toBase64Url } from "@/lib/email/mime";

const WORKER_ID = `worker-${process.pid}-${Date.now()}`;
const BATCH = Number(process.env.EMAIL_WORKER_BATCH_SIZE ?? 10);

function requireCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.EMAIL_WORKER_CRON_SECRET;
  if (!secret) return null; // dev: allow
  const got = req.headers.get("x-cron-secret");
  if (got !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const admin = createAdminClient();

  // 1. Atomically lock up to BATCH pending jobs.
  const { data: jobs, error: lockErr } = await admin.rpc("lock_email_send_jobs", {
    p_worker: WORKER_ID,
    p_limit: BATCH,
  });

  if (lockErr) {
    console.error("[email-send] lock failed", lockErr);
    return NextResponse.json({ error: lockErr.message }, { status: 500 });
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const job of jobs ?? []) {
    try {
      await processJob(admin, job);
      results.push({ id: job.id, status: "delivered" });
    } catch (err) {
      const msg = (err as Error).message;
      const attempts = job.attempts + 1;
      const failed = attempts >= job.max_attempts;
      await admin
        .from("email_send_jobs")
        .update({
          status: failed ? "failed" : "pending",
          locked_at: null,
          locked_by: null,
          attempts,
          last_error: msg,
          run_after: new Date(Date.now() + Math.pow(2, attempts) * 1000).toISOString(),
        })
        .eq("id", job.id);
      await admin
        .from("email_messages")
        .update({
          status: failed ? "failed" : "queued",
          failure_reason: msg,
          retry_count: attempts,
        })
        .eq("id", job.message_id);
      results.push({ id: job.id, status: failed ? "failed" : "retrying", error: msg });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

async function processJob(
  admin: ReturnType<typeof createAdminClient>,
  job: { id: string; message_id: string; account_id: string },
) {
  await admin.from("email_messages").update({ status: "sending" }).eq("id", job.message_id);

  const { data: msg, error: msgErr } = await admin
    .from("email_messages")
    .select("*, email_threads!inner(id, gmail_thread_id)")
    .eq("id", job.message_id)
    .single();
  if (msgErr || !msg) throw new Error(`message ${job.message_id} not found`);

  const { account, gmail } = await loadGmailClient(job.account_id);

  const mime = buildMime({
    from: account.email,
    fromName: account.display_name,
    to: msg.to_emails,
    cc: msg.cc_emails,
    subject: msg.subject ?? "(no subject)",
    html: msg.body_html ?? "",
    text: msg.body_text ?? "",
    messageId: msg.message_id!,
    inReplyTo: msg.in_reply_to,
    references: msg.references_chain,
  });

  const raw = toBase64Url(mime);
  const threadFromRel = (msg as unknown as {
    email_threads: { gmail_thread_id: string | null };
  }).email_threads;

  const { data: sendResult } = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: threadFromRel.gmail_thread_id ?? undefined,
    },
  });

  await admin.from("email_send_jobs").update({
    status: "done",
    locked_at: null,
    locked_by: null,
  }).eq("id", job.id);

  await admin.from("email_messages").update({
    status: "delivered",
    sent_at: new Date().toISOString(),
    gmail_message_id: sendResult.id ?? null,
    gmail_thread_id: sendResult.threadId ?? null,
  }).eq("id", job.message_id);

  if (sendResult.threadId && !threadFromRel.gmail_thread_id) {
    await admin.from("email_threads").update({
      gmail_thread_id: sendResult.threadId,
      last_message_at: new Date().toISOString(),
    }).eq("id", msg.thread_id);
  }
}
```

- [ ] **Step 2: Add the `lock_email_send_jobs` RPC**

Create a second migration `supabase/migrations/20260517090100_email_send_lock_rpc.sql`:

```sql
-- Atomic lock-and-fetch for the send worker.
create or replace function public.lock_email_send_jobs(
  p_worker text,
  p_limit int
)
returns table (
  id uuid,
  message_id uuid,
  account_id uuid,
  attempts int,
  max_attempts int
)
language plpgsql
security definer
as $$
begin
  return query
  with picked as (
    select j.id
    from public.email_send_jobs j
    where j.status = 'pending'
      and j.run_after <= now()
    order by j.created_at
    for update skip locked
    limit p_limit
  )
  update public.email_send_jobs j
     set status = 'locked',
         locked_at = now(),
         locked_by = p_worker,
         updated_at = now()
   from picked
   where j.id = picked.id
  returning j.id, j.message_id, j.account_id, j.attempts, j.max_attempts;
end;
$$;

grant execute on function public.lock_email_send_jobs(text, int) to service_role;
```

Apply:

```bash
supabase db push
```

Expected: migration applies cleanly.

- [ ] **Step 3: Manual end-to-end send**

After Task 10 enqueued a job, trigger the worker:

```bash
curl http://localhost:3000/api/cron/email-send -i
```

Expected: `200 OK` with `{ processed: 1, results: [{ id, status: "delivered" }] }`.

Check the recipient mailbox — message should arrive. Check Supabase:

```sql
select status, sent_at, gmail_message_id, gmail_thread_id
from email_messages
order by created_at desc limit 1;
```

Expected: `status='delivered'`, `sent_at` populated, both Gmail IDs filled.

- [ ] **Step 4: Add Hostinger cron entry** (manual, by Prabhu)

In Hostinger cron panel add: `* * * * * curl -H "x-cron-secret: $EMAIL_WORKER_CRON_SECRET" https://app.creativenexusglobal.com/api/cron/email-send`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/email-send/route.ts supabase/migrations/20260517090100_email_send_lock_rpc.sql
git commit -m "feat(email): send worker cron + atomic job lock RPC"
```

---

## Task 12: Gmail incremental + backfill sync

**Files:**
- Create: `src/lib/email/gmail-sync.ts`

- [ ] **Step 1: Write the sync module**

```typescript
// Gmail sync. Two modes:
//   - backfill(accountId, days): first-time pull (default 30 days)
//   - incremental(accountId): uses stored gmail_history_id
// Both upsert email_threads + email_messages and call linkEmail() per new message.

import { createAdminClient } from "@/lib/supabase/admin";
import { loadGmailClient } from "@/lib/email/gmail-client";
import { sanitizeEmailHtml, htmlToPlainText } from "@/lib/email/sanitize";
import { linkEmail } from "@/lib/email/context-linker";
import { ORG_ID } from "@/lib/email";
import type { gmail_v1 } from "googleapis";

export interface SyncOutcome {
  account_id: string;
  mode: "backfill" | "incremental";
  fetched: number;
  upserted: number;
  errors: string[];
}

export async function syncGmailAccount(
  accountId: string,
  opts?: { backfillDays?: number },
): Promise<SyncOutcome> {
  const admin = createAdminClient();
  const { account, gmail } = await loadGmailClient(accountId);

  const outcome: SyncOutcome = {
    account_id: accountId,
    mode: account.gmail_history_id ? "incremental" : "backfill",
    fetched: 0,
    upserted: 0,
    errors: [],
  };

  try {
    if (outcome.mode === "incremental") {
      await incrementalSync(admin, gmail, account.id, account.gmail_history_id!, outcome);
    } else {
      await backfillSync(admin, gmail, account.id, opts?.backfillDays ?? 30, outcome);
    }

    // Refresh historyId from current profile
    const { data: profile } = await gmail.users.getProfile({ userId: "me" });
    if (profile.historyId) {
      await admin
        .from("email_accounts")
        .update({
          gmail_history_id: String(profile.historyId),
          last_sync_at: new Date().toISOString(),
          last_error: null,
          status: "connected",
        })
        .eq("id", accountId);
    }
  } catch (err) {
    const msg = (err as Error).message;
    outcome.errors.push(msg);
    await admin
      .from("email_accounts")
      .update({ last_error: msg, status: "failed" })
      .eq("id", accountId);
  }

  return outcome;
}

async function backfillSync(
  admin: ReturnType<typeof createAdminClient>,
  gmail: gmail_v1.Gmail,
  accountId: string,
  days: number,
  outcome: SyncOutcome,
) {
  const q = `newer_than:${days}d -in:chats`;
  let pageToken: string | undefined;
  do {
    const { data } = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: 100,
      pageToken,
    });
    for (const m of data.messages ?? []) {
      if (!m.id) continue;
      outcome.fetched += 1;
      try {
        await upsertMessage(admin, gmail, accountId, m.id);
        outcome.upserted += 1;
      } catch (err) {
        outcome.errors.push(`${m.id}: ${(err as Error).message}`);
      }
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
}

async function incrementalSync(
  admin: ReturnType<typeof createAdminClient>,
  gmail: gmail_v1.Gmail,
  accountId: string,
  startHistoryId: string,
  outcome: SyncOutcome,
) {
  let pageToken: string | undefined;
  do {
    const { data } = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      pageToken,
    });
    for (const h of data.history ?? []) {
      for (const ma of h.messagesAdded ?? []) {
        const id = ma.message?.id;
        if (!id) continue;
        outcome.fetched += 1;
        try {
          await upsertMessage(admin, gmail, accountId, id);
          outcome.upserted += 1;
        } catch (err) {
          outcome.errors.push(`${id}: ${(err as Error).message}`);
        }
      }
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
}

async function upsertMessage(
  admin: ReturnType<typeof createAdminClient>,
  gmail: gmail_v1.Gmail,
  accountId: string,
  gmailMessageId: string,
) {
  const { data: full } = await gmail.users.messages.get({
    userId: "me",
    id: gmailMessageId,
    format: "full",
  });

  const headers = new Map<string, string>(
    (full.payload?.headers ?? []).map((h) => [h.name!.toLowerCase(), h.value ?? ""]),
  );
  const messageHeaderId = headers.get("message-id") ?? null;
  const inReplyTo = headers.get("in-reply-to") ?? null;
  const references = (headers.get("references") ?? "").split(/\s+/).filter(Boolean);
  const subject = headers.get("subject") ?? null;
  const fromEmail = parseAddress(headers.get("from") ?? "");
  const toEmails = parseAddressList(headers.get("to") ?? "");
  const ccEmails = parseAddressList(headers.get("cc") ?? "");
  const dateHeader = headers.get("date");

  const { html, text } = extractBodies(full.payload ?? {});
  const sanitizedHtml = html ? sanitizeEmailHtml(html) : "";
  const plain = text || (sanitizedHtml ? htmlToPlainText(sanitizedHtml) : "");

  const gmailThreadId = full.threadId!;
  const direction = headers.get("from")?.includes(getAccountEmailLowerCached(accountId))
    ? "outbound" : "inbound";

  // Find or create thread by gmail_thread_id.
  const { data: existingThread } = await admin
    .from("email_threads")
    .select("id")
    .eq("account_id", accountId)
    .eq("gmail_thread_id", gmailThreadId)
    .maybeSingle();

  let threadId = existingThread?.id;
  if (!threadId) {
    const { data: newThread, error } = await admin
      .from("email_threads")
      .insert({
        account_id: accountId,
        gmail_thread_id: gmailThreadId,
        subject,
        participants: dedupe([fromEmail, ...toEmails, ...ccEmails].filter(Boolean) as string[]),
        last_message_at: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString(),
        message_count: 0,
        unread_count: 0,
        snippet: (plain || "").slice(0, 200),
        org_id: ORG_ID,
      })
      .select("id")
      .single();
    if (error || !newThread) throw new Error(error?.message ?? "thread insert failed");
    threadId = newThread.id;
  }

  // Upsert message
  const { data: upserted, error: upErr } = await admin
    .from("email_messages")
    .upsert(
      {
        thread_id: threadId,
        account_id: accountId,
        gmail_message_id: gmailMessageId,
        gmail_thread_id: gmailThreadId,
        message_id: messageHeaderId,
        in_reply_to: inReplyTo,
        references_chain: references,
        from_email: fromEmail,
        to_emails: toEmails,
        cc_emails: ccEmails,
        subject,
        snippet: full.snippet ?? null,
        body_html: sanitizedHtml,
        body_text: plain,
        direction,
        is_read: !(full.labelIds ?? []).includes("UNREAD"),
        status: "received",
        sent_at: dateHeader ? new Date(dateHeader).toISOString() : null,
        org_id: ORG_ID,
      },
      { onConflict: "account_id,gmail_message_id" },
    )
    .select("id")
    .single();

  if (upErr || !upserted) throw new Error(upErr?.message ?? "message upsert failed");

  await admin
    .from("email_threads")
    .update({
      last_message_at: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString(),
      snippet: (plain || "").slice(0, 200),
    })
    .eq("id", threadId);

  await linkEmail(upserted.id);
}

function parseAddress(raw: string): string | null {
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim().toLowerCase() || null;
}
function parseAddressList(raw: string): string[] {
  return raw.split(",").map(parseAddress).filter((x): x is string => !!x);
}
function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
function extractBodies(payload: gmail_v1.Schema$MessagePart): { html: string; text: string } {
  let html = "", text = "";
  const walk = (p: gmail_v1.Schema$MessagePart) => {
    if (p.mimeType === "text/html" && p.body?.data) {
      html += Buffer.from(p.body.data, "base64url").toString("utf-8");
    } else if (p.mimeType === "text/plain" && p.body?.data) {
      text += Buffer.from(p.body.data, "base64url").toString("utf-8");
    }
    for (const part of p.parts ?? []) walk(part);
  };
  walk(payload);
  return { html, text };
}

// Tiny in-memory cache to avoid re-reading account email per message during a sync run.
const emailCache = new Map<string, string>();
function getAccountEmailLowerCached(accountId: string): string {
  return emailCache.get(accountId) ?? "";
}
export function primeAccountEmailCache(accountId: string, email: string) {
  emailCache.set(accountId, email.toLowerCase());
}
```

Call `primeAccountEmailCache(account.id, account.email)` at the top of `syncGmailAccount` (after `loadGmailClient`) — add that one line.

- [ ] **Step 2: Wire into the existing cron**

Modify `src/app/api/cron/email-sync/route.ts` — dispatch by provider. Read current file first:

```bash
cat src/app/api/cron/email-sync/route.ts
```

Replace its handler with:

```typescript
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAccount as syncImap } from "@/lib/email/sync";
import { syncGmailAccount } from "@/lib/email/gmail-sync";

export async function GET() {
  const admin = createAdminClient();
  const { data: accounts } = await admin
    .from("email_accounts")
    .select("id, email, provider, status")
    .eq("status", "connected");

  const out = [];
  for (const acc of accounts ?? []) {
    try {
      if (acc.provider === "gmail_oauth") {
        out.push(await syncGmailAccount(acc.id));
      } else {
        out.push(await syncImap(acc.id));
      }
    } catch (err) {
      out.push({ account_id: acc.id, error: (err as Error).message });
    }
  }
  return NextResponse.json({ synced: out.length, results: out });
}
```

- [ ] **Step 3: Manual sync test**

```bash
curl http://localhost:3000/api/cron/email-sync
```

Expected: JSON listing each connected account with `mode`, `fetched`, `upserted`. First call for an OAuth account is `backfill` and may fetch up to ~hundreds. Second call is `incremental` and should be small.

Verify:

```sql
select count(*) from email_messages where status = 'received';
select count(*) from email_threads where gmail_thread_id is not null;
```

Expected: nonzero, matching what the OAuth account has in the last 30 days.

- [ ] **Step 4: Commit**

```bash
git add src/lib/email/gmail-sync.ts src/app/api/cron/email-sync/route.ts
git commit -m "feat(email): Gmail backfill + incremental sync with body sanitization"
```

---

## Task 13: Context linker — auto-link rules engine

**Files:**
- Create: `src/lib/email/context-linker.ts`

- [ ] **Step 1: Write the linker**

```typescript
// Auto-link rules engine. Runs after each upserted email message.
// Rules (in order, additive — one email can have many context rows):
//  1. Domain match  -> clients
//  2. Email match   -> leads
//  3. Subject regex -> proposals (e.g. PROP-2026-0042)
//  4. Thread inherit: copy existing thread contexts to the new message
// Idempotent via UNIQUE (message_id, context_type, context_id).

import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ID, type EmailContextType, type EmailLinkSource } from "@/lib/email";

interface LinkCandidate {
  context_type: EmailContextType;
  context_id: string;
  link_source: EmailLinkSource;
  confidence: number;
}

export async function linkEmail(messageId: string): Promise<number> {
  const admin = createAdminClient();
  const { data: msg, error } = await admin
    .from("email_messages")
    .select("id, thread_id, from_email, to_emails, subject")
    .eq("id", messageId)
    .single();
  if (error || !msg) return 0;

  const senders = [msg.from_email, ...(msg.to_emails ?? [])]
    .filter((e): e is string => !!e)
    .map((e) => e.toLowerCase());
  const domains = Array.from(new Set(senders.map((e) => e.split("@")[1]).filter(Boolean)));

  const candidates: LinkCandidate[] = [];

  // Rule 1: clients by domain  (only if a `clients` table exists in this codebase;
  // if absent, silently skip — the codebase may use `companies` or similar.)
  try {
    const { data: clients } = await admin
      .from("clients")
      .select("id")
      .in("domain", domains);
    for (const c of clients ?? []) {
      candidates.push({
        context_type: "client",
        context_id: c.id,
        link_source: "auto_domain",
        confidence: 0.9,
      });
    }
  } catch { /* table missing — skip */ }

  // Rule 2: leads by email
  if (senders.length) {
    const { data: leads } = await admin
      .from("leads")
      .select("id")
      .in("email", senders);
    for (const l of leads ?? []) {
      candidates.push({
        context_type: "lead",
        context_id: l.id,
        link_source: "auto_email",
        confidence: 1.0,
      });
    }
  }

  // Rule 3: proposal code in subject
  if (msg.subject) {
    const m = msg.subject.match(/PROP-\d{4}-\d{4}/);
    if (m) {
      try {
        const { data: prop } = await admin
          .from("proposals")
          .select("id")
          .eq("code", m[0])
          .maybeSingle();
        if (prop) {
          candidates.push({
            context_type: "proposal",
            context_id: prop.id,
            link_source: "auto_subject",
            confidence: 1.0,
          });
        }
      } catch { /* proposals table not yet built — skip */ }
    }
  }

  // Rule 4: inherit from siblings on the same thread
  const { data: siblings } = await admin
    .from("email_contexts")
    .select("context_type, context_id")
    .eq("thread_id", msg.thread_id)
    .neq("message_id", msg.id);
  for (const s of siblings ?? []) {
    if (!s.context_id) continue;
    candidates.push({
      context_type: s.context_type as EmailContextType,
      context_id: s.context_id,
      link_source: "auto_thread",
      confidence: 0.95,
    });
  }

  if (candidates.length === 0) return 0;

  // Dedupe in-memory
  const unique = new Map<string, LinkCandidate>();
  for (const c of candidates) unique.set(`${c.context_type}:${c.context_id}`, c);

  const rows = Array.from(unique.values()).map((c) => ({
    message_id: msg.id,
    thread_id: msg.thread_id,
    context_type: c.context_type,
    context_id: c.context_id,
    link_source: c.link_source,
    confidence: c.confidence,
    org_id: ORG_ID,
  }));

  const { error: insErr } = await admin
    .from("email_contexts")
    .upsert(rows, { onConflict: "message_id,context_type,context_id", ignoreDuplicates: true });
  if (insErr) console.error("[context-linker] upsert failed", insErr.message);

  return rows.length;
}
```

- [ ] **Step 2: Manual smoke**

Insert a fake lead whose email matches a sender in your inbox:

```sql
insert into leads (id, name, email, status, org_id)
values (gen_random_uuid(), 'Test Lead', 'someone@known-sender.com', 'new',
        'a0000000-0000-0000-0000-000000000001');
```

Re-sync:

```bash
curl http://localhost:3000/api/cron/email-sync
```

Verify:

```sql
select context_type, context_id, link_source, confidence
from email_contexts
order by created_at desc
limit 10;
```

Expected: rows linking matching emails to the test lead.

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/context-linker.ts
git commit -m "feat(email): context linker rules engine (domain/email/subject/thread)"
```

---

## Task 14: `useContextEmails` hook + Realtime subscription

**Files:**
- Create: `src/lib/email/use-context-emails.ts`

- [ ] **Step 1: Write the hook**

```typescript
"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { EmailContextType, EmailMessage, EmailThread } from "@/lib/email";

export interface ContextThread extends EmailThread {
  messages: EmailMessage[];
}

interface Params {
  contextType: EmailContextType;
  contextId: string;
  accountId?: string;
}

const qk = (p: Params) => ["email-context", p.contextType, p.contextId, p.accountId ?? "any"];

export function useContextEmails(p: Params) {
  const qc = useQueryClient();
  const sb = createClient();

  const query = useQuery({
    queryKey: qk(p),
    queryFn: async (): Promise<ContextThread[]> => {
      const { data: ctxs, error } = await sb
        .from("email_contexts")
        .select(`
          thread_id,
          email_threads!inner (
            id, account_id, subject, participants, last_message_at,
            message_count, unread_count, snippet, gmail_thread_id, created_at, org_id, lead_id
          )
        `)
        .eq("context_type", p.contextType)
        .eq("context_id", p.contextId);
      if (error) throw error;

      const threadIds = Array.from(new Set((ctxs ?? []).map((c: any) => c.thread_id)));
      if (threadIds.length === 0) return [];

      const { data: msgs } = await sb
        .from("email_messages")
        .select("*")
        .in("thread_id", threadIds)
        .order("sent_at", { ascending: true, nullsFirst: false });

      const threads = (ctxs ?? []).map((c: any) => c.email_threads as EmailThread);
      const byThread: Record<string, EmailMessage[]> = {};
      for (const m of (msgs ?? []) as EmailMessage[]) {
        (byThread[m.thread_id] ??= []).push(m);
      }
      return threads
        .map((t) => ({ ...t, messages: byThread[t.id] ?? [] }))
        .sort((a, b) =>
          (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
        );
    },
  });

  useEffect(() => {
    const channel = sb
      .channel(`email-ctx-${p.contextType}-${p.contextId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_messages" },
        () => qc.invalidateQueries({ queryKey: qk(p) }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_contexts",
          filter: `context_id=eq.${p.contextId}` },
        () => qc.invalidateQueries({ queryKey: qk(p) }),
      )
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, [p.contextType, p.contextId, p.accountId, qc, sb]);

  return query;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors (the `any` casts are local to Supabase select responses).

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/use-context-emails.ts
git commit -m "feat(email): useContextEmails hook + Realtime invalidation"
```

---

## Task 15: `ContextEmailPanel` reusable component

**Files:**
- Create: `src/components/email/ContextEmailPanel.tsx`
- Create: `src/components/email/ContextEmailList.tsx`
- Create: `src/components/email/ContextEmailReply.tsx`

- [ ] **Step 1: Write `ContextEmailList.tsx`**

```typescript
"use client";

import type { ContextThread } from "@/lib/email/use-context-emails";

interface Props {
  threads: ContextThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ContextEmailList({ threads, selectedId, onSelect }: Props) {
  if (threads.length === 0) {
    return (
      <div className="px-4 py-8 text-sm text-muted-foreground">
        No emails linked to this record yet.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {threads.map((t) => (
        <li key={t.id}>
          <button
            onClick={() => onSelect(t.id)}
            className={`w-full text-left px-4 py-3 hover:bg-muted/50 ${
              selectedId === t.id ? "bg-muted" : ""
            }`}
          >
            <div className="flex justify-between gap-3">
              <p className="text-sm font-medium truncate">{t.subject ?? "(no subject)"}</p>
              <span className="text-xs text-muted-foreground shrink-0">
                {t.last_message_at
                  ? new Date(t.last_message_at).toLocaleDateString()
                  : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{t.snippet ?? ""}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Write `ContextEmailReply.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ContextThread } from "@/lib/email/use-context-emails";
import type { EmailContextType } from "@/lib/email";

interface Props {
  thread: ContextThread;
  defaultRecipient?: string;
  contextType: EmailContextType;
  contextId: string;
  onSent?: () => void;
}

export function ContextEmailReply({
  thread, defaultRecipient, contextType, contextId, onSent,
}: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastMessage = thread.messages[thread.messages.length - 1];
  const recipient = lastMessage?.from_email ?? defaultRecipient;
  if (!recipient) return null;

  const send = async () => {
    setSending(true); setError(null);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          account_id: thread.account_id,
          thread_id: thread.id,
          to: [recipient],
          subject: thread.subject?.startsWith("Re:")
            ? thread.subject
            : `Re: ${thread.subject ?? ""}`,
          html: `<p>${body.replace(/\n/g, "<br>")}</p>`,
          context_type: contextType,
          context_id: contextId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBody("");
      onSent?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-border p-4 space-y-2">
      <p className="text-xs text-muted-foreground">Reply to {recipient}</p>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply…"
        rows={4}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={send} disabled={sending || !body.trim()}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `ContextEmailPanel.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useContextEmails } from "@/lib/email/use-context-emails";
import { ContextEmailList } from "./ContextEmailList";
import { ContextEmailReply } from "./ContextEmailReply";
import type { EmailContextType } from "@/lib/email";

interface Props {
  contextType: EmailContextType;
  contextId: string;
  defaultRecipient?: string;
  onSent?: (messageId: string) => void;
}

export function ContextEmailPanel({
  contextType, contextId, defaultRecipient, onSent,
}: Props) {
  const { data, isLoading } = useContextEmails({ contextType, contextId });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const threads = data ?? [];
  const selected = threads.find((t) => t.id === selectedId) ?? threads[0];

  return (
    <div className="flex h-full border border-border rounded-lg overflow-hidden">
      <aside className="w-72 border-r border-border overflow-y-auto bg-background">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ContextEmailList
            threads={threads}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
        )}
      </aside>
      <main className="flex-1 flex flex-col bg-background">
        {selected ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <h3 className="font-semibold">{selected.subject ?? "(no subject)"}</h3>
              {selected.messages.map((m) => (
                <article key={m.id} className="border-l-2 border-muted pl-3">
                  <header className="flex justify-between text-xs text-muted-foreground">
                    <span>{m.from_email}</span>
                    <span>{m.sent_at ? new Date(m.sent_at).toLocaleString() : ""}</span>
                  </header>
                  <div
                    className="prose prose-sm max-w-none mt-2"
                    dangerouslySetInnerHTML={{ __html: m.body_html ?? "" }}
                  />
                </article>
              ))}
            </div>
            <ContextEmailReply
              thread={selected}
              defaultRecipient={defaultRecipient}
              contextType={contextType}
              contextId={contextId}
              onSent={() => onSent?.(selected.id)}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            No emails linked yet. Replies will appear here automatically.
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. If `@/components/ui/textarea` or `button` are missing, install them first via shadcn:

```bash
npx shadcn@latest add textarea button
```

- [ ] **Step 5: Commit**

```bash
git add src/components/email/ContextEmailPanel.tsx \
        src/components/email/ContextEmailList.tsx \
        src/components/email/ContextEmailReply.tsx
git commit -m "feat(email): reusable ContextEmailPanel for any module"
```

---

## Task 16: Plug `ContextEmailPanel` into the Leads detail page

**Files:**
- Modify: `src/app/(dashboard)/leads/[id]/page.tsx` (or the closest equivalent — confirm by `ls src/app/(dashboard)/leads/`)

- [ ] **Step 1: Locate the lead detail page**

```bash
ls src/app/\(dashboard\)/leads/
```

If a `[id]` route exists, edit `page.tsx`. If lead details render inline on the index page, add the panel to a new tab/section there. Adjust the next step's path accordingly.

- [ ] **Step 2: Import and render the panel**

Inside the lead detail JSX (under the existing tabs / sections), add:

```tsx
import { ContextEmailPanel } from "@/components/email/ContextEmailPanel";

// ...inside the component, where the "Emails" tab content goes:
<section className="h-[600px]">
  <ContextEmailPanel
    contextType="lead"
    contextId={lead.id}
    defaultRecipient={lead.email ?? undefined}
  />
</section>
```

- [ ] **Step 3: Manual smoke**

1. `npm run dev`
2. Visit a lead whose email matches a synced sender.
3. Confirm linked threads appear in the panel.
4. Click a thread, type a reply, send. Recipient receives, thread updates without page reload.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/leads
git commit -m "feat(leads): embed ContextEmailPanel for lead-scoped emails"
```

---

## Task 17: Universal Inbox UI — rewrite `/inbox`

**Files:**
- Modify: `src/app/(dashboard)/inbox/page.tsx`

- [ ] **Step 1: Read the current stub**

```bash
cat src/app/\(dashboard\)/inbox/page.tsx
```

- [ ] **Step 2: Replace with the universal inbox**

```typescript
"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { ContextEmailReply } from "@/components/email/ContextEmailReply";
import type { EmailMessage, EmailThread } from "@/lib/email";

interface ThreadWithMessages extends EmailThread {
  messages: EmailMessage[];
}

export default function InboxPage() {
  const sb = createClient();
  const qc = useQueryClient();
  const [accountFilter, setAccountFilter] = useState<string | "all">("all");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const accountsQ = useQuery({
    queryKey: ["email-accounts"],
    queryFn: async () => {
      const { data } = await sb
        .from("email_accounts")
        .select("id, email, display_name, provider, status")
        .eq("status", "connected")
        .order("email");
      return data ?? [];
    },
  });

  const threadsQ = useQuery({
    queryKey: ["inbox-threads", accountFilter],
    queryFn: async (): Promise<ThreadWithMessages[]> => {
      let q = sb
        .from("email_threads")
        .select("*, email_messages!inner(*)")
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (accountFilter !== "all") q = q.eq("account_id", accountFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        ...t,
        messages: (t.email_messages ?? []).sort(
          (a: EmailMessage, b: EmailMessage) =>
            (a.sent_at ?? a.created_at).localeCompare(b.sent_at ?? b.created_at),
        ),
      }));
    },
  });

  const selected = useMemo(
    () => (threadsQ.data ?? []).find((t) => t.id === selectedThreadId) ?? null,
    [threadsQ.data, selectedThreadId],
  );

  useEffect(() => {
    const channel = sb
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_messages" },
        () => qc.invalidateQueries({ queryKey: ["inbox-threads"] }),
      )
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, [qc, sb]);

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      <aside className="w-48 border-r border-border p-3 space-y-1 bg-background">
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Accounts</p>
        <button
          onClick={() => setAccountFilter("all")}
          className={`w-full text-left px-2 py-1 rounded text-sm ${
            accountFilter === "all" ? "bg-muted font-medium" : "hover:bg-muted/50"
          }`}
        >
          All
        </button>
        {(accountsQ.data ?? []).map((a) => (
          <button
            key={a.id}
            onClick={() => setAccountFilter(a.id)}
            className={`w-full text-left px-2 py-1 rounded text-sm truncate ${
              accountFilter === a.id ? "bg-muted font-medium" : "hover:bg-muted/50"
            }`}
            title={a.email}
          >
            {a.display_name}
          </button>
        ))}
      </aside>

      <section className="w-96 border-r border-border overflow-y-auto">
        {threadsQ.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        <ul className="divide-y divide-border">
          {(threadsQ.data ?? []).map((t) => (
            <li key={t.id}>
              <button
                onClick={() => setSelectedThreadId(t.id)}
                className={`w-full text-left px-3 py-2 hover:bg-muted/50 ${
                  selectedThreadId === t.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex justify-between text-sm">
                  <span className="font-medium truncate">{t.subject ?? "(no subject)"}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {t.last_message_at
                      ? new Date(t.last_message_at).toLocaleDateString()
                      : ""}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{t.snippet}</p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <main className="flex-1 flex flex-col">
        {selected ? (
          <>
            <header className="border-b border-border p-4">
              <h2 className="font-semibold">{selected.subject ?? "(no subject)"}</h2>
              <p className="text-xs text-muted-foreground">{selected.participants.join(", ")}</p>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selected.messages.map((m) => (
                <article key={m.id} className="border-l-2 border-muted pl-3">
                  <header className="flex justify-between text-xs text-muted-foreground">
                    <span>{m.from_email}</span>
                    <span>{m.sent_at ? new Date(m.sent_at).toLocaleString() : ""}</span>
                  </header>
                  <div
                    className="prose prose-sm max-w-none mt-2"
                    dangerouslySetInnerHTML={{ __html: m.body_html ?? "" }}
                  />
                </article>
              ))}
            </div>
            <ContextEmailReply
              thread={{ ...selected, messages: selected.messages }}
              contextType="none"
              contextId={selected.id}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a thread
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Manual smoke**

1. Visit `/inbox` in the browser.
2. Verify account list populates with connected accounts.
3. Click a thread, body renders.
4. Send a reply — new outbound message appears in the thread within ~2s (worker cron firing).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/inbox/page.tsx
git commit -m "feat(email): universal inbox UI with account filter + realtime"
```

---

## Task 18: "Connect with Google" button on integrations page

**Files:**
- Modify: `src/app/(dashboard)/settings/integrations/page.tsx`

- [ ] **Step 1: Read the existing page**

```bash
cat src/app/\(dashboard\)/settings/integrations/page.tsx
```

- [ ] **Step 2: Add the Google connect button**

Locate the email accounts card section. Add above (or inside) the existing app-password connector:

```tsx
"use client";
// ...existing imports...

async function startGmailOAuth() {
  const res = await fetch("/api/email/oauth/google/start", { method: "POST" });
  const { url, error } = await res.json();
  if (error) { alert(error); return; }
  window.location.href = url;
}

// In the JSX:
<button
  onClick={startGmailOAuth}
  className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
>
  Connect with Google
</button>
```

If the page is a server component, extract the button into a small client component (`src/components/email/ConnectGoogleButton.tsx`) and render it from the server page.

- [ ] **Step 3: Manual smoke**

1. Visit `/settings/integrations`.
2. Click "Connect with Google".
3. Complete consent.
4. Return URL shows `?connected=1`, and the account appears in the list with provider `gmail_oauth`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/settings/integrations
git commit -m "feat(email): Connect with Google button on integrations page"
```

---

## Task 19: Migrate legacy singleton callers off `src/lib/email.ts`

**Files:**
- Modify (all callers of legacy `src/lib/email.ts`)
- Possibly delete: `src/lib/email.ts` (only after all callers migrated)

- [ ] **Step 1: Find all callers**

```bash
grep -rn "from ['\"]@/lib/email['\"]" src --include="*.ts" --include="*.tsx" | grep -v "src/lib/email/"
grep -rn "from ['\"]\.\./email['\"]" src --include="*.ts" --include="*.tsx"
```

Expected: a handful of routes (lead followups, draft email, send email). List them.

- [ ] **Step 2: For each caller, replace direct singleton send with an internal HTTP call to `/api/email/send`** — OR refactor to import a shared service function (`enqueueSend`) from `src/lib/email/queue.ts`.

Recommended: introduce `src/lib/email/queue.ts` with a server-only helper:

```typescript
// Server-only helper. Allows internal routes (cron, lead followup) to
// enqueue an outbound email without round-tripping HTTP.

import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeEmailHtml, htmlToPlainText } from "@/lib/email/sanitize";
import { buildMessageId } from "@/lib/email/mime";
import { ORG_ID, type EmailContextType } from "@/lib/email";

export interface EnqueueInput {
  account_id: string;
  thread_id?: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  context_type?: EmailContextType;
  context_id?: string;
  agent_id?: string;
}

export async function enqueueSend(input: EnqueueInput) {
  const admin = createAdminClient();
  const domain = process.env.MAIL_DOMAIN ?? "creativenexus.in";

  // Thread resolution (mirrors send route logic but stripped of HTTP concerns)
  let threadId = input.thread_id;
  if (!threadId) {
    const { data: t } = await admin
      .from("email_threads")
      .insert({
        account_id: input.account_id,
        subject: input.subject,
        participants: input.to,
        last_message_at: new Date().toISOString(),
        message_count: 0,
        unread_count: 0,
        org_id: ORG_ID,
      })
      .select("id")
      .single();
    if (!t) throw new Error("Failed to create thread");
    threadId = t.id;
  }

  const html = sanitizeEmailHtml(input.html);
  const text = htmlToPlainText(html);

  const { data: msg } = await admin
    .from("email_messages")
    .insert({
      thread_id: threadId,
      account_id: input.account_id,
      message_id: buildMessageId(domain),
      from_email: null,
      to_emails: input.to,
      cc_emails: input.cc ?? [],
      subject: input.subject,
      snippet: text.slice(0, 200),
      body_html: html,
      body_text: text,
      direction: "outbound",
      status: "queued",
      sent_by_agent_id: input.agent_id ?? null,
      org_id: ORG_ID,
    })
    .select("id")
    .single();

  if (!msg) throw new Error("Failed to insert message");

  await admin.from("email_send_jobs").insert({
    message_id: msg.id,
    account_id: input.account_id,
    org_id: ORG_ID,
  });

  if (input.context_type && input.context_id) {
    await admin.from("email_contexts").insert({
      message_id: msg.id,
      thread_id: threadId,
      context_type: input.context_type,
      context_id: input.context_id,
      link_source: "manual",
      confidence: 1.0,
      org_id: ORG_ID,
    });
  }

  return { message_id: msg.id, thread_id: threadId };
}
```

Then in each legacy caller, replace `sendMail(...)` with `enqueueSend({ account_id: defaultAccountId, ... })`.

To pick a default account inside agent code:

```typescript
const { data: defaultAcct } = await admin
  .from("email_accounts")
  .select("id")
  .eq("status", "connected")
  .eq("is_default", true)
  .maybeSingle();
const acctId = defaultAcct?.id ?? (
  await admin.from("email_accounts").select("id").eq("status", "connected").limit(1).single()
).data?.id;
```

- [ ] **Step 3: Delete the singleton if no callers remain**

```bash
grep -rn "from ['\"]@/lib/email['\"]" src --include="*.ts" --include="*.tsx" | grep -v "src/lib/email/"
```

If empty, delete:

```bash
rm src/lib/email.ts
```

Otherwise leave a thin shim that calls `enqueueSend` and add a `// @deprecated` comment.

- [ ] **Step 4: Run lint + typecheck**

```bash
npm run lint
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/queue.ts src/lib/email.ts src/app
git commit -m "refactor(email): migrate legacy singleton callers to enqueueSend"
```

---

## Task 20: End-to-end smoke checklist + setup docs

**Files:**
- Create: `docs/setup/email-core-oauth.md`

- [ ] **Step 1: Write the setup doc**

```markdown
# Email Core — Gmail OAuth Setup

## One-time Google Cloud setup

1. Visit https://console.cloud.google.com/apis/credentials
2. Project: Creative Nexus Command Centre
3. Enable **Gmail API**
4. Create **OAuth Client ID** → "Web application"
5. Authorized redirect URIs:
   - `http://localhost:3000/api/email/oauth/google/callback`
   - `https://app.creativenexusglobal.com/api/email/oauth/google/callback`
6. Copy Client ID + Secret to `.env.local` and Hostinger env:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://app.creativenexusglobal.com/api/email/oauth/google/callback
MAIL_DOMAIN=creativenexus.in
EMAIL_WORKER_BATCH_SIZE=10
EMAIL_WORKER_CRON_SECRET=<openssl rand -hex 32>
```

## Hostinger cron entries

```
*/2 * * * * curl https://app.creativenexusglobal.com/api/cron/email-sync
*   * * * * curl -H "x-cron-secret: $EMAIL_WORKER_CRON_SECRET" https://app.creativenexusglobal.com/api/cron/email-send
```

## Connecting an account

1. Log in to dashboard → Settings → Integrations
2. Click **Connect with Google**
3. Choose `@creativenexus.in` account → consent
4. First sync runs on the next cron tick (within 2 min)
```

- [ ] **Step 2: Run the smoke checklist** (manual, all in one session)

```
[ ] Migrations applied: email_contexts, email_idempotency_keys, email_send_jobs exist
[ ] One Gmail account connected via OAuth (provider=gmail_oauth, status=connected)
[ ] Manual sync hit /api/cron/email-sync → returned mode=backfill, upserted>0
[ ] Second hit /api/cron/email-sync → mode=incremental, upserted=0 (or small)
[ ] email_messages table has body_html, body_text, gmail_message_id populated
[ ] email_contexts has auto-link rows for at least one known lead
[ ] POST /api/email/send with idempotency key → 202 Accepted
[ ] Replay same key → 200 OK with cached response (no duplicate row)
[ ] /api/cron/email-send → processes job, email_messages.status=delivered
[ ] Recipient inbox shows email AND it is correctly threaded with prior conversation
[ ] /inbox page renders accounts, threads, messages; reply works
[ ] /leads/[id] ContextEmailPanel shows linked threads and reply works
[ ] Sending from /leads page auto-tags new email with context_type=lead
```

- [ ] **Step 3: Commit**

```bash
git add docs/setup/email-core-oauth.md
git commit -m "docs(email): Gmail OAuth setup + smoke checklist"
```

---

## Self-Review Notes

**Spec coverage:** All Phase 1 commitments mapped to tasks — OAuth (T3–T7), Gmail client (T7), MIME + sanitizer (T8–T9), send pipeline (T10–T11), sync (T12), context engine (T13), realtime hook + reusable panel (T14–T15), Leads integration (T16), universal inbox (T17), connect button (T18), legacy migration (T19), docs + smoke (T20).

**Out of scope confirmed:** Pub/Sub push notifications, AI inference, templated sends, attachments, multi-tenant tokens, sent_by_agent_id wiring (column reserved).

**Type consistency:** `EmailContextType` and `EmailLinkSource` defined once in `src/lib/email/index.ts` (Task 2) and reused throughout. `EnqueueInput` aligns field names with the `POST /api/email/send` zod schema.

**Known soft spots:**
1. `context-linker.ts` assumes `clients` and `proposals` tables exist — wrapped in try/catch so absence is non-fatal. Confirm table names against actual codebase before T13 smoke.
2. `direction` heuristic in `gmail-sync.ts` compares the `From` header against the account's own email. Edge case: aliased "send-as" addresses may mis-classify; acceptable for Phase 1.
3. `ContextEmailReply` builds HTML by wrapping plaintext in `<p>` — replace with a richer editor (Tiptap) in Phase 2 if desired.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-17-email-core-phase-1.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

**Which approach?**
