# Email Core — Gmail OAuth Setup

Phase 1 ships the Email Core: a Gmail-OAuth-powered universal email layer with
a context engine that any Command Centre module can plug into via the reusable
`<ContextEmailPanel />` component. The legacy IMAP+SMTP (app password) path is
preserved for accounts that have not yet been migrated.

## One-time Google Cloud setup (by Prabhu)

1. Visit https://console.cloud.google.com/apis/credentials
2. Project: Creative Nexus Command Centre
3. Enable **Gmail API** on the project
4. Create **OAuth Client ID** → application type "Web application"
5. Authorized redirect URIs:
   - `http://localhost:3000/api/email/oauth/google/callback` (dev)
   - `https://app.creativenexusglobal.com/api/email/oauth/google/callback` (prod)
6. Save the Client ID + Client Secret
7. Generate a worker cron secret:

   ```bash
   openssl rand -hex 32
   ```

8. Add to `.env.local` (and to Hostinger env for prod):

   ```env
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/email/oauth/google/callback
   MAIL_DOMAIN=creativenexus.in
   EMAIL_WORKER_BATCH_SIZE=10
   EMAIL_WORKER_CRON_SECRET=<the openssl hex above>
   ```

## Database migrations

Phase 1 adds two new migrations on top of the existing Track 1 schema:

```
supabase/migrations/
  20260517090000_email_core_oauth.sql        (OAuth columns, email_contexts, email_idempotency_keys, email_send_jobs)
  20260517090100_email_send_lock_rpc.sql     (lock_email_send_jobs RPC with FOR UPDATE SKIP LOCKED)
```

Apply locally and to the remote project:

```bash
supabase db push
```

> ⚠️ **Drift note:** At plan-execution time the remote Supabase project
> (`anbdkioadfhvbqptylee`) was 12 migrations behind the local folder — the
> base Track 1 migration `20260422090000_email_accounts.sql` had never been
> applied remotely. Running `supabase db push` will apply the full backlog
> in order and is safe (all email migrations are additive with `IF NOT EXISTS`
> guards).

After the push, verify on the remote:

```sql
select column_name from information_schema.columns
where table_name = 'email_accounts' and column_name like '%oauth%';
-- expect: oauth_access_token_encrypted, oauth_expires_at,
--         oauth_refresh_token_encrypted, oauth_scopes

select count(*) from email_contexts;          -- 0
select count(*) from email_idempotency_keys;  -- 0
select count(*) from email_send_jobs;         -- 0
```

## Hostinger cron entries

```cron
# Sync inbox + outbound from Gmail (every 2 min)
*/2 * * * * curl -fsS https://app.creativenexusglobal.com/api/cron/email-sync

# Drain the outbound queue (every minute)
* * * * * curl -fsS -H "x-cron-secret: $EMAIL_WORKER_CRON_SECRET" https://app.creativenexusglobal.com/api/cron/email-send
```

(The sync cron uses the existing `CRON_SECRET` auth pattern; the send cron uses
a separate `x-cron-secret` header to keep worker auth isolated from read paths.)

## Connecting an account

1. Log in to dashboard → **Settings → Integrations**
2. Click **Connect with Google** (the blue-bannered card at the top of the page)
3. Choose the `@creativenexus.in` account → consent to Gmail read/send/labels
4. Land back on `/settings/integrations?connected=1`
5. First sync runs on the next 2-minute cron tick — initial backfill covers the
   last 30 days; subsequent syncs are incremental via `gmail.users.history.list`

## Smoke checklist

Once OAuth credentials are configured, the migration is applied, and at least
one Gmail account is connected, walk through this list end-to-end:

```
[ ] Migrations applied: email_contexts, email_idempotency_keys, email_send_jobs exist on remote
[ ] One Gmail account connected via OAuth (provider=gmail_oauth, status=connected)
[ ] First /api/cron/email-sync call returned mode=backfill, upserted>0
[ ] Second /api/cron/email-sync call returned mode=incremental, upserted=0 (or small)
[ ] email_messages table has body_html, body_text, gmail_message_id populated
[ ] email_contexts has auto-link rows for at least one known lead
[ ] POST /api/email/send with Idempotency-Key → 202 Accepted
[ ] Replay same key → 200 OK with cached response (no duplicate row)
[ ] /api/cron/email-send → processes job, email_messages.status=delivered
[ ] Recipient inbox shows email AND it threads with prior conversation in Gmail UI
[ ] /inbox page renders accounts, threads, messages; reply works
[ ] /leads page → expand a lead → Linked emails section renders threads + reply
[ ] Sending from /leads tags the new email with context_type=lead
```

