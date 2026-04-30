# Email Integration — Track 1 (SMTP + IMAP, Multi-Account)

**Date:** 2026-04-22
**Owner:** Prabhu K
**Scope:** Wire all 4 `@creativenexus.in` Workspace mailboxes into the dashboard so any team member can connect their inbox via app password and the platform can send/receive/thread email per-account.

## Problem

Current send path is a single nodemailer singleton driven by env vars (`SMTP_USER`, `SMTP_PASS`). Every email goes from one mailbox; replies aren't visible in the dashboard; team members can't operate from their own addresses.

## Goal

- Each team member connects their own `@creativenexus.in` mailbox via Workspace **app password** (no OAuth, no Google Cloud Console).
- Dashboard sends from any connected mailbox; `From` header reflects the actual sender.
- Inbound mail polled every 2 min via IMAP; threads + headers stored in Supabase; bodies fetched on demand.
- Inbound replies match to existing leads by `from` email; orphans flagged for review.
- Reply box on a thread sends from the same mailbox the thread is connected to.

## Non-Goals (Track 2)

- OAuth / Gmail API.
- Auto-reply rules or sequence runners.
- Real-time push (IMAP IDLE / Pub/Sub).
- Attachment storage.
- Open / click tracking pixels.
- Full message-body caching in Supabase.

## Architecture

**Storage:** 3 new Supabase tables, all RLS-scoped to `org_id`.

```sql
email_accounts (
  id uuid pk,
  user_id uuid null,                           -- null for shared (info@)
  email text not null unique,
  display_name text not null,
  smtp_host text default 'smtp.gmail.com',
  smtp_port int default 465,
  imap_host text default 'imap.gmail.com',
  imap_port int default 993,
  app_password_encrypted text not null,        -- AES-GCM, key from EMAIL_ENCRYPTION_KEY env
  status text default 'connected',             -- connected | failed | disconnected
  last_sync_at timestamptz,
  last_sync_uid bigint,                        -- highest IMAP UID synced
  last_error text,
  org_id uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

email_threads (
  id uuid pk,
  account_id uuid fk -> email_accounts,
  subject text,
  participants text[],
  last_message_at timestamptz,
  message_count int default 0,
  unread_count int default 0,
  lead_id uuid null,                           -- soft FK to leads
  org_id uuid not null,
  created_at timestamptz default now()
)

email_messages (
  id uuid pk,
  thread_id uuid fk -> email_threads,
  account_id uuid fk -> email_accounts,
  imap_uid bigint,
  message_id text,                             -- RFC 2822 Message-ID
  in_reply_to text,
  references_chain text[],
  from_email text,
  to_emails text[],
  cc_emails text[],
  subject text,
  snippet text,                                -- 200-char preview
  direction text,                              -- inbound | outbound
  is_read boolean default false,
  sent_at timestamptz,
  org_id uuid not null,
  created_at timestamptz default now()
)
```

**Key indexes:** `email_threads(account_id, last_message_at desc)`, `email_messages(thread_id, sent_at)`, `email_threads(lead_id)`.

**Code structure:**
```
src/lib/email/
  encryption.ts        AES-256-GCM encrypt/decrypt using EMAIL_ENCRYPTION_KEY
  smtp.ts              per-account nodemailer transport, sendFromAccount({account_id, ...})
  imap.ts              imapflow wrapper: openMailbox, fetchSinceUid, fetchBodyByUid, setSeen
  threading.ts         buildMessageId(), parseReferences(), join headers for replies
  sync.ts              syncAccount(account_id) → upserts threads + messages
  lead-matcher.ts      matchLeadByEmail(from) → returns lead_id or null

src/app/api/email/
  accounts/route.ts                GET list, POST connect (test+save)
  accounts/[id]/route.ts           DELETE, PATCH
  accounts/[id]/test/route.ts      POST → tests SMTP+IMAP creds
  accounts/[id]/sync/route.ts      POST → manual sync trigger
  send/route.ts                    POST → sendFromAccount
  threads/route.ts                 GET list (filtered by account, lead, status)
  threads/[id]/route.ts            GET thread + messages
  threads/[id]/read/route.ts       POST → mark thread read (IMAP \Seen + DB)
  messages/[id]/body/route.ts      GET → fetch full body via IMAP on demand

src/app/api/cron/email-sync/route.ts   Hostinger cron, every 2 min, syncs all accounts

src/app/(dashboard)/settings/integrations/page.tsx   4 mailbox cards
src/app/(dashboard)/inbox/page.tsx                   thread list + reply (replaces current stub)
docs/setup/email-app-passwords.md                    team-member self-serve guide
```

