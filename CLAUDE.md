# Creative Nexus Command Centre

AI-native agency operating system at creativenexusglobal.com. 10 modules, 36 agents, 13 workflows, 88 database tables.

## Tech Stack

- **Frontend:** Next.js 14 (App Router, RSC) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** FastAPI (Python) for AI agents + tRPC (TypeScript) for CRUD
- **Database:** Supabase PostgreSQL with RLS. All tables prefixed by module (sig_, gtm_, hr_, fin_, att_, pm_, slack_, ais_, nf_, core_)
- **Auth:** Supabase Auth + NextAuth.js. 6 roles: super_admin, manager, employee, account_manager, client_admin, client_viewer
- **AI:** Anthropic Claude (Managed Agents for strategy, Agent SDK for execution, Messages API for research)
- **Styling:** Apple-like minimal UI. Brand colors: navy `#0A1628`, coral `#FF6B5A`, background `#F0F4F8`

## Commands

```bash
# Install
npm install

# Dev
npm run dev          # Next.js on :3000
supabase start       # Local Supabase on :54321

# Lint & format
npm run lint
npm run format

# Type check
npx tsc --noEmit

# Test
npm run test         # Vitest
npm run test:e2e     # Playwright

# DB
supabase db push     # Push migrations
supabase db reset    # Reset + reseed
```

## Project Structure

```
/
├── CLAUDE.md              # This file
├── .mcp.json              # MCP server config (Semrush, Apify, Supabase)
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── supabase/
│   ├── migrations/        # SQL migrations (ordered by timestamp)
│   ├── seed.sql           # Dev seed data
│   └── config.toml
├── src/
│   ├── app/               # Next.js App Router pages
│   │   ├── (auth)/        # Login, signup
│   │   ├── (dashboard)/   # Authenticated layout with sidebar
│   │   │   ├── dashboard/ # Home dashboard
│   │   │   ├── signal/    # Signal Engine pages
│   │   │   ├── searchlens/# AI SearchLens pages
│   │   │   ├── gtm/       # GTM Engine pages
│   │   │   ├── nexus-flow/# Outreach ops pages
│   │   │   ├── social/    # Social Intelligence pages
│   │   │   ├── whatsapp/  # WhatsApp Sales Engine
│   │   │   ├── people/    # HRMS pages
│   │   │   ├── finance/   # Invoice & finance pages
│   │   │   ├── attendance/# Attendance pages
│   │   │   ├── projects/  # Project ops pages
│   │   │   ├── slack/     # Slack hub pages
│   │   │   └── executive/ # Executive dashboard
│   │   └── api/           # API routes
│   ├── components/
│   │   ├── ui/            # shadcn/ui components
│   │   ├── layout/        # Sidebar, header, shell
│   │   └── modules/       # Module-specific components
│   ├── lib/
│   │   ├── supabase/      # Client + server Supabase helpers
│   │   ├── auth/          # Auth utilities + RBAC
│   │   └── utils.ts
│   └── types/             # TypeScript types per module
├── agents/                # Python agent service (FastAPI)
│   ├── orchestrator/      # Workflow DAG runner
│   ├── agents/            # Individual agent system prompts
│   ├── quality/           # Quality layer passes
│   └── mcp/               # MCP client integrations
└── docs/
    ├── architecture.md    # Detailed system architecture
    ├── build-phases.md    # Phase-by-phase execution plan
    ├── agents.md          # All 36 agent specs (reference)
    └── api-registry.md    # All 43 API integrations (reference)
```

## Conventions

- Use named exports, not default exports (except Next.js pages)
- Server Components by default. Add `'use client'` only when needed
- All Supabase queries go through `src/lib/supabase/` helpers, never direct in components
- Use Zod for all input validation
- All API responses follow `{ data, error }` pattern
- Never hardcode colors — use CSS variables or Tailwind config
- All tables have `created_at`, `updated_at`, RLS enabled, and proper indexes
- Commit messages: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`

## Current Focus

<!-- Update this section when starting a new phase -->
**Phase 1: Foundation (Weeks 1–4)**
Building: Supabase schema, auth, Next.js shell with sidebar, design system, global search.
See `docs/build-phases.md` for detailed task breakdown.

## MCP Servers

Configured in `.mcp.json`. Available tools:
- **Supabase:** execute_sql, list_tables, apply_migration
- **Semrush:** keyword data, domain metrics, competitor analysis
- **Apify:** search-actors, call-actor, get-actor-output (14 scrapers)

## Architecture Decisions

- Sidebar is the backbone: 220px expanded, 60px collapsed. Client-facing modules visible to clients, internal modules hidden via RBAC
- All AI agent execution happens in Python FastAPI service, NOT in Next.js. Frontend only displays results
- Supabase RLS enforces multi-tenancy. Every query is scoped to org_id
- Quality layer runs between every agent: PII scan (NVIDIA GLiNER), brand safety (NemoGuard), voice compliance, hallucination check, consistency, polish
- WhatsApp agent (W13) is always-on via FastAPI webhook + Redis state store, not batch

## Don't

- Don't use `any` type in TypeScript
- Don't put business logic in components — use server actions or API routes
- Don't skip RLS policies on new tables
- Don't use `localStorage` for auth state — use Supabase session
- Don't install new UI libraries — shadcn/ui + Tailwind handles everything
- Don't create separate CSS files — use Tailwind classes or CSS variables
