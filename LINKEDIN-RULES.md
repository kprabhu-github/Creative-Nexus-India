# LinkedIn module — developer rules

> **Read this before modifying anything under `src/app/api/linkedin/`, `src/lib/linkedin*.ts`, or `src/app/(dashboard)/linkedin/`.**
>
> The full rationale, caps, and emergency procedures live in the team reference:
> `../LinkedIn-Rules-and-Modification-Guide.docx` (v1.0, Apr 20 2026).
> Cite rules by number in PRs: `"Adds welcome_inmail action — complies with Rule 16"`.

---

## The five things you cannot do

Any one of these in a PR means the PR is rejected.

1. **No automated actions.** Nothing in the codebase sends a connect, message, InMail, like, follow, comment, endorsement, invite, or any other LinkedIn action without a human clicking a button on linkedin.com in that moment. No scheduled-send either — that's still automation.
2. **No scraping.** No programmatic fetch of any linkedin.com URL. Not through `puppeteer`, `playwright`, `selenium`, `cheerio` against LinkedIn HTML, `apify-client` with a LinkedIn actor, `fetch`, `axios`, `curl`, `requests`, or anything else. Not "just the public parts." Not "just once."
3. **No third-party LinkedIn automators.** Banned dependencies (see `BANNED_IMPORTS` below) may not appear in `package.json` or anywhere else.
4. **No cap bypass.** `safeAction()` must run before every write to `linkedin_prospect_actions`. Don't add a "fast path." Don't add a feature that writes around it.
5. **No multi-operator sharing of a personal profile.** Each personal `linkedin_accounts` row is used by one named human. Company-page multi-admin is allowed.

---

## Banned imports (the grep)

```bash
# All of these should return zero matches. Run before every PR.
grep -rn "puppeteer\|playwright\|selenium\|dripify\|waalaxy\|linked-helper" src/
grep -rn "phantombuster\|meetalfred\|expandi\|zopto\|octopuscrm\|lempod" src/
grep -rn "actorId.*linkedin" src/
grep -rn "harvestapi/linkedin\|george.the.developer/linkedin" src/
```

If any match, remove the offending dependency, revert the commit that introduced it, rotate any credentials that were in the environment when it ran.

---

## The decision tree

Before writing code, answer these in order. Stop at the first YES that says "reject."

| Question | If YES |
|---|---|
| Does this POST/PUT/DELETE to `linkedin.com`? | **Reject** — Rule 13.1 |
| Does this GET a `linkedin.com` URL programmatically? | **Reject** — Rule 13.2 |
| Does this let the operator exceed daily/weekly caps? | **Reject** — Rule 17 |
| Does this share a personal account across humans? | **Reject** — Rule 13.6 |
| Does this introduce a new `action_key`? | Follow Rule 16 (see below). |
| Does this change a cap value? | Follow Rule 17 (ops approval). |
| Does this import prospects from a new source? | Source must be in Rule 12 allowlist. |
| Does this draft or suggest messages? | Follow Rule 19 (personalization enforcement). |
| None of the above. | Ship it. |

---

## Rule 16 — adding a new `action_key`

When you introduce a new action (e.g. `welcome_inmail`, `reply_comment`, `share_post`), update **all four** of these in the same PR:

### 1. Database — add the key to `hard_caps`

```sql
-- Migration: linkedin_add_<action_key>
UPDATE linkedin_accounts
SET hard_caps = hard_caps || '{"welcome_inmail": 3}'::jsonb
WHERE type = 'personal';
```

Optionally add to `weekly_limits` if the action is rate-sensitive (connect, inmail, message).

### 2. Safety pipeline — `src/lib/linkedin-safety-pipeline.ts`

```typescript
const PACING_MIN_SECONDS: Record<string, number> = {
  connect: 120,
  // ...
  welcome_inmail: 240, // ← new entry. Think about the cadence.
};
```

No defaults. If you don't know the cadence, ask ops.

### 3. Drawer — `src/app/(dashboard)/linkedin/inbox/page.tsx` + HTML prototype

Add the option to the `<Select>` in `ProspectDrawer`:

