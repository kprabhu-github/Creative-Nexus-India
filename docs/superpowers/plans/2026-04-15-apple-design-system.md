# Apple Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Creative Nexus Command Centre UI to macOS Sonoma design language with Inter font, `#D90A2C` accent, compact density, and light/dark mode.

**Architecture:** Pure visual redesign — no routing, auth, or data layer changes. CSS variables drive the entire theme. `next-themes` handles light/dark toggling. All existing component APIs preserved; only styling internals change.

**Tech Stack:** Next.js 14, Tailwind CSS 3.4, shadcn/ui (base-nova), @base-ui/react, next-themes, @fontsource-variable/inter, lucide-react

**Spec:** `docs/superpowers/specs/2026-04-15-apple-design-system-design.md`
**Visual reference:** `.superpowers/brainstorm/40316-1776266754/content/05-full-design.html`

---

## File Structure

### Modified files
- `package.json` — add `@fontsource-variable/inter`
- `tailwind.config.ts` — Apple color system, Inter font family, border-radius tokens
- `src/app/globals.css` — light/dark CSS variables per spec
- `src/app/layout.tsx` — Inter font, ThemeProvider wrapper
- `src/app/(dashboard)/layout.tsx` — remove grid bg, update container
- `src/app/(dashboard)/dashboard/page.tsx` — compact metrics, grouped lists, progress bars
- `src/app/(auth)/layout.tsx` — Apple-clean auth background
- `src/app/(auth)/login/page.tsx` — Apple card styling
- `src/app/(auth)/signup/page.tsx` — Apple card styling
- `src/components/layout/sidebar.tsx` — Finder/Mail rewrite
- `src/components/layout/header.tsx` — 48px, blur, simplified
- `src/components/layout/global-search.tsx` — Apple Spotlight style
- `src/components/ui/button.tsx` — Apple button variants
- `src/components/ui/card.tsx` — no shadows, secondary bg
- `src/components/ui/input.tsx` — Apple input style
- `src/components/ui/badge.tsx` — pill with Apple colors
- `src/components/ui/metric-card.tsx` — compact spec rewrite
- `src/components/ui/status-badge.tsx` — Apple system colors
- `src/components/ui/empty-state.tsx` — minimal, no dashed border
- `src/components/ui/page-header.tsx` — compact title sizing
- `src/components/ui/skeleton.tsx` — secondary bg pulse

### New files
- `src/components/ui/segmented-control.tsx` — Apple segmented toggle
- `src/components/ui/progress-bar.tsx` — 4px track + fill
- `src/components/ui/theme-toggle.tsx` — light/dark/system switcher

---

## Task 1: Install Inter Font + Foundation Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @fontsource-variable/inter**

```bash
cd "/Users/New Mac files/cnx ai plans 2026/CNX Agency Command Centre 2026"
npm install @fontsource-variable/inter
```

- [ ] **Step 2: Verify installation**

```bash
ls node_modules/@fontsource-variable/inter/index.css
```

Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add Inter variable font for Apple design system"
```

---

## Task 2: Rewrite CSS Variables + Tailwind Config

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Replace globals.css with Apple color system**

Write `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .animation-delay-2000 {
    animation-delay: 2s;
  }
  .animation-delay-4000 {
    animation-delay: 4s;
  }
}

