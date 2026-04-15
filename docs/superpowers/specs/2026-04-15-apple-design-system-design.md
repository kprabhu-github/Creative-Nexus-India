# Apple Design System — Creative Nexus Command Centre

## Summary

Redesign the Creative Nexus Command Centre UI to follow macOS Sonoma design language with compact (Pro Apps) density, Inter typography, and `#D90A2C` as the single brand accent color. Both light and dark modes.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Style | macOS Sonoma / Ventura | Professional, restrained, light — fits agency SaaS |
| Modes | Light + Dark | User preference toggle, system-follows supported |
| Sidebar | Finder / Mail pattern | Monochrome icons, subtle active states, uppercase section labels |
| Color system | Apple grays + `#D90A2C` accent | Navy `#0A1628` logo-only. Accent for CTAs, links, alerts, progress bars |
| Typography | Inter (Google Fonts) | Closest open-source SF Pro match. Replaces current Geist. |
| Density | Compact (Pro Apps) | More data per screen, segmented controls, grouped lists |

## Color Palette

### Light Mode

| Token | Value | Usage |
|---|---|---|
| `--background` | `#ffffff` | Main content area |
| `--background-secondary` | `#f5f5f7` | Cards, metric tiles, list backgrounds |
| `--foreground` | `#1d1d1f` | Primary text, headings |
| `--foreground-secondary` | `#424245` | Body text, nav items |
| `--foreground-tertiary` | `#86868b` | Labels, captions, timestamps, inactive icons |
| `--border` | `rgba(0,0,0,0.08)` | Sidebar border, card borders |
| `--divider` | `#e8e8ed` | List dividers, segmented control bg |
| `--surface-hover` | `rgba(0,0,0,0.04)` | Hover states |
| `--surface-active` | `rgba(0,0,0,0.06)` | Active sidebar item, pressed states |
| `--accent` | `#D90A2C` | CTAs, links, progress bars, badges |
| `--accent-hover` | `#C00927` | Button hover |
| `--success` | `#34C759` | Positive changes, completed states |
| `--warning` | `#FF9500` | Warnings |
| `--destructive` | `#FF3B30` | Errors, destructive actions |
| `--sidebar-bg` | `rgba(246,246,246,0.92)` | Sidebar with backdrop-blur |

### Dark Mode

| Token | Value | Usage |
|---|---|---|
| `--background` | `#1c1c1e` | Main content area |
| `--background-secondary` | `rgba(255,255,255,0.05)` | Cards, metric tiles |
| `--foreground` | `rgba(255,255,255,0.95)` | Primary text |
| `--foreground-secondary` | `rgba(255,255,255,0.55)` | Body text, nav items |
| `--foreground-tertiary` | `rgba(255,255,255,0.4)` | Labels, captions |
| `--border` | `rgba(255,255,255,0.06)` | Borders |
| `--divider` | `rgba(255,255,255,0.06)` | List dividers |
| `--surface-hover` | `rgba(255,255,255,0.06)` | Hover states |
| `--surface-active` | `rgba(255,255,255,0.08)` | Active sidebar item |
| `--accent` | `#FF453A` | Apple's dark-mode red (adjusted from `#D90A2C` for dark bg legibility) |
| `--accent-hover` | `#FF6961` | Button hover |
| `--success` | `#30D158` | Positive changes |
| `--warning` | `#FF9F0A` | Warnings |
| `--destructive` | `#FF453A` | Errors |
| `--sidebar-bg` | `rgba(30,30,30,0.92)` | Sidebar with backdrop-blur |
| `--card-border` | `rgba(255,255,255,0.04)` | Subtle card edge |

## Typography

**Font family:** `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`

| Element | Size | Weight | Letter-spacing | Color token |
|---|---|---|---|---|
| Page title | 22px | 700 | -0.5px | `--foreground` |
| Section title | 13px | 600 | 0 | `--foreground` |
| Metric value | 24px | 700 | -0.8px | `--foreground` |
| Metric label | 11px | 500 | 0.3px (uppercase) | `--foreground-tertiary` |
| Nav item | 13px | 400 (500 active) | 0 | `--foreground-secondary` (active: `--foreground`) |
| Section label | 11px | 600 | 0.3px (uppercase) | `--foreground-tertiary` |
| Body text | 13px | 400 | 0 | `--foreground-secondary` |
| Small/caption | 12px | 500 | 0 | `--foreground-tertiary` |
| Segmented control | 12px | 500 | 0 | `--foreground-tertiary` (active: `--foreground`) |

## Sidebar Specification

- **Width:** 220px expanded, 60px collapsed
- **Background:** `--sidebar-bg` with `backdrop-filter: blur(20px)`
- **Border:** 1px `--border` on the right edge
- **Logo:** 28px rounded rect (7px radius), dark fill, "CX" in white 11px/700
- **Nav items:** 6px vertical padding, 8px horizontal, 6px border-radius
  - Inactive: `--foreground-secondary` text, `--foreground-tertiary` icon stroke
  - Active: `--surface-active` background, `--foreground` text, `--foreground` icon stroke
  - Hover: `--surface-hover` background
