# LinkedIn Outreach UX Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 5-tab LinkedIn module into a guided workflow with contextual "Next →" CTAs, sticky "Running as" banner, smart campaign defaults, timeline-style funnel, and status-aware prospect rows.

**Architecture:** All changes are client-side React state in `src/app/(dashboard)/linkedin/page.tsx`. No new API routes, no DB migrations. New state: `activeAccountId`. New components defined inline in page.tsx (same pattern as existing `AccountCard`, `ProspectRow`, etc.).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, lucide-react icons, existing Supabase endpoints.

**Spec:** `docs/superpowers/specs/2026-04-20-linkedin-ux-flow-design.md`

**Testing strategy:** No Vitest/Playwright coverage exists for this page. Verification is manual via `npm run build` (type check) + `npm run lint` + live browser test after each commit.

---

## Task 1: Add `activeAccountId` state and rename "Use" button

**Files:**
- Modify: `src/app/(dashboard)/linkedin/page.tsx` (top-level component state + AccountCard)

- [ ] **Step 1: Add state declaration**

In the top-level `LinkedInPage` component, near the other `useState` calls for `activeTab` and `selectedCampaignId`, add:

```ts
const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
```

- [ ] **Step 2: Pass setter + tab setter down to AccountCard**

Update `AccountCard` props interface to include:

```ts
onRunCampaign: (accountId: string) => void;
```

In the page.tsx render where `AccountCard` is used, pass:

```tsx
onRunCampaign={(id) => {
  setActiveAccountId(id);
  setActiveTab("campaigns");
  window.scrollTo({ top: 0, behavior: "smooth" });
}}
```

- [ ] **Step 3: Rename button inside AccountCard**

Find the existing "Use" button in the AccountCard component. Replace its label with "Run Campaign" and wire onClick to `props.onRunCampaign(account.id)`. Remove any prior click handler that set a different state.