@layer base {
  :root {
    --background: 0 0% 100%;
    --background-secondary: 240 5% 96%;
    --foreground: 240 6% 10%;
    --foreground-secondary: 240 4% 26%;
    --foreground-tertiary: 240 2% 54%;

    --card: 0 0% 100%;
    --card-foreground: 240 6% 10%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 6% 10%;

    --primary: 240 6% 10%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 5% 96%;
    --secondary-foreground: 240 6% 10%;
    --muted: 240 5% 96%;
    --muted-foreground: 240 2% 54%;
    --accent: 351 91% 45%;
    --accent-foreground: 0 0% 100%;
    --destructive: 4 90% 58%;
    --destructive-foreground: 0 0% 100%;
    --success: 142 71% 45%;
    --warning: 32 100% 50%;

    --border: 0 0% 0% / 0.08;
    --input: 0 0% 0% / 0.08;
    --ring: 351 91% 45%;
    --divider: 240 6% 93%;
    --surface-hover: 0 0% 0% / 0.04;
    --surface-active: 0 0% 0% / 0.06;
    --sidebar-bg: 240 5% 96% / 0.92;

    --radius: 0.5rem;
  }

  .dark {
    --background: 240 6% 12%;
    --background-secondary: 0 0% 100% / 0.05;
    --foreground: 0 0% 100% / 0.95;
    --foreground-secondary: 0 0% 100% / 0.55;
    --foreground-tertiary: 0 0% 100% / 0.4;

    --card: 240 4% 16%;
    --card-foreground: 0 0% 100% / 0.95;
    --popover: 240 4% 16%;
    --popover-foreground: 0 0% 100% / 0.95;

    --primary: 3 100% 62%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 6% 18%;
    --secondary-foreground: 0 0% 100% / 0.95;
    --muted: 240 6% 18%;
    --muted-foreground: 0 0% 100% / 0.4;
    --accent: 3 100% 62%;
    --accent-foreground: 0 0% 100%;
    --destructive: 3 100% 62%;
    --destructive-foreground: 0 0% 100%;
    --success: 142 69% 55%;
    --warning: 33 100% 52%;

    --border: 0 0% 100% / 0.06;
    --input: 0 0% 100% / 0.06;
    --ring: 3 100% 62%;
    --divider: 0 0% 100% / 0.06;
    --surface-hover: 0 0% 100% / 0.06;
    --surface-active: 0 0% 100% / 0.08;
    --sidebar-bg: 0 0% 12% / 0.92;

    --radius: 0.5rem;
  }

  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 2: Replace tailwind.config.ts with Apple tokens**

Write `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter Variable'", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        "background-secondary": "hsl(var(--background-secondary))",
        foreground: "hsl(var(--foreground))",
        "foreground-secondary": "hsl(var(--foreground-secondary))",
        "foreground-tertiary": "hsl(var(--foreground-tertiary))",
        divider: "hsl(var(--divider))",
        "surface-hover": "hsl(var(--surface-hover))",
        "surface-active": "hsl(var(--surface-active))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
      },
      animation: {
        blob: "blob 7s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

- [ ] **Step 3: Verify build compiles**

```bash
cd "/Users/New Mac files/cnx ai plans 2026/CNX Agency Command Centre 2026"
npx tsc --noEmit && echo "OK"
```

Expected: OK

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "feat: Apple color system — light/dark CSS variables + Tailwind tokens"
```

---

## Task 3: Root Layout — Inter Font + ThemeProvider

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Rewrite layout.tsx**

Write `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Creative Nexus Command Centre",
  description: "AI-native agency operating system by Creative Nexus Global",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds (✓ Generating static pages)

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: Inter font + ThemeProvider for light/dark mode"
```

---

## Task 4: Dashboard Layout Shell

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Rewrite dashboard layout — remove grid pattern, clean background**

Write `src/app/(dashboard)/layout.tsx`:

```tsx
import { ReactNode } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="w-full p-5 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx"
git commit -m "feat: clean dashboard layout — Apple white bg, no grid pattern"
```

---

## Task 5: Sidebar — Finder/Mail Pattern

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Full rewrite — Finder/Mail sidebar**

Write `src/components/layout/sidebar.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Activity, Share2, Search, BarChart,
  Mail, FileText, Briefcase, MessageSquare, Settings,
  Users, DollarSign, Clock, ListChecks, Cpu, TrendingUp,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const clientNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Signal Engine", href: "/signal", icon: Activity },
  { name: "Social Intel", href: "/social", icon: Share2 },
  { name: "AI SearchLens", href: "/searchlens", icon: Search },
  { name: "GTM Engine", href: "/gtm", icon: BarChart },
  { name: "Nexus Flow", href: "/nexus-flow", icon: Mail },
  { name: "Invoices", href: "/finance/invoices", icon: FileText },
  { name: "Projects", href: "/projects", icon: Briefcase },
  { name: "Messages", href: "/messages", icon: MessageSquare },
  { name: "Settings", href: "/settings", icon: Settings },
];

const internalNav = [
  { name: "PeopleHub", href: "/people", icon: Users },
  { name: "Finance", href: "/finance", icon: DollarSign },
  { name: "Attendance", href: "/attendance", icon: Clock },
  { name: "Project Ops", href: "/ops/projects", icon: ListChecks },
  { name: "Slack Hub", href: "/slack", icon: MessageSquare },
  { name: "AI Ops", href: "/ops", icon: Cpu },
  { name: "Executive", href: "/executive", icon: TrendingUp },
];

const isInternalUser = true;

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) setCollapsed(JSON.parse(saved));
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(next));
  };

  const renderLinks = (links: typeof clientNav) =>
    links.map((link) => {
      const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
      return (
        <Link
          key={link.name}
          href={link.href}
          className={cn(
            "flex items-center gap-2 mx-2 px-2 py-[5px] rounded-md transition-colors",
            active
              ? "bg-surface-active text-foreground font-medium"
              : "text-foreground-secondary hover:bg-surface-hover"
          )}
        >
          <link.icon
            className={cn(
              "w-4 h-4 shrink-0",
              active ? "text-foreground" : "text-foreground-tertiary"
            )}
            strokeWidth={1.8}
          />
          {!collapsed && (
            <span className="text-[13px] truncate">{link.name}</span>
          )}
        </Link>
      );
    });

  return (
    <aside
      className={cn(
        "h-screen flex flex-col transition-all duration-200 relative shrink-0",
        "bg-[hsl(var(--sidebar-bg))] backdrop-blur-xl border-r border-border",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3.5 h-12 shrink-0">
        <div className="w-7 h-7 rounded-[7px] bg-foreground flex items-center justify-center shrink-0">
          <span className="text-background font-bold text-[11px]">CX</span>
        </div>
        {!collapsed && (
          <span className="text-[13px] font-semibold text-foreground tracking-tight truncate">
            Command Centre
          </span>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-3 top-14 bg-background border border-border rounded-full p-0.5 text-foreground-tertiary hover:text-foreground transition-colors z-10"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className={cn("px-3 mb-1", collapsed && "hidden")}>
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider">
            Client-Facing
          </span>
        </div>
        <div className="space-y-px">{renderLinks(clientNav)}</div>

        {isInternalUser && (
          <>
            <div className={cn("px-3 mt-5 mb-1", collapsed && "hidden")}>
              <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider">
                Internal
              </span>
            </div>
            {collapsed && <div className="h-3" />}
            <div className="space-y-px">{renderLinks(internalNav)}</div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className={cn(
        "px-3.5 py-3 text-[11px] text-foreground-tertiary border-t border-border",
        collapsed && "text-center px-0"
      )}>
        {collapsed ? "CX" : "Creative Nexus Global"}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: Finder/Mail sidebar — monochrome icons, subtle active states"
```

---

## Task 6: Header — Compact + Blur

**Files:**
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Rewrite header — 48px, blur, simplified**

Write `src/components/layout/header.tsx`:

```tsx
"use client";

import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "./global-search";

export default function Header() {
  return (
    <header className="h-12 flex items-center justify-between px-5 bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-10">
      <div className="flex-1 max-w-md">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" className="relative text-foreground-tertiary hover:text-foreground">
          <Bell className="w-4 h-4" strokeWidth={1.8} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-accent rounded-full" />
        </Button>
        <div className="h-4 w-px bg-border" />
        <Button variant="ghost" className="gap-2 text-foreground-secondary hover:text-foreground h-8 px-2">
          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
            <span className="text-[10px] font-semibold text-white">AM</span>
          </div>
          <span className="text-[13px] font-medium hidden md:block">Alex Mercer</span>
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat: compact 48px header with blur backdrop"
```

---

## Task 7: Global Search — Apple Spotlight Style

**Files:**
- Modify: `src/components/layout/global-search.tsx`

- [ ] **Step 1: Restyle global search**

Write `src/components/layout/global-search.tsx`:

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Users, FileText, Search, CreditCard, Activity, Briefcase } from "lucide-react";

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[13px] text-foreground-tertiary bg-surface-hover rounded-lg transition-colors hover:bg-surface-active"
      >
        <Search className="w-3.5 h-3.5" strokeWidth={2} />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="ml-auto text-[10px] font-medium text-foreground-tertiary bg-background border border-border rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search clients, leads, projects..." />
        <CommandList>
          <CommandEmpty className="py-10 text-center text-[13px] text-foreground-tertiary">
            No results found.
          </CommandEmpty>
          <CommandGroup heading="Clients & Leads">
            <CommandItem onSelect={() => runCommand(() => router.push("/people"))}>
              <Users className="mr-2 h-4 w-4 text-foreground-tertiary" strokeWidth={1.8} />
              People Directory
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/gtm/leads"))}>
              <Briefcase className="mr-2 h-4 w-4 text-foreground-tertiary" strokeWidth={1.8} />
              Leads Management
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Operations">
            <CommandItem onSelect={() => runCommand(() => router.push("/finance/invoices"))}>
              <CreditCard className="mr-2 h-4 w-4 text-foreground-tertiary" strokeWidth={1.8} />
              Invoices
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/signal"))}>
              <Activity className="mr-2 h-4 w-4 text-foreground-tertiary" strokeWidth={1.8} />
              Signal Runs
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/executive"))}>
              <FileText className="mr-2 h-4 w-4 text-foreground-tertiary" strokeWidth={1.8} />
              Executive Reports
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/global-search.tsx
git commit -m "feat: Apple Spotlight-style global search"
```

---

## Task 8: New Components — Segmented Control, Progress Bar, Theme Toggle

**Files:**
- Create: `src/components/ui/segmented-control.tsx`
- Create: `src/components/ui/progress-bar.tsx`
- Create: `src/components/ui/theme-toggle.tsx`

- [ ] **Step 1: Create segmented control**

Write `src/components/ui/segmented-control.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";

