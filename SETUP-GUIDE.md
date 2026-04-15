# How to Build Creative Nexus Command Centre with Claude Code
## Step-by-Step Setup Guide

---

## Step 0: Install Claude Code

### Option A: Terminal (recommended)
```bash
npm install -g @anthropic-ai/claude-code
```

### Option B: VS Code Extension
1. Open VS Code
2. Go to Extensions (Cmd+Shift+X)
3. Search "Claude Code"
4. Install the Anthropic extension
5. Open Command Palette (Cmd+Shift+P) → "Claude Code: Open in New Tab"

### Verify installation
```bash
claude --version
```

---

## Step 1: Create Your Project

```bash
# Create project directory
mkdir creative-nexus-command-centre
cd creative-nexus-command-centre

# Initialize git
git init
```

---

## Step 2: Copy These Files into Your Project Root

From the files I've created, copy these into your project:

```
creative-nexus-command-centre/
├── CLAUDE.md              ← Copy from outputs (Claude reads this every session)
├── .mcp.json              ← Copy from outputs (MCP server config)
└── docs/
    ├── build-phases.md    ← Copy from outputs (phase-by-phase prompts)
    ├── architecture.md    ← Create later (or paste from our conversation)
    ├── agents.md          ← Reference from the 10 specification documents
    └── api-registry.md    ← Reference from API Integration Master Plan
```

---

## Step 3: Set Up Environment Variables

Create a `.env.local` file (don't commit this):

```bash
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic (for AI agents)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Apify (for web scraping)
APIFY_API_TOKEN=your_apify_token

# NVIDIA NIM (for embeddings, OCR, PII)
NVIDIA_API_KEY=your_nvidia_nvapi_key

# Razorpay (for payments — Phase 5)
RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret
```

---

## Step 4: Start Claude Code and Begin Phase 1

Open your terminal in the project directory and start Claude Code:

```bash
cd creative-nexus-command-centre
claude
```

Claude Code will automatically read your `CLAUDE.md` file.

### Your first prompt (paste this into Claude Code):

```
Read CLAUDE.md and docs/build-phases.md. We're starting Phase 1: Foundation.

Task 1.1: Scaffold the Next.js 14 project.
- Create package.json with all dependencies
- Set up next.config.ts, tailwind.config.ts, tsconfig.json
- Create the full directory structure from CLAUDE.md
- Install shadcn/ui and add the base components
- Set up brand colors: navy #0A1628, coral #FF6B5A, bg #F0F4F8
- Create src/app/layout.tsx with global styles and theme provider
```

---

## Step 5: Build Feature by Feature

After the scaffold is done, work through Phase 1 tasks one at a time.
Each prompt is in `docs/build-phases.md` — copy and paste them into Claude Code.

### Recommended order for Phase 1:

```
Session 1: Project scaffold (Task 1.1)
Session 2: Supabase schema — core tables (Task 1.2)
Session 3: Auth + RBAC (Task 1.3)
Session 4: Dashboard shell + sidebar (Task 1.4)
Session 5: Design system components (Task 1.5)
Session 6: Global search (Task 1.6)
```

### Tips for each session:

1. **Start fresh** — Claude Code reads CLAUDE.md at session start
2. **One task per session** — don't try to build everything at once
3. **Test after each task** — run `npm run dev` and verify
4. **Update CLAUDE.md** — add any learnings or gotchas after each session
5. **Commit after each task** — `git add . && git commit -m "feat: add sidebar"`

---

## Step 6: Set Up Supabase

### Create Supabase Project
1. Go to supabase.com/dashboard
2. Create new project: "creative-nexus-command-centre"
3. Copy project URL and keys into .env.local

### Initialize Supabase CLI
```bash
supabase init
supabase link --project-ref your_project_ref
```

### Run migrations
After Claude Code creates migrations in `supabase/migrations/`:
```bash
supabase db push
```

---

## Step 7: Connect MCP Servers

The `.mcp.json` file configures 4 MCP servers. To activate them:

### Supabase MCP
```bash
# Already configured in .mcp.json
# Just set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
```

### Apify MCP
```bash
# Already configured in .mcp.json
# Set APIFY_API_TOKEN in .env.local
# Claude Code can now run: "Search Apify for an Instagram scraper"
```

### Semrush MCP
```bash
# Remote MCP server — requires Semrush account with API access
# Already configured as URL type in .mcp.json
```

### Verify MCP servers work
In Claude Code, type:
```
List all available MCP tools
```
You should see Supabase, Apify, and Semrush tools listed.

---

## Phase Progression Checklist

After completing each phase, update the "Current Focus" section in CLAUDE.md:

```markdown
## Current Focus
**Phase 2: Signal Engine MVP (Weeks 5–10)**
Building: Agent orchestrator, W7 onboarding, brand brief hub, deliverables library.
```

### Phase completion criteria:

| Phase | Done When |
|-------|-----------|
| 1. Foundation | Shell renders with sidebar. Auth works. Core tables exist. |
| 2. Signal MVP | W7 runs end-to-end. Brand brief displayed. Deliverables downloadable. |
| 3. Agency Centre | Internal ops screens render. W12 scrapes and analyses social data. |
| 4. GTM + SearchLens | ICP builder works. Lead lists generate. Nexus Flow tracks outreach. |
| 5. Internal Ops | HRMS, Finance (with GST), Attendance, Projects all functional. |
| 6. WhatsApp + Launch | W13 responds on WhatsApp. Executive dashboard shows revenue. Deployed. |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Claude Code doesn't read CLAUDE.md | Make sure it's in the project root, named exactly `CLAUDE.md` |
| MCP servers not showing | Check `.mcp.json` is valid JSON. Restart Claude Code. |
| Supabase connection fails | Verify `.env.local` has correct URL and keys |
| TypeScript errors | Run `npx tsc --noEmit` to see all errors. Fix in order. |
| shadcn/ui components missing | Run `npx shadcn@latest add [component-name]` |
| Agent service won't start | Check Python venv is active. Install: `pip install fastapi celery redis` |

---

## Quick Reference: All 10 Documents

These are your specification documents. Reference them when Claude Code needs context:

| # | Document | What It Contains |
|---|----------|-----------------|
| 1 | Product Plan | DareAISearch competitive analysis, AI SearchLens product spec |
| 2 | Build Plan | Phase-wise development, dual dashboards, tech stack decisions |
| 3 | Signal Integration | 21 Signal agents mapped to Command Centre, cross-module flows |
| 4 | Agent Architecture | Managed Agents vs Agent SDK vs Messages API decision |
| 5 | Agent Engineering Spec | All 21 original agents with 13 parameters each |
| 6 | Operational Playbook | 30 agents, GTM agents, post-build operations, pricing |
| 7 | Platform Architecture | 10 modules, complete sidebar, HRMS/Finance/Attendance/Projects/Slack specs |
| 8 | API Integration Plan | 12 NVIDIA + 14 Apify + Anthropic + Semrush mapped to all agents |
| 9 | Social Intelligence Engine | W12, agents A31–A33, content performance analysis |
| 10 | WhatsApp Sales Engine | W13, agents A34–A36, always-on inbound qualification |

When you need Claude Code to reference a specific spec, tell it:
```
Read docs/agents.md and find the spec for agent A14 (Competitor Research).
Use that spec to build the agent's system prompt.
```

---

## You're Ready

1. ✅ CLAUDE.md in project root
2. ✅ .mcp.json configured
3. ✅ docs/build-phases.md with all prompts
4. ✅ .env.local with API keys
5. ✅ Claude Code installed

Start Claude Code. Paste the Phase 1.1 prompt. Build.