- [ ] **Step 4: Build check**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/linkedin/page.tsx
git commit -m "feat(linkedin): add activeAccountId state and Run Campaign button"
```

---

## Task 2: Running-as banner on Campaigns tab

**Files:**
- Modify: `src/app/(dashboard)/linkedin/page.tsx` (Campaigns tab JSX block)

- [ ] **Step 1: Locate campaigns tab render block**

In page.tsx, find `{activeTab === "campaigns" && (`. This is the insertion point.

- [ ] **Step 2: Add banner at top of campaigns block**

Immediately inside the campaigns tab wrapper div, add:

```tsx
{activeAccountId && (() => {
  const acc = accounts.find((a) => a.id === activeAccountId);
  if (!acc) return null;
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg bg-[#0B1C3D] px-4 py-2 text-white">
      <div className="text-sm">
        Running as <span className="font-semibold">{acc.name}</span>
      </div>
      <button
        onClick={() => setActiveAccountId(null)}
        className="text-sm text-[#FF6B4A] hover:underline"
      >
        change
      </button>
    </div>
  );
})()}
```

- [ ] **Step 3: Build check**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/linkedin/page.tsx
git commit -m "feat(linkedin): add Running-as banner on Campaigns tab"
```

---

## Task 3: Smart-default campaign picker for active account

**Files:**
- Modify: `src/app/(dashboard)/linkedin/page.tsx` (Campaigns tab JSX block)

- [ ] **Step 1: Compute scoped campaigns**

Above the campaigns tab return block (but inside the component), add:

```ts
const accountCampaigns = activeAccountId
  ? campaigns.filter((c) => c.accountId === activeAccountId)
  : campaigns;
```

Use `accountCampaigns` wherever the existing list renders campaigns for that tab.

- [ ] **Step 2: Add picker cards (only when activeAccountId set and accountCampaigns.length > 0)**

Directly below the banner added in Task 2, add:

```tsx
{activeAccountId && accountCampaigns.length > 0 && !selectedCampaignId && !showNewCampaignForm && (
  <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
    <button
      onClick={() => setShowNewCampaignForm(true)}
      className="rounded-lg border-2 border-[#FF6B4A] bg-white p-6 text-left transition hover:bg-[#FFF3F0]"
    >
      <div className="text-lg font-semibold text-[#FF6B4A]">+ New Campaign</div>
      <div className="mt-1 text-sm text-slate-600">
        Start a fresh outreach sequence for {accounts.find((a) => a.id === activeAccountId)?.name}.
      </div>
    </button>
    <button
      onClick={() => setSelectedCampaignId(accountCampaigns[0].id)}
      className="rounded-lg border-2 border-[#0B1C3D] bg-white p-6 text-left transition hover:bg-slate-50"
    >
      <div className="text-lg font-semibold text-[#0B1C3D]">
        ▶ Continue {accountCampaigns[0].name}
      </div>
      <div className="mt-1 text-sm text-slate-600">
        Resume most recent campaign
      </div>
    </button>
  </div>
)}
```

**Note:** If `showNewCampaignForm` state does not yet exist, add:
```ts
const [showNewCampaignForm, setShowNewCampaignForm] = useState(false);
```
near the other useState calls in the component.

- [ ] **Step 3: Auto-open new form when zero campaigns**

Add a `useEffect` near the other effects:

```ts
useEffect(() => {
  if (activeAccountId && accountCampaigns.length === 0) {
    setShowNewCampaignForm(true);
  }
}, [activeAccountId, accountCampaigns.length]);
```

- [ ] **Step 4: Pre-fill account binding in new campaign form**

Find the "New Campaign" form inside page.tsx. In its submit handler (`handleCreateCampaign` or equivalent), when `activeAccountId` is set, include it in the POST body as `account_id: activeAccountId`. If the form has an account picker field, default its value to `activeAccountId`.

- [ ] **Step 5: Build check**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/linkedin/page.tsx
git commit -m "feat(linkedin): smart default picker for active account campaigns"
```

---

## Task 4: "Next: Build Funnel →" CTA on Campaigns tab

**Files:**
- Modify: `src/app/(dashboard)/linkedin/page.tsx`

- [ ] **Step 1: Add CTA at bottom of campaigns tab**

At the bottom of the campaigns tab wrapper div (just before its closing `</div>`), add:

```tsx
{selectedCampaignId && (
  <div className="mt-6 flex justify-end">
    <button
      onClick={() => setActiveTab("funnel")}
      className="rounded-lg bg-[#FF6B4A] px-6 py-3 text-sm font-semibold text-white shadow hover:bg-[#E85A49]"
    >
      Next: Build Funnel →
    </button>
  </div>
)}
```

- [ ] **Step 2: Build check**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/linkedin/page.tsx
git commit -m "feat(linkedin): add Next Build Funnel CTA on campaigns"
```

---

## Task 5: Build Funnel context header + empty state

**Files:**
- Modify: `src/app/(dashboard)/linkedin/page.tsx` (Funnel tab JSX block)

- [ ] **Step 1: Locate funnel tab render block**

Find `{activeTab === "funnel" && (`. This is the edit location.

- [ ] **Step 2: Add context header**

At the top of the funnel tab content, add:

```tsx
{(() => {
  const camp = campaigns.find((c) => c.id === selectedCampaignId);
  if (!camp) {
    return (
      <div className="rounded-lg bg-slate-50 p-8 text-center">
        <div className="text-lg font-semibold text-slate-800">No campaign selected</div>
        <div className="mt-1 text-sm text-slate-600">
          Select or create a campaign to build a funnel.
        </div>
        <button
          onClick={() => setActiveTab("campaigns")}
          className="mt-4 rounded-lg bg-[#FF6B4A] px-4 py-2 text-sm font-semibold text-white"
        >
          Go to Campaigns →
        </button>
      </div>
    );
  }
  return (
    <div className="mb-4 text-sm text-slate-600">
      Funnel for: <span className="font-semibold text-[#0B1C3D]">{camp.name}</span>
    </div>
  );
})()}
```

Wrap the existing funnel-editing JSX so it only renders when `selectedCampaignId` is truthy (if it doesn't already).

- [ ] **Step 3: Build check**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/linkedin/page.tsx
git commit -m "feat(linkedin): add funnel context header and empty state"
```

---

## Task 6: Timeline-style funnel steps

**Files:**
- Modify: `src/app/(dashboard)/linkedin/page.tsx` (StepSettings or equivalent + wrapper)

- [ ] **Step 1: Define step icon map**

Near the top of page.tsx (or in a constants block inside the component), add:

```tsx
import { Handshake, Mail, MessageCircle, ThumbsUp, UserPlus, Send } from "lucide-react";

const STEP_ICONS: Record<string, typeof Mail> = {
  connect: UserPlus,
  message: Mail,
  comment: MessageCircle,
  like: ThumbsUp,
  endorse: Handshake,
  followup: Send,
};
```

- [ ] **Step 2: Replace raw step rows with timeline cards**

Find the funnel step rendering block (maps over `funnelSteps` or `campaign.funnel_steps`). Replace the row layout with:

```tsx
<div className="space-y-2">
  {funnelSteps.map((step, idx) => {
    const Icon = STEP_ICONS[step.actionId] ?? Mail;
    return (
      <div key={idx}>
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B1C3D] text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[#0B1C3D]">
                Step {idx + 1} · {step.actionId} · Day {step.dayOffset ?? 0}
              </div>
              <button
                onClick={() => removeFunnelStep(idx)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
            {/* Keep existing template textarea + personalise checkbox inside */}
            <StepSettings step={step} index={idx} onChange={updateFunnelStep} />
          </div>
        </div>
        {idx < funnelSteps.length - 1 && (
          <div className="flex justify-center">
            <button
              onClick={() => insertFunnelStep(idx + 1)}
              className="my-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
            >
              + Add step
            </button>
          </div>
        )}
      </div>
    );
  })}
</div>
```

If `insertFunnelStep` and `removeFunnelStep` don't exist, add:

```ts
function insertFunnelStep(at: number) {
  setFunnelSteps((s) => [
    ...s.slice(0, at),
    { actionId: "message", template: "", dayOffset: 0, aiPersonalise: true },
    ...s.slice(at),
  ]);
}
function removeFunnelStep(at: number) {
  setFunnelSteps((s) => s.filter((_, i) => i !== at));
}
```

- [ ] **Step 3: Build check**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/linkedin/page.tsx
git commit -m "feat(linkedin): timeline-style funnel step cards"
```

---

## Task 7: "Save & Next: Discover Prospects →" CTA

**Files:**
- Modify: `src/app/(dashboard)/linkedin/page.tsx`

- [ ] **Step 1: Add combined save + discover + switch handler**

Inside the page component:

```ts
async function handleSaveAndDiscover() {
  if (!selectedCampaignId) return;
  await saveFunnelToCampaign(selectedCampaignId);
  await handleDiscover(selectedCampaignId);
  setActiveTab("queue");
}
```

- [ ] **Step 2: Add CTA button at bottom of funnel tab**

Just before the closing tag of the funnel tab block, add:

```tsx
{selectedCampaignId && (
  <div className="mt-6 flex justify-end">
    <button
      onClick={handleSaveAndDiscover}
      className="rounded-lg bg-[#FF6B4A] px-6 py-3 text-sm font-semibold text-white shadow hover:bg-[#E85A49]"
    >
      Save & Next: Discover Prospects →
    </button>
  </div>
)}
```

- [ ] **Step 3: Build check**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/linkedin/page.tsx
git commit -m "feat(linkedin): Save and Next CTA on funnel tab"
```

---

## Task 8: Queue stats strip

**Files:**
- Modify: `src/app/(dashboard)/linkedin/page.tsx` (Queue tab JSX)

- [ ] **Step 1: Compute counts and render strip**

Inside the queue tab block, before the filter chips, add:

```tsx
{(() => {
  const scoped = selectedCampaignId
    ? prospects.filter((p) => p.campaignId === selectedCampaignId)
    : prospects;
  const ready = scoped.filter((p) => p.status === "ready").length;
  const pending = scoped.filter((p) => p.status === "pending").length;
  const connected = scoped.filter((p) => p.status === "connected").length;
  const optedOut = scoped.filter((p) => p.status === "opted_out").length;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
        🟢 {ready} ready
      </span>
      <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-800">
        🟡 {pending} pending
      </span>
      <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700">
        ✓ {connected} connected
      </span>
      <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-sm text-red-800">
        ⛔ {optedOut} opted out
      </span>
    </div>
  );
})()}
```

Adjust property names (`status`, `campaignId`) if the existing Prospect type uses different casing — grep for `ProspectRow` to confirm.

- [ ] **Step 2: Build check**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/linkedin/page.tsx
git commit -m "feat(linkedin): queue stats strip with status counts"
```

---

## Task 9: Status-aware primary action button per prospect row

**Files:**
- Modify: `src/app/(dashboard)/linkedin/page.tsx` (ProspectRow component)

- [ ] **Step 1: Add helper that picks the right action label**

Inside or above ProspectRow:

```ts
function primaryActionFor(prospect: Prospect): { label: string; onClick: () => void } | null {
  if (prospect.status === "opted_out") return null;
  if (prospect.status === "ready" && !prospect.lastMessage) {
    return { label: "Generate message", onClick: () => handleGenMsg(prospect) };
  }
  if (prospect.status === "ready" && prospect.lastMessage) {
    return { label: "Send & advance", onClick: () => handleSendAdvance(prospect) };
  }
  if (prospect.status === "pending") {
    return { label: "Mark connected", onClick: () => updateProsStatus(prospect.id, "connected") };
  }
  if (prospect.status === "connected") {
    return { label: "Advance to next step", onClick: () => handleSendAdvance(prospect) };
  }
  return null;
}
```

Adjust function names to match actual handlers in page.tsx (these were confirmed to exist in the prior summary).

- [ ] **Step 2: Add step indicator and primary button to row render**

Inside ProspectRow, add the middle column:

```tsx
<div className="flex flex-col items-center text-xs text-slate-600">
  <div>Step {(prospect.stepIndex ?? 0) + 1} of {totalSteps}</div>
  <div className="mt-1 h-1 w-20 rounded-full bg-slate-200">
    <div
      className="h-1 rounded-full bg-[#FF6B4A]"
      style={{ width: `${((prospect.stepIndex ?? 0) + 1) / Math.max(totalSteps, 1) * 100}%` }}
    />
  </div>
</div>
```

And the right column:

```tsx
{(() => {
  const action = primaryActionFor(prospect);
  if (!action) return <span className="text-xs text-slate-400">Read-only</span>;
  return (
    <button
      onClick={action.onClick}
      className="rounded-lg bg-[#FF6B4A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E85A49]"
    >
      {action.label}
    </button>
  );
})()}
```

`totalSteps` comes from `funnelSteps.length` in the parent — pass it as a prop.

- [ ] **Step 3: Build check**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/linkedin/page.tsx
git commit -m "feat(linkedin): status-aware primary action per prospect row"
```

---

## Task 10: "Next: View Analytics →" CTA + "Back to Queue" link

**Files:**
- Modify: `src/app/(dashboard)/linkedin/page.tsx`

- [ ] **Step 1: Add CTA at bottom of queue tab**

Just before queue tab closing div:

```tsx
<div className="mt-6 flex justify-end">
  <button
    onClick={() => setActiveTab("analytics")}
    className="rounded-lg bg-[#FF6B4A] px-6 py-3 text-sm font-semibold text-white shadow hover:bg-[#E85A49]"
  >
    Next: View Analytics →
  </button>
</div>
```

- [ ] **Step 2: Add "Back to Queue" at top of analytics tab**

At top of analytics tab block:

```tsx
<button
  onClick={() => setActiveTab("queue")}
  className="mb-4 text-sm text-[#0B1C3D] hover:underline"
>
  ← Back to Queue
</button>
```

- [ ] **Step 3: Build check**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/linkedin/page.tsx
git commit -m "feat(linkedin): analytics CTAs close the loop"
```

---

## Task 11: Global breadcrumb across Campaigns / Funnel / Queue

**Files:**
- Modify: `src/app/(dashboard)/linkedin/page.tsx`

- [ ] **Step 1: Add breadcrumb component inline**

Below the tab bar JSX, before the per-tab blocks:

```tsx
{activeTab !== "accounts" && activeTab !== "analytics" && (
  <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
    <button onClick={() => setActiveTab("accounts")} className="hover:text-[#0B1C3D]">
      Accounts
    </button>
    <span>›</span>
    <button
      onClick={() => setActiveTab("campaigns")}
      className={activeTab === "campaigns" ? "font-semibold text-[#FF6B4A]" : "hover:text-[#0B1C3D]"}
    >
      {campaigns.find((c) => c.id === selectedCampaignId)?.name ?? "Campaign"}
    </button>
    <span>›</span>
    <button
      onClick={() => setActiveTab("funnel")}
      className={activeTab === "funnel" ? "font-semibold text-[#FF6B4A]" : "hover:text-[#0B1C3D]"}
    >
      Funnel
    </button>
    <span>›</span>
    <button
      onClick={() => setActiveTab("queue")}
      className={activeTab === "queue" ? "font-semibold text-[#FF6B4A]" : "hover:text-[#0B1C3D]"}
    >
      Queue
    </button>
  </div>
)}
```

- [ ] **Step 2: Build check**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/linkedin/page.tsx
git commit -m "feat(linkedin): global breadcrumb across workflow tabs"
```

---

## Task 12: Live browser smoke test + deploy

**Files:** none (verification only)

- [ ] **Step 1: Run dev server**

Run: `npm run dev`
Visit: `http://localhost:3000/linkedin`

- [ ] **Step 2: Execute full guided flow**

Verify each step without tab-clicking:

1. On Accounts: click "Run Campaign" on K. Prabhu.
   - Expected: lands on Campaigns tab, banner shows "Running as K. Prabhu".
2. Click "+ New Campaign" (or it auto-opens if none exist).
   - Expected: form pre-filled with K. Prabhu's account binding.
3. Create campaign → click "Next: Build Funnel →".
   - Expected: lands on Funnel tab, shows "Funnel for: [name]".
4. Edit steps in timeline → click "Save & Next: Discover Prospects →".
   - Expected: saves funnel, runs discover, lands on Queue tab.
5. Queue shows stats strip + empty state (or rows).
6. Click "Next: View Analytics →".
   - Expected: Analytics tab with "← Back to Queue" link visible.

- [ ] **Step 3: Build and type-check**

Run: `npm run build && npx tsc --noEmit`
Expected: zero errors, `/linkedin` route in output.

- [ ] **Step 4: Push to production**

```bash
./infra/git/prod-deploy.sh
```
Or manually:
```bash
git push origin master
```

- [ ] **Step 5: Verify live**

Visit `https://creativenexusglobal.com/linkedin` in incognito after Hostinger rebuilds (~2 min). Repeat smoke-test steps 1–6.

---

## Self-Review Checklist

- **Spec coverage:**
  - §1 Accounts → Task 1 ✓
  - §2 Campaigns banner + picker + pre-fill → Tasks 2, 3, 4 ✓
  - §3 Funnel header + timeline + Save&Next → Tasks 5, 6, 7 ✓
  - §4 Queue stats + row redesign + CTA → Tasks 8, 9, 10 ✓
  - §5 Analytics Back link → Task 10 ✓
  - §6 Breadcrumb → Task 11 ✓
  - Styling tokens (coral `#FF6B4A`, navy `#0B1C3D`) applied throughout ✓
- **Placeholder scan:** clean — every step has real code or a real command.
- **Type consistency:** `activeAccountId`, `selectedCampaignId`, `activeTab` used consistently. Handler names (`handleGenMsg`, `handleSendAdvance`, `updateProsStatus`, `handleDiscover`, `saveFunnelToCampaign`) match prior summary — executor should grep to confirm exact casing and adjust if needed.