interface SegmentedControlProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  return (
    <div className={cn("flex gap-px bg-divider rounded-[7px] p-px", className)}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-all",
            value === option
              ? "bg-background text-foreground shadow-sm"
              : "text-foreground-tertiary hover:text-foreground-secondary"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create progress bar**

Write `src/components/ui/progress-bar.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: "accent" | "success" | "warning";
  className?: string;
}

export function ProgressBar({ value, max = 100, color = "accent", className }: ProgressBarProps) {
  const percentage = Math.min(100, (value / max) * 100);
  const colorMap = {
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
  };

  return (
    <div className={cn("h-1 bg-divider rounded-full overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all", colorMap[color])}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create theme toggle**

Write `src/components/ui/theme-toggle.tsx`:

```tsx
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const options = [
    { value: "light", icon: Sun },
    { value: "dark", icon: Moon },
    { value: "system", icon: Monitor },
  ] as const;

  return (
    <div className={cn("flex gap-px bg-divider rounded-[7px] p-px", className)}>
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            "p-1.5 rounded-md transition-all",
            theme === value
              ? "bg-background text-foreground shadow-sm"
              : "text-foreground-tertiary hover:text-foreground-secondary"
          )}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit && echo "OK"
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/segmented-control.tsx src/components/ui/progress-bar.tsx src/components/ui/theme-toggle.tsx
git commit -m "feat: Apple components — segmented control, progress bar, theme toggle"
```

---

## Task 9: Restyle Core Custom Components

**Files:**
- Modify: `src/components/ui/metric-card.tsx`
- Modify: `src/components/ui/status-badge.tsx`
- Modify: `src/components/ui/empty-state.tsx`
- Modify: `src/components/ui/page-header.tsx`
- Modify: `src/components/ui/skeleton.tsx`

- [ ] **Step 1: Rewrite metric-card.tsx — compact, no shadows**

Write `src/components/ui/metric-card.tsx`:

```tsx
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  icon?: LucideIcon;
  description?: string;
  trend?: string;
  className?: string;
}

