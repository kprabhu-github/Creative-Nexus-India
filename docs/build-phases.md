# Build Phases — Creative Nexus Command Centre

## Phase 1: Foundation (Weeks 1–4)

### 1.1 Project Scaffold
```
Prompt for Claude Code:
"Scaffold a Next.js 14 project with App Router, TypeScript, Tailwind CSS, and shadcn/ui. 
Set up the project structure matching CLAUDE.md. Install dependencies: 
@supabase/supabase-js, @supabase/ssr, next-themes, lucide-react, zod, 
@tanstack/react-query. Configure tailwind.config.ts with brand colors: 
navy #0A1628, coral #FF6B5A, background #F0F4F8."
```

### 1.2 Supabase Schema
```
Prompt for Claude Code:
"Create the Supabase migration for core tables. Read docs/architecture.md for the 
full schema. Start with these tables:
- core_users (extends Supabase auth.users)
- core_organisations (multi-tenant)  
- core_roles + core_permissions (RBAC)
- core_audit_log
- core_notifications
- core_settings
Add RLS policies, indexes, and updated_at triggers."
```

### 1.3 Auth + RBAC
```
Prompt for Claude Code:
"Implement Supabase Auth with NextAuth.js adapter. Create:
- src/lib/auth/session.ts (get session server-side)
- src/lib/auth/rbac.ts (role check middleware)
- src/app/(auth)/login/page.tsx (email + Google OAuth)
- src/app/(auth)/signup/page.tsx (org creation flow)
6 roles: super_admin, manager, employee, account_manager, client_admin, client_viewer.
Use Supabase RLS to enforce org_id scoping."
```

### 1.4 Dashboard Shell + Sidebar
```
Prompt for Claude Code:
"Build the authenticated dashboard layout with collapsible sidebar. Read CLAUDE.md 
for the complete sidebar navigation map. Create:
- src/app/(dashboard)/layout.tsx (sidebar + header + main area)
- src/components/layout/sidebar.tsx (collapsible, 220px/60px, grouped sections)
- src/components/layout/header.tsx (search, notifications, user menu)

Sidebar groups:
CLIENT-FACING: Dashboard, Signal Engine, Social Intelligence, AI SearchLens, 
GTM Engine, Nexus Flow, Invoices, Projects, Messages, Settings

INTERNAL-ONLY (hidden from clients): PeopleHub, Finance Hub, Attendance, 
Project Ops, Slack Hub, AI Operations, Executive

Use lucide-react icons. Active state: filled bg with white text.
Collapsible to icon-only mode. Persist state in localStorage."
```

### 1.5 Design System
```
Prompt for Claude Code:
"Set up the shadcn/ui design system. Add these components:
button, input, select, textarea, badge, card, table, tabs, dialog, 
dropdown-menu, sheet, separator, skeleton, tooltip, avatar, 
command (for search), toast.

Create a src/components/ui/metric-card.tsx component for dashboard stats.
Create a src/components/ui/status-badge.tsx for lead/campaign/task statuses.
Create a src/components/ui/empty-state.tsx for empty pages.

All using brand colors from tailwind.config.ts. Apple-like minimal aesthetic."
```

### 1.6 Global Search
```
Prompt for Claude Code:
"Implement Cmd+K global search using shadcn/ui Command component.
Searches across: clients, leads, projects, invoices, deliverables.
Uses Supabase full-text search initially.
Later: NVIDIA Nemotron Embed for semantic search.
Create src/components/layout/global-search.tsx."
```

---

## Phase 2: Signal Engine MVP (Weeks 5–10)

### 2.1 Signal Database Tables
```
"Create Supabase migration for Signal module tables:
sig_brand_briefs, sig_voice_rules, sig_brand_facts, sig_banned_phrases,
sig_workflows, sig_runs, sig_agent_runs, sig_deliverables, sig_feedback,
sig_prompt_versions, sig_templates, sig_onboarding.
Include JSONB columns for flexible agent output storage.
Add RLS: clients see their org's data only."
```

### 2.2 Agent Orchestrator (Python)
```
"Set up the Python agent service in /agents directory:
- FastAPI app with Celery + Redis for async execution
- Workflow DAG runner that chains agents in sequence
- Agent base class with: run(), validate_input(), validate_output()
- Quality layer middleware that runs between every agent
- SSE endpoint for real-time progress streaming to dashboard
- Error handling with retry logic (max 2 retries per agent)

Start with W7 (Client Onboarding) as the first workflow:
A01 (Brand Intel) → A02 (Audience Insight) → A03 (Brand Strategist)"
```