**Migration to delete the singleton:** `src/lib/email.ts` callers (`leads/followups/process`, `leads/send-email`, `leads/draft-email`) get migrated to call `sendFromAccount({ account_id, ... })`. Default account picked by user role / configurable.

## Security

- **App password storage:** AES-256-GCM with random IV per record. Key from `EMAIL_ENCRYPTION_KEY` env (32-byte hex, generated once and added to Hostinger env vars).
- **No password ever returned via API** — only success/failure.
- **Connection test on save:** POST connect endpoint runs `verify()` against both SMTP + IMAP before persisting; returns clear error if creds wrong.
- **RLS:** every query scoped to `org_id` from auth context. Single-tenant for now (all rows tagged with the seeded `ORG_ID`), multi-tenant ready.
- **No password rotation in Track 1** — flagged for Track 2 along with key rotation.

## Inbound Sync Strategy

- Cron route `/api/cron/email-sync` triggered every 2 min by Hostinger cron.
- For each account with `status='connected'`:
  1. Open `INBOX` via IMAP.
  2. Search UIDs > `last_sync_uid` (or last 30 days if first run).
  3. Fetch envelope + flags + Message-ID + In-Reply-To + References for each new UID.
  4. Group into threads by Message-ID chain. Reuse existing `email_threads` row if any thread message matches; else create new thread.
  5. Match thread participants to `leads.email`; populate `email_threads.lead_id` if hit.
  6. Update `email_accounts.last_sync_uid` + `last_sync_at`.
- Bodies are NOT stored. `messages/[id]/body/route.ts` fetches on demand via IMAP and caches client-side only.
- Outbound (sent via dashboard) gets a synthetic `email_messages` row at send time with `direction='outbound'`. We don't try to sync the `[Gmail]/Sent Mail` folder (Gmail puts sent items there automatically since SMTP submission via Gmail).

## Reply Threading

When user clicks "Reply" on a thread:
- New message uses `In-Reply-To: <last-message-id>` and `References: <chain>` headers.
- Subject prefixed `Re: ` (only if not already there).
- `From` is the account the thread is on.
- After successful send, insert outbound row to `email_messages` and bump `email_threads.last_message_at`.

## UI

**`/settings/integrations` page:**
- Page header "Email integrations".
- 4 cards (one per `@creativenexus.in` address). Each card shows:
  - Email + display name
  - Status pill (Connected / Failed / Not connected)
  - Last sync time
  - "Connect" / "Test" / "Disconnect" buttons
- Connect dialog: app password input (paste only, masked), test → save flow.
- Below cards: small "How to generate an app password" link → opens setup guide.

**`/inbox` page (replaces stub):**
- Left: account filter (All / Prabhu / Tisha / Rishabh / info@), thread list grouped by date.
- Right: selected thread → message list (latest first), each row click expands body (lazy fetch).
- Reply box at bottom of thread view: textarea + Send. Auto-routes to account that owns the thread.
- Top right: search box (subject + from), unread count badge.

## Success Criteria

1. Each of 4 mailboxes can be connected via UI → status flips to Connected.
2. Sending a test email from the dashboard arrives at recipient with correct `From` header.
3. Inbound mail to any connected account appears in `/inbox` within 2 min.
4. Reply from `/inbox` lands in the original sender's inbox and is correctly threaded (Gmail groups it under the same conversation).
5. A reply matching a known lead surfaces on that lead's CRM page within 2 min.
6. `lib/email.ts` singleton is deleted; all 3 callers migrated; no env-var `SMTP_USER` / `SMTP_PASS` references remain.

## Open Decisions Resolved

- **info@ ownership:** owned by Prabhu (he holds app password). Tisha/Rishabh granted view rights via UI in a future patch.
- **Default sender:** when sending from a generic API (e.g. lead followup processor), use the account where `is_default = true` (Track 2 adds this column; Track 1 picks the first connected account).
- **Org scoping:** all rows tagged with the existing seeded `ORG_ID` (`a0000000-0000-0000-0000-000000000001`). RLS enabled but single-tenant in practice.

## Risks

| Risk | Mitigation |
|---|---|
| User tries to connect without 2FA enabled | Test endpoint returns clean error → setup guide explains 2FA prerequisite |
| Hostinger cron misconfigured | Manual sync button per account → `/api/email/accounts/[id]/sync` |
| Encryption key lost | Setup guide instructs Prabhu to back up `EMAIL_ENCRYPTION_KEY` to 1Password before saving any account |
| IMAP UID rollover (rare) | Use `Message-ID` as backup dedup key |
| Lead matcher false positive (shared address) | Match only when single lead returned for the email |
| Existing leads/send-email callers break during migration | Phased: keep `lib/email.ts` as deprecated shim that picks first account during cutover, delete after smoke test |