export function MetricCard({ title, value, icon: Icon, description, trend, className }: MetricCardProps) {
  return (
    <div className={cn("bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">{title}</span>
        {Icon && <Icon className="w-4 h-4 text-foreground-tertiary" strokeWidth={1.8} />}
      </div>
      <div className="text-2xl font-bold text-foreground tracking-tight mt-0.5">{value}</div>
      {(description || trend) && (
        <div className="text-xs font-medium mt-0.5">
          {trend && <span className="text-success">{trend}</span>}
          {description && !trend && <span className="text-foreground-tertiary">{description}</span>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite status-badge.tsx — Apple system colors**

Write `src/components/ui/status-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";

type StatusType = "success" | "warning" | "error" | "info" | "neutral";

const styles: Record<StatusType, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-destructive/10 text-destructive",
  info: "bg-accent/10 text-accent",
  neutral: "bg-foreground-tertiary/10 text-foreground-tertiary",
};

export function StatusBadge({
  type,
  children,
  className,
}: {
  type: StatusType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", styles[type], className)}>
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Rewrite empty-state.tsx — no dashed border**

Write `src/components/ui/empty-state.tsx`:

```tsx
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="w-12 h-12 bg-background-secondary rounded-2xl flex items-center justify-center mb-4 dark:border dark:border-border">
        <Icon className="w-6 h-6 text-foreground-tertiary" strokeWidth={1.5} />
      </div>
      <h3 className="text-[15px] font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-[13px] text-foreground-tertiary max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite page-header.tsx — compact title**

Write `src/components/ui/page-header.tsx`:

```tsx
import { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h1 className="text-[22px] font-bold text-foreground tracking-tight">{title}</h1>
        {description && (
          <p className="text-[13px] text-foreground-tertiary mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Restyle skeleton.tsx**

Write `src/components/ui/skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-background-secondary", className)}
      {...props}
    />
  );
}

export { Skeleton };
```

- [ ] **Step 6: Verify build**

```bash
npx tsc --noEmit && echo "OK"
```

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/metric-card.tsx src/components/ui/status-badge.tsx src/components/ui/empty-state.tsx src/components/ui/page-header.tsx src/components/ui/skeleton.tsx
git commit -m "feat: Apple-styled metric cards, badges, empty states, page headers"
```

---

## Task 10: Dashboard Page — Compact Layout

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Rebuild dashboard with compact metrics, grouped list, progress bars**

Write `src/app/(dashboard)/dashboard/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Activity, DollarSign, Users, AlertCircle } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ProgressBar } from "@/components/ui/progress-bar";

export default function DashboardHome() {
  const [period, setPeriod] = useState("Day");

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">Overview</h1>
          <p className="text-[13px] text-foreground-tertiary mt-0.5">Your agency at a glance</p>
        </div>
        <SegmentedControl
          options={["Day", "Week", "Month"]}
          value={period}
          onChange={setPeriod}
        />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard title="Revenue" value="$45,231" icon={DollarSign} trend="+20.1%" />
        <MetricCard title="Active Clients" value="124" icon={Users} trend="+4 this week" />
        <MetricCard title="Agent Uptime" value="99.9%" icon={Activity} description="13 agents" />
      </div>

      {/* Recent Activity */}
      <div className="flex items-center justify-between mt-5">
        <span className="text-[13px] font-semibold text-foreground">Recent Activity</span>
        <button className="text-xs font-medium text-accent hover:underline">View All</button>
      </div>
      <div className="mt-2 bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {[
          { title: "Strategy Gen W1", desc: "Competitor analysis completed", time: "Now", alert: false },
          { title: "Brand Brief — Acme Co", desc: "Awaiting client approval", time: "2m", alert: false },
          { title: "Quality Alert — Voice Drift", desc: "Needs attention", time: "5m", alert: true },
        ].map((item, i, arr) => (
          <div key={i}>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-background dark:bg-background/40">
              <div className="w-7 h-7 rounded-full bg-background-secondary flex items-center justify-center shrink-0 dark:bg-foreground-tertiary/10">
                {item.alert ? (
                  <AlertCircle className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
                ) : (
                  <Activity className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">{item.title}</div>
                <div className={`text-xs ${item.alert ? "text-accent" : "text-foreground-tertiary"}`}>
                  {item.desc}
                </div>
              </div>
              <span className="text-xs text-foreground-tertiary shrink-0">{item.time}</span>
            </div>
            {i < arr.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>

      {/* Progress row */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Workflows Today</div>
          <div className="text-xl font-bold text-foreground tracking-tight mt-0.5">
            8 <span className="text-[13px] font-normal text-foreground-tertiary">/ 12 target</span>
          </div>
          <ProgressBar value={8} max={12} color="accent" className="mt-2" />
        </div>
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Quality Score</div>
          <div className="text-xl font-bold text-foreground tracking-tight mt-0.5">
            94% <span className="text-[13px] font-normal text-success">▲ 2.1%</span>
          </div>
          <ProgressBar value={94} color="success" className="mt-2" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: compact dashboard — metrics, grouped list, progress bars"
```

---

## Task 11: Auth Pages — Apple Card Style

**Files:**
- Modify: `src/app/(auth)/layout.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/signup/page.tsx`

- [ ] **Step 1: Simplify auth layout**

Write `src/app/(auth)/layout.tsx`:

```tsx
import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background-secondary">
      <main className="w-full max-w-sm px-6">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Restyle login page**

Write `src/app/(auth)/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
  }

  return (
    <div className="bg-background rounded-2xl p-8 shadow-sm border border-border">
      <div className="text-center mb-8">
        <div className="w-12 h-12 mx-auto bg-foreground rounded-xl flex items-center justify-center mb-3">
          <span className="text-background font-bold text-lg">CX</span>
        </div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Welcome back</h1>
        <p className="text-[13px] text-foreground-tertiary mt-1">Sign in to your command centre</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-[13px] text-destructive">{error}</div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px] font-medium">Email</Label>
          <Input id="email" type="email" placeholder="name@agency.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[13px] font-medium">Password</Label>
            <Link href="#" className="text-xs text-accent font-medium hover:underline">Forgot?</Link>
          </div>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent/90 text-white">
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-[11px] uppercase text-foreground-tertiary">
          <span className="bg-background px-2">or</span>
        </div>
      </div>

      <Button variant="outline" type="button" onClick={handleGoogleLogin} className="w-full">
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Google
      </Button>

      <p className="text-center text-[13px] text-foreground-tertiary mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-accent hover:underline">Create one</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Restyle signup page**

Write `src/app/(auth)/signup/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { org_name: orgName, role: "super_admin" } },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="bg-background rounded-2xl p-8 shadow-sm border border-border">
      <div className="text-center mb-8">
        <div className="w-12 h-12 mx-auto bg-accent rounded-xl flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
        </div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Set up workspace</h1>
        <p className="text-[13px] text-foreground-tertiary mt-1">Create a new command centre</p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-[13px] text-destructive">{error}</div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="orgName" className="text-[13px] font-medium">Organisation Name</Label>
          <Input id="orgName" placeholder="Acme Agency" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px] font-medium">Work Email</Label>
          <Input id="email" type="email" placeholder="you@acme.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[13px] font-medium">Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent/90 text-white">
          {loading ? "Creating..." : "Create Workspace"}
        </Button>
      </form>

      <p className="text-center text-[13px] text-foreground-tertiary mt-6">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">Sign In</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -3
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)"
git commit -m "feat: Apple-styled auth pages — clean cards, minimal layout"
```

---

## Task 12: Add Theme Toggle to Header

**Files:**
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Import and add ThemeToggle to header**

In `src/components/layout/header.tsx`, add the import after existing imports:

```tsx
import { ThemeToggle } from "@/components/ui/theme-toggle";
```

Then add `<ThemeToggle />` in the header between the notification bell and the user avatar divider:

```tsx
<div className="flex items-center gap-3">
  <ThemeToggle />
  <Button variant="ghost" size="icon-sm" className="relative text-foreground-tertiary hover:text-foreground">
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat: add light/dark/system theme toggle to header"
```

---

## Task 13: Final Build Verification + Lint Fix

**Files:** All modified files

- [ ] **Step 1: Run TypeScript check**

```bash
cd "/Users/New Mac files/cnx ai plans 2026/CNX Agency Command Centre 2026"
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 2: Run ESLint**

```bash
npm run lint
```

Fix any unused import or entity escape errors.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: all routes build successfully, no compilation errors.

- [ ] **Step 4: Start dev server and visually verify**

```bash
npm run dev
```

Open in browser. Check:
- Login page renders with Apple card styling
- Dashboard renders with compact metrics, grouped list, progress bars
- Sidebar: monochrome icons, subtle active state, section labels
- Theme toggle: light → dark → system all work
- All sidebar links navigate correctly
- Global search (⌘K) opens with Apple styling

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: lint fixes for Apple design system implementation"
```