## Architecture cheat sheet

```
Browser
  │ POST /api/email/send  (+ Idempotency-Key)
  ▼
Send route        ─inserts→  email_messages(status=queued)
                  ─inserts→  email_send_jobs(status=pending)
                  ─inserts→  email_contexts (if context_type/id provided)
                  ─inserts→  email_idempotency_keys
                  ─returns→  202 { message_id, thread_id, status: "queued" }
                                          │
                                          │  (Hostinger cron, 60s)
                                          ▼
                       /api/cron/email-send
                                          │
                       lock_email_send_jobs RPC  (FOR UPDATE SKIP LOCKED)
                                          │
                       loadGmailClient(account_id)
                                          │
                       buildMime(...) → gmail.users.messages.send(threadId)
                                          │
                       email_messages.status='delivered', sent_at, gmail_*
                       email_send_jobs.status='done'
                                          │
                       Supabase Realtime push  →  /inbox + /leads update live
```

```
Gmail
  │ (every 2 min via Hostinger cron)
  ▼
/api/cron/email-sync  →  per account dispatch:
                          - provider='gmail_oauth' → syncGmailAccount()
                          - provider='smtp_imap'   → syncAccount() (legacy)

syncGmailAccount:
  - first time:    newer_than:30d query
  - subsequent:    gmail.users.history.list since stored gmail_history_id
  - per message:   parse MIME, sanitize HTML, upsert email_threads + email_messages
  - per message:   call linkEmail() → auto-tags clients/leads/proposals/inherits
```

## Files added in Phase 1

| File | Purpose |
|---|---|
| `supabase/migrations/20260517090000_email_core_oauth.sql` | Schema: OAuth columns, contexts, idempotency, send jobs |
| `supabase/migrations/20260517090100_email_send_lock_rpc.sql` | Atomic job lock RPC |
| `src/lib/email/gmail-oauth.ts` | Google OAuth2 client factory + scope constants |
| `src/lib/email/gmail-client.ts` | Per-account Gmail API client with token refresh |
| `src/lib/email/gmail-sync.ts` | Backfill + incremental sync via Gmail API |
| `src/lib/email/mime.ts` | RFC 5322 builder with threading headers |
| `src/lib/email/sanitize.ts` | DOMPurify wrapper + plaintext extractor |
| `src/lib/email/context-linker.ts` | Auto-link rules engine (domain/email/subject/thread) |
| `src/lib/email/queue.ts` | Server-internal enqueueSend helper |
| `src/lib/email/use-context-emails.ts` | React Query hook + Realtime subscription |
| `src/app/api/email/oauth/google/start/route.ts` | POST consent URL |
| `src/app/api/email/oauth/google/callback/route.ts` | OAuth exchange + account upsert |
| `src/app/api/email/send/route.ts` | (Rewritten) Idempotent send → queue |
| `src/app/api/cron/email-send/route.ts` | Worker: locks + sends + retries |
| `src/components/email/ContextEmailPanel.tsx` | Reusable per-module panel |
| `src/components/email/ContextEmailList.tsx` | Thread list |
| `src/components/email/ContextEmailReply.tsx` | Reply composer |

## What's deferred to Phase 2

- **Gmail Pub/Sub push notifications** — currently polled every 2 min
- **AI context inference** for emails the rules engine can't classify
- **Auto-summarize / suggested replies** powered by Claude
- **Templated sends** ("Send Proposal", "Send Invoice")
- **Attachment upload from composer** (inbound attachments are stored in `attachments_json` already, just not surfaced in reply UI)
- **Multi-tenant token isolation** (Phase 1 is single-tenant, all rows tagged with seeded `ORG_ID`)
- **`sent_by_agent_id` wiring** (column reserved, not populated by any agent yet)
- **Migrating `lead_emails` callers** of the legacy `src/lib/email.ts` singleton to consume worker status via Realtime instead of synchronous SMTP returns
- **Rich-text editor** for the reply composer (currently plaintext → wrapped `<p>`)
- **Tracking-pixel proxy + image src rewriting** to protect user IP from senders