### 2.3 Signal Dashboard Pages
```
"Build Signal Engine dashboard pages:
- signal/page.tsx — Signal Home (recent runs, quick actions, status)
- signal/workflows/page.tsx — Run Workflow (select W1–W8, configure, launch)
- signal/brand-brief/page.tsx — Brand Brief Hub (view, edit, approve)
- signal/deliverables/page.tsx — Deliverables Library (grid, filter, download)
- signal/approvals/page.tsx — Approval Queue (pending items, inline review)
- signal/feedback/page.tsx — Feedback (submit corrections per deliverable)

All pages use server components with Supabase queries.
SSE connection for live workflow progress."
```

---

## Phase 3: Agency Centre + Social Intel (Weeks 11–16)

### 3.1 Internal Operations Pages
```
"Build agency-internal pages (hidden from clients via RBAC):
- ops/page.tsx — Operations Kanban (all runs across all clients)
- ops/agents/page.tsx — Agent Monitor (live execution, error rates)
- ops/quality/page.tsx — Quality Dashboard (voice scores, hallucination rates)
- ops/prompts/page.tsx — Prompt Lab (edit system prompts, A/B test)
- ops/costs/page.tsx — Cost Control (API spend per client, per agent)
- ops/health/page.tsx — Client Health (stale briefs, inactive clients)"
```

### 3.2 Social Intelligence (W12)
```
"Build W12 Social Intelligence workflow and pages:
- Create sig_social_scrapes, sig_social_posts, sig_social_analyses tables
- Build A31 agent: connects to Apify MCP, scrapes Instagram + Twitter
- Build A32 agent: analyses scraped data, produces 5-section report
- Build A33 agent: generates HTML dashboard file
- Build social/page.tsx — Social Intelligence Home
- Build social/[runId]/page.tsx — Analysis Report (5 tabs)"
```

---

## Phase 4: GTM + SearchLens + Nexus Flow (Weeks 17–22)

### 4.1 GTM Engine
```
"Build GTM Engine module:
- Tables: gtm_icps, gtm_leads, gtm_campaigns, gtm_sequences, etc.
- Pages: gtm/page.tsx, gtm/icp/page.tsx, gtm/leads/page.tsx, 
  gtm/campaigns/page.tsx, gtm/scoring/page.tsx
- Agents A22–A30 system prompts and orchestration"
```

### 4.2 AI SearchLens
```
"Build AI SearchLens module:
- Tables: ais_prompts, ais_visibility_scores, ais_mentions, ais_competitors
- Pages: searchlens/page.tsx (visibility overview), 
  searchlens/platforms/page.tsx, searchlens/competitors/page.tsx
- Daily prompt monitoring engine (Python cron)"
```

### 4.3 Nexus Flow (Outreach Ops)
```
"Build Nexus Flow outreach module:
- Tables: nf_leads, nf_campaigns, nf_sequence_steps, nf_campaign_leads, 
  nf_messages, nf_ai_generations
- Pages: nexus-flow/page.tsx (dashboard), leads, campaigns, 
  ai-generator, inbox
- Connect AI generator to Claude API for message generation"
```

---

## Phase 5: Internal Ops Modules (Weeks 23–28)

### 5.1 PeopleHub (HRMS)
```
"Build HRMS module with 8 screens:
- Tables: hr_employees, hr_departments, hr_leaves, hr_payroll, etc.
- Pages: people/directory, org-chart, leaves, payroll, onboarding, 
  exits, documents, policies"
```

### 5.2 Finance Hub
```
"Build Finance module:
- Tables: fin_invoices, fin_line_items, fin_estimates, fin_expenses, etc.
- GST auto-calculation (CGST/SGST/IGST based on client state)
- Razorpay integration for payment collection
- Pages: finance/invoices, create, estimates, expenses, revenue, gst, ledgers"
```

### 5.3 Attendance + Project Ops + Slack Hub
```
"Build remaining internal modules:
- Attendance: daily log, check-in/out, WFH requests, monthly report
- Project Ops: kanban, gantt, time tracking, resource allocation
- Slack Hub: channel management, bot commands, notification rules"
```

---

## Phase 6: WhatsApp + Polish + Launch (Weeks 29–32)

### 6.1 WhatsApp Sales Engine (W13)
```
"Build always-on WhatsApp agent:
- FastAPI webhook for incoming messages
- Redis conversation state management
- A34 agent with persistent Managed Agents session
- A35 lead qualifier + A36 meeting scheduler
- WATI.io integration for WhatsApp Business API
- Tables: sig_wa_conversations, sig_wa_leads, sig_meetings, sig_wa_templates"
```

### 6.2 Executive Dashboard
```
"Build leadership dashboard:
- Revenue (MRR, ARR, growth)
- Client metrics (LTV, CAC, churn)
- Team performance (utilisation, quality scores)
- Module-level KPIs
- Recharts visualisations"
```

### 6.3 Production Deploy
```
"Prepare for production:
- Vercel deployment config
- Railway for Python agent service
- Supabase production project
- DNS: app.creativenexusglobal.com
- SSL, CDN (Cloudflare)
- Sentry error tracking
- PostHog analytics
- Uptime monitoring"
```