- **Icons:** 16x16px, stroke-width 1.8, Lucide icon set
- **Section labels:** uppercase, 11px/600, `--foreground-tertiary`, 14px top padding
- **Divider between sections:** none (spacing alone separates)

## Component Patterns

### Metric Card
- Background: `--background-secondary`
- Border-radius: 10px
- Padding: 14px
- Dark mode: add 1px `--card-border`
- No shadows

### Grouped List
- Outer container: `--background-secondary`, 10px radius
- Items: white background (light) / `rgba(255,255,255,0.03)` (dark), 10px 14px padding
- Dividers: 1px `--divider`, inset 14px from edges
- Icons: 28px circle, `--background-secondary` fill, centered icon

### Segmented Control
- Container: `--divider` background, 7px radius, 1px padding
- Active segment: white (light) / `rgba(255,255,255,0.12)` (dark), 6px radius, subtle shadow
- Inactive: transparent, `--foreground-tertiary` text

### Progress Bar
- Track: `--divider`, 4px height, 2px radius
- Fill: `--accent` for brand metrics, `--success` for quality scores
- Container: same as metric card

### Buttons
- Primary: `--accent` background, white text, 8px radius, 32px height
- Primary hover: `--accent-hover`
- Secondary: `--background-secondary` background, `--foreground` text
- Ghost: transparent, `--foreground-secondary` text, hover `--surface-hover`
- Text link: `--accent` color, no underline, underline on hover

### Header Bar
- Height: 48px (reduced from current 64px)
- Background: `--background` with `backdrop-filter: blur(20px)` and `border-bottom: 1px --border`
- Search trigger: `--surface-hover` background, 8px radius, `--foreground-tertiary` text
- User avatar: 28px circle, initials in `--accent` background

## Dark Mode Strategy

- Toggle via `next-themes` with `class` strategy on `<html>`
- CSS variables swap between light and dark sets
- System preference detection: `prefers-color-scheme` as default
- User can override via settings toggle
- Dark mode accent shifts: `#D90A2C` → `#FF453A` (Apple's standard dark-mode red for legibility)
- Success shifts: `#34C759` → `#30D158`
- No image/icon changes needed — monochrome icons work in both modes via opacity

## Scope of Changes

### Files to modify
- `tailwind.config.ts` — replace color system, add Inter font, update border-radius
- `src/app/globals.css` — rewrite CSS variables for light/dark, remove old theme
- `src/app/layout.tsx` — swap to Inter, add `next-themes` ThemeProvider
- `src/components/layout/sidebar.tsx` — full rewrite to Finder/Mail pattern
- `src/components/layout/header.tsx` — redesign: thinner, blur, simplified
- `src/components/layout/global-search.tsx` — restyle to match Apple command palette
- `src/app/(dashboard)/layout.tsx` — update background, remove grid pattern
- `src/app/(dashboard)/dashboard/page.tsx` — rebuild with compact metrics, grouped lists, progress cards
- `src/app/(auth)/layout.tsx` — clean up to match Apple aesthetic
- `src/app/(auth)/login/page.tsx` — restyle form to Apple card pattern
- `src/app/(auth)/signup/page.tsx` — restyle form to Apple card pattern

### shadcn/ui components to restyle
- `button.tsx` — update variants to match Apple button spec
- `card.tsx` — remove shadows, use `--background-secondary` + radius
- `input.tsx` — Apple-style: `--background-secondary` bg, no border, focus ring
- `badge.tsx` — pill shape, `--accent` for primary
- `dialog.tsx` — blur backdrop, Apple sheet styling
- `dropdown-menu.tsx` — Apple menu: tight padding, subtle shadow, blur
- `select.tsx` — match input styling
- `command.tsx` — Apple Spotlight style: blur, centered, minimal
- `tabs.tsx` — convert to segmented control pattern
- `tooltip.tsx` — dark pill tooltip, Apple style
- `table.tsx` — grouped list pattern, inset dividers
- `metric-card.tsx` — rewrite to compact spec
- `status-badge.tsx` — pill with Apple system colors
- `empty-state.tsx` — simplified, no dashed border, minimal icon
- `skeleton.tsx` — `--background-secondary` pulse

### New components needed
- `src/components/ui/segmented-control.tsx` — Apple-style segmented toggle
- `src/components/ui/progress-bar.tsx` — thin 4px progress with track
- `src/components/ui/theme-toggle.tsx` — light/dark/system switcher

### New dependencies
- `next-themes` (already installed)
- `@fontsource-variable/inter` — self-hosted Inter variable font (no external requests, better TTFB than Google Fonts)
- Keep `@base-ui/react` — shadcn components depend on it

## What NOT to Change

- Routing structure — all routes stay the same
- Supabase integration — no changes to lib/supabase/ or auth logic
- Component API surface — existing props/exports remain compatible
- Module page stubs — keep current structure, just inherit new theme

## Visual Reference

The approved mockup is saved at:
`.superpowers/brainstorm/40316-1776266754/content/05-full-design.html`

Open with any browser to see the exact pixel reference for both light and dark modes.