```tsx
<SelectItem value="welcome_inmail">Welcome InMail</SelectItem>
```

And to the action dropdown in `LinkedIn-Dashboard-Prototype.html`.

### 4. Docs — update section 6/7 of the rule book

Commit message: `Rule 16 — add welcome_inmail`.

---

## Rule 17 — changing a cap value

- **Small adjustments (±10%):** ops lead approval in PR. Log change + rationale to `linkedin_activity_log` with `type='info'`.
- **Larger adjustments:** require review against observed rejection rate over the last 14 days. Link the data in the PR.
- **Hard ceilings that cannot be raised:**
  - `connect` per day ≤ 20 (personal, established)
  - `connect` per week ≤ 100 (any account)
  - `inmail` per day ≤ 8
- **Downward adjustments (safer):** always allowed; just document the reason.

---

## Rule 19 — message-drafting features

Any feature that suggests, drafts, or auto-fills an outreach message must:

1. Require at least one prospect variable in the template (`{first_name}`, `{company}`, `{industry}`, `{role}`, `{recent_post}`, `{mutual_connection}`).
2. Warn the operator if the same template has gone out to 5+ prospects in the last 7 days with no personalization delta.
3. Never paste into a `linkedin.com` field. The operator types/pastes on their own.

---

## PR checklist

Copy-paste this into every LinkedIn-adjacent PR description. Tick every box.

```
- [ ] Zero new dependencies from BANNED_IMPORTS
- [ ] No new code paths that hit a linkedin.com URL
- [ ] If new action_key: all 4 steps in Rule 16 completed
- [ ] If cap changed: ops approval linked
- [ ] safeAction() still runs before every write to linkedin_prospect_actions
- [ ] `npx tsc --noEmit` passes clean
- [ ] `grep -rn "puppeteer|playwright|selenium|dripify|waalaxy|linked-helper" src/` returns zero
- [ ] Rule book change-log updated if a rule changed
```

---

## Required patterns

### Every action-log write runs through `safeAction()`

```typescript
// src/app/api/linkedin/prospects/[id]/actions/route.ts
const pipeline = await safeAction(supabase, {
  accountId,
  actionKey: body.action_key,
  profileUrl: prospect.profile_url,
});
if (pipeline.decision === "block") {
  return NextResponse.json({ error: ..., pipeline }, { status: 429 });
}
```

### Every `profile_url` passes `isSafeLinkedInUrl()`

```typescript
// Before storing, before any <a href>, before any deep-link:
if (!isSafeLinkedInUrl(url)) {
  return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
}
```

### Every batch import uses `upsert` with dedup

```typescript
await supabase
  .from("linkedin_prospects")
  .upsert(validRows, {
    onConflict: "campaign_id,profile_url",
    ignoreDuplicates: true,
  });
```

### Every new account starts in `warmup_tier='new'`

```typescript
{
  warmup_tier: "new",
  hard_caps: {
    connect: 5,    // reduced for new accounts
    message: 15,
    // ...
  },
}
```

Promotion to `established` requires ops approval after 90 days and 500+ connections.

---

## Emergency procedures (condensed)

| Event | Immediate action |
|---|---|
| Login challenge on a personal profile | Operator completes challenge. Pause outreach on that account for 24h. Review last 48h activity for clustering. |
| Temporary restriction (level 4) | Killswitch ON. Cooldown = restriction end + 48h. Cut caps in half for 30 days after resuming. |
| Permanent restriction (level 5) | Stop everything on adjacent accounts (same IP, same device). Preserve activity log. Engage legal. |
| Health score < 70 | Pause for 4h. Review last 10 prospects + 5 messages. Fix template or filter. Resume at half cap. |
| Banned import detected in codebase | Revert commit. Rotate any keys. File incident. Update this file's change-log. |

Full procedures in section 21-25 of the rule book docx.

---

## Change log

| Version | Date | Editor | Change |
|---|---|---|---|
| 1.0 | 2026-04-20 | build team | Initial version — banned imports list, decision tree, PR checklist, emergency summary |

Keep this file in sync with `../LinkedIn-Rules-and-Modification-Guide.docx`. When you change a rule, bump the version in both.
