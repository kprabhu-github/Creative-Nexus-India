# LinkedIn Outreach — UX Flow & Step-by-Step Navigation

**Date:** 2026-04-20
**Owner:** Prabhu K
**Scope:** `src/app/(dashboard)/linkedin/page.tsx` (and associated components)

## Problem

The LinkedIn module has 5 tabs (Accounts, Campaigns, Build Funnel, Queue, Analytics), but each tab is an island. After adding an account, the user has no path to the next action. After building a funnel, nothing tells them to go discover prospects. New users stall because the sequence isn't visible.

## Goal

Make the LinkedIn module feel like a **guided workflow** while preserving tabs for power users. Every action should end with a clear "Next:" CTA that pre-fills state and jumps to the appropriate tab.

## Approach: Contextual CTAs (option B + smart defaults from option C)

Keep the 5-tab structure. Introduce two mechanisms:

1. **activeAccountId state** — global to the page. Set when user clicks "Run Campaign" on an account card. Cleared when user clicks "change" in the banner.
2. **"Next: X →" primary buttons** — placed at the bottom of each tab, using coral `#FF6B4A` to signal forward motion. Each Next button performs a save/transition atomically.

## Section-by-Section Spec

### 1. Accounts tab
- Rename account card's **"Use"** button to **"Run Campaign"**.
- On click:
  - `setActiveAccountId(account.id)`
  - `setActiveTab("campaigns")`
  - Scroll campaigns tab to top.
- No other changes to Accounts tab.

### 2. Campaigns tab
- **Sticky banner** (top of tab) shows when `activeAccountId` is set:
  ```
  Running as [account.name]  ·  change
  ```
  - "change" clears `activeAccountId`.
  - Banner uses navy background, coral "change" link.
- **Smart default rendering** (when `activeAccountId` is set):
  - Compute `accountCampaigns = campaigns.filter(c => c.account_id === activeAccountId)`.
  - If `accountCampaigns.length === 0`: auto-open the New Campaign form, pre-filled with `account_id`.
  - If `accountCampaigns.length > 0`: show a **two-card picker**:
    - `+ New Campaign` (coral, full border) — opens New Campaign form.
    - `▶ Continue [most recent campaign name]` (navy) — sets `selectedCampaignId` and expands editor.
    - Below: compact list of older campaigns for that account, single-click to select.
- **After a campaign is created or selected**, show bottom CTA:
  ```
  [Next: Build Funnel →]
  ```
  On click: `setActiveTab("funnel")`.

### 3. Build Funnel tab
- Header shows current context: `Funnel for: [campaign name]`. If no campaign selected, show empty state with CTA "Select or create a campaign first →".
- **Visual timeline** replacing raw rows:
  - Horizontal scroll on mobile, vertical stack on desktop.
  - Each step = card with icon matching action (handshake for `connect`, envelope for `message`, speech bubble for `comment`, etc.) + day offset + editable template.
  - Gap between cards has a `+` button to insert a step.
  - Step cards remain draggable-free for now (drag-drop is out of scope).
- Bottom CTA:
  ```
  [Save & Next: Discover Prospects →]
  ```
  On click:
  - Save funnel to campaign (existing `saveFunnelToCampaign`).
  - Call Discover endpoint (existing `handleDiscover`).
  - `setActiveTab("queue")`.

### 4. Queue tab
- **Stats strip** at top (above filter chips):
  ```
  🟢 12 ready   🟡 5 pending   ✓ 3 connected   ⛔ 2 opted out
  ```
  - Counts derived from `prospects` filtered by `activeAccountId`/`selectedCampaignId`.
  - Clicking a chip filters the list to that status.
- **Prospect row redesign:**
  - Left: avatar + name + headline (existing).
  - Middle: step indicator `Step 2 of 6` with mini progress bar.
  - Right: **single primary action button** that changes based on status:
    - `ready` + no message → `Generate message`
    - `ready` + has message → `Send & advance`
    - `pending response` → `Mark connected` / `Mark replied`
    - `connected` → `Advance to next step`
    - `opted_out` → read-only, no button.
- Empty state (already implemented) stays.
- Bottom CTA:
  ```
  [Next: View Analytics →]
  ```

### 5. Analytics tab
- Add header link: `← Back to Queue` (navy, text-only).
- No other changes.

### 6. Global breadcrumb (all tabs except Accounts)
Top of page under the tab bar:
```
Accounts  ›  [Campaign Name]  ›  Funnel  ›  Queue
```
- Each segment clickable → switches to that tab.
- Segments after current tab are grey; current tab is coral.

## Non-Goals

- No wizard overlay / onboarding modal.
- No drag-drop step reordering.
- No new data model fields or migrations.
- No A/B test infrastructure.
- No client portal view — agency-only per existing CLAUDE.md.

## Data / API Changes

**None.** All logic is client-side state in `page.tsx`. Existing endpoints (`/api/linkedin/campaigns`, `/advance`, `/discover`, `/import`, `/messages/draft`) unchanged.

## State Additions (inside `page.tsx`)

```ts
const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
// selectedCampaignId already exists
// activeTab already exists
```

## Styling

- Primary CTA button: `bg-[#FF6B4A] text-white` (coral).
- Secondary CTA: `bg-[#0B1C3D] text-white` (navy).
- Tertiary: `border border-[#0B1C3D] text-[#0B1C3D]`.
- Stats chip: `bg-white border rounded-full px-3 py-1 text-sm`.
- Banner: `bg-[#0B1C3D] text-white px-4 py-2 rounded-lg`.

## Success Criteria

1. A new user who lands on `/linkedin` with no campaigns can complete: add account → create campaign → build funnel → discover prospects → send first message, clicking only "Next" buttons (no tab jumping).
2. Returning user can still click any tab directly (no forced gating).
3. "Running as [name]" banner visible on every relevant tab when account is active.
4. All Next CTAs are same coral colour and right-aligned for scan consistency.

## Out of Scope / Future Work

- Onboarding checklist on dashboard home.
- Keyboard shortcuts for Next CTAs.
- Drag-drop funnel reordering.
- Mobile-optimised timeline (current design targets desktop).
