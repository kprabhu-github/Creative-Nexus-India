"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Brand tokens ──────────────────────────────────────────────────────────
const C = {
  navy: "#0B1C3D",
  navyLt: "#1A3260",
  coral: "#FF6B4A",
  green: "#22C55E",
  amber: "#F97316",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  gray: "#9CA3AF",
  bg: "#F0F2F5",
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface WorkingHours {
  from: string;
  to: string;
  days: string[];
}

type DailyLimits = Record<string, number>;

interface Account {
  id: string;
  slug: string;
  type: "personal" | "company";
  url: string;
  name: string;
  headline: string;
  subline: string;
  location: string;
  connections: number | null;
  followers: number | null;
  recommendations?: number | null;
  experience?: number | null;
  employee_count?: number | null;
  founded?: number | null;
  company_size?: string | null;
  pic: string | null;
  bg?: string | null;
  verified?: boolean;
  premium?: boolean;
  skills?: string[];
  prev_companies?: string[];
  specialties?: string[];
  education?: string | null;
  allowed_actions: string[];
  daily_limits: DailyLimits;
  working_hours: WorkingHours;
  status: "ready" | "active" | "paused";
  role: string;
  scraped_at: string;
  created_at: string;
}

interface LogEntry {
  id: string;
  account_id: string | null;
  message: string;
  type: "info" | "success" | "warn" | "error";
  created_at: string;
}

type UsageMap = Record<string, Record<string, number>>;

type ProspectStatus = "pending" | "in_sequence" | "replied" | "meeting" | "opted_out";

interface Prospect {
  id: string;
  name: string;
  firstName: string;
  headline: string;
  company: string;
  industry: string;
  location: string;
  email: string | null;
  score: number;
  step: number;
  status: ProspectStatus;
  replyReceived: boolean;
  lastAction: string | null;
  campaignId: string;
}

type CampaignStatus = "draft" | "active" | "paused" | "complete";

interface Campaign {
  id: string;
  name: string;
  accountId: string;
  source: string;
  sourceUrl: string;
  status: CampaignStatus;
  prospects: number;
  inSequence: number;
  replied: number;
  meetings: number;
  createdAt: string;
  steps: number;
  funnelSteps: FunnelStep[];
}

interface FunnelStep {
  id: string;
  actionId: string;
  delay: number;
  dailyLimit: number;
  template: string;
  replyDetect: boolean;
  aiPersonalise: boolean;
  spintax: boolean;
  attachImage: boolean;
}

// ─── Static data ───────────────────────────────────────────────────────────
const SOURCES = [
  { id: "company_employees", label: "Company employees", icon: "🏢", cost: "$0.003–0.01", automated: true },
  { id: "post_likers", label: "Post likers", icon: "❤️", cost: "$0.002", automated: true },
  { id: "post_commenters", label: "Post commenters", icon: "💬", cost: "$0.002", automated: true },
  { id: "csv_import", label: "CSV import", icon: "📂", cost: "free", automated: false },
  { id: "linkedin_search", label: "LinkedIn search", icon: "🔍", cost: "manual", automated: false },
  { id: "group_members", label: "Group members", icon: "👥", cost: "manual", automated: false },
  { id: "event_attendees", label: "Event attendees", icon: "📅", cost: "manual", automated: false },
  { id: "connections", label: "1st connections", icon: "🔗", cost: "manual", automated: false },
  { id: "alumni", label: "School alumni", icon: "🎓", cost: "manual", automated: false },
];

const AUTOMATED_SOURCE_IDS = new Set(SOURCES.filter((s) => s.automated).map((s) => s.id));

const ACTION_TYPES = [
  { id: "follow", label: "Follow profile", icon: "F", bg: "#E1F5EE", fg: "#0F6E56", defaultDelay: 0, defaultLimit: 40, hasTemplate: false, defaultTemplate: "" },
  { id: "visit", label: "Visit & extract", icon: "V", bg: "#E6F1FB", fg: "#185FA5", defaultDelay: 1, defaultLimit: 100, hasTemplate: false, defaultTemplate: "" },
  { id: "endorse", label: "Endorse skills", icon: "★", bg: "#FAEEDA", fg: "#854F0B", defaultDelay: 2, defaultLimit: 20, hasTemplate: false, defaultTemplate: "" },
  { id: "like", label: "Like recent posts", icon: "♥", bg: "#FAECE7", fg: "#993C1D", defaultDelay: 3, defaultLimit: 80, hasTemplate: false, defaultTemplate: "" },
  { id: "connect", label: "Connect + note", icon: "+", bg: "#EEEDFE", fg: "#534AB7", defaultDelay: 4, defaultLimit: 20, hasTemplate: true, defaultTemplate: "Hi {firstName}, I noticed {company}'s work in {industry} — would love to connect and share some ideas on digital growth." },
  { id: "message", label: "Message", icon: "M", bg: "#F0FDF4", fg: "#3B6D11", defaultDelay: 7, defaultLimit: 50, hasTemplate: true, defaultTemplate: "Hi {firstName}, thanks for connecting. Quick one — are you currently working with a marketing partner? We've helped similar companies with {service}. Happy to share details." },
  { id: "followup", label: "Follow-up", icon: "→", bg: "#FFF7ED", fg: "#854F0B", defaultDelay: 14, defaultLimit: 50, hasTemplate: true, defaultTemplate: "Hi {firstName}, following up on my last note. Would love to show you what we've done for brands like {company}. Worth a 20-min call?" },
] as const;

const DEFAULT_STEPS: FunnelStep[] = ACTION_TYPES.map((at, i) => ({
  id: `step_${i + 1}`,
  actionId: at.id,
  delay: at.defaultDelay,
  dailyLimit: at.defaultLimit,
  template: at.defaultTemplate,
  replyDetect: true,
  aiPersonalise: true,
  spintax: false,
  attachImage: false,
}));

// API response shapes (snake_case from Supabase)
interface CampaignApi {
  id: string;
  name: string;
  account_id: string | null;
  source: string;
  source_url: string;
  status: CampaignStatus;
  funnel_steps: FunnelStep[];
  prospect_count: number;
  in_sequence: number;
  replied: number;
  meetings: number;
  created_at: string;
}

interface ProspectApi {
  id: string;
  campaign_id: string;
  name: string;
  first_name: string;
  headline: string;
  company: string;
  industry: string;
  location: string;
  email: string | null;
  profile_url: string | null;
  score: number;
  step: number;
  status: ProspectStatus;
  reply_received: boolean;
  last_action: string | null;
  last_message: string | null;
}

function campaignFromApi(c: CampaignApi): Campaign {
  return {
    id: c.id,
    name: c.name,
    accountId: c.account_id ?? "",
    source: c.source,
    sourceUrl: c.source_url,
    status: c.status,
    prospects: c.prospect_count,
    inSequence: c.in_sequence,
    replied: c.replied,
    meetings: c.meetings,
    createdAt: c.created_at,
    steps: Array.isArray(c.funnel_steps) ? c.funnel_steps.length : 0,
    funnelSteps: Array.isArray(c.funnel_steps) ? c.funnel_steps : [],
  };
}

function prospectFromApi(p: ProspectApi): Prospect {
  return {
    id: p.id,
    name: p.name,
    firstName: p.first_name,
    headline: p.headline,
    company: p.company,
    industry: p.industry,
    location: p.location,
    email: p.email,
    score: p.score,
    step: p.step,
    status: p.status,
    replyReceived: p.reply_received,
    lastAction: p.last_action,
    campaignId: p.campaign_id,
  };
}

const STATUS_CFG: Record<ProspectStatus, { label: string; bg: string; c: string; dot: string }> = {
  pending: { label: "Pending", bg: "#F3F4F6", c: "#6B7280", dot: "#9CA3AF" },
  in_sequence: { label: "In Sequence", bg: "#EFF6FF", c: "#1D4ED8", dot: C.blue },
  replied: { label: "Replied ✓", bg: "#F0FDF4", c: "#15803D", dot: C.green },
  meeting: { label: "Meeting 🎉", bg: "#FAF5FF", c: "#6D28D9", dot: C.purple },
  opted_out: { label: "Opted Out", bg: "#FFF1F2", c: "#9F1239", dot: "#F43F5E" },
};

const AVATAR_PALETTES: [string, string][] = [
  ["#EDE9FE", "#5B21B6"],
  ["#DCFCE7", "#15803D"],
  ["#FEF3C7", "#B45309"],
  ["#FCE7F3", "#9D174D"],
  ["#E0F2FE", "#0369A1"],
  ["#FEE2E2", "#B91C1C"],
];

// ─── Helpers ──────────────────────────────────────────────────────────────
function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
}
function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function avatarPalette(name: string): [string, string] {
  return AVATAR_PALETTES[name.charCodeAt(0) % AVATAR_PALETTES.length];
}
function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── Micro components ─────────────────────────────────────────────────────
function Score({ v }: { v: number }) {
  const color = v >= 85 ? C.green : v >= 70 ? C.amber : C.gray;
  return <span style={{ fontWeight: 800, fontSize: 12, color }}>{v}%</span>;
}

function LimitBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(Math.round((used / max) * 100), 100);
  const color = pct > 80 ? C.coral : pct > 50 ? C.amber : C.green;
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
        <span style={{ color: C.gray, textTransform: "capitalize" }}>{label.replace(/([A-Z])/g, " $1").toLowerCase()}</span>
        <span style={{ fontWeight: 600, color: pct > 80 ? C.coral : "#6B7280" }}>{used}/{max}</span>
      </div>
      <div style={{ height: 3, background: "#F3F4F6", borderRadius: 2 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Account["status"] }) {
  const map: Record<Account["status"], { bg: string; c: string; dot: string; label: string }> = {
    ready: { bg: "#F0FDF4", c: "#15803D", dot: C.green, label: "Ready" },
    active: { bg: "#EFF6FF", c: "#1D4ED8", dot: C.blue, label: "Running" },
    paused: { bg: "#FFF7ED", c: "#C2410C", dot: C.amber, label: "Paused" },
  };
  const s = map[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: s.bg, color: s.c, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#374151", cursor: "pointer" }}>
      <span onClick={() => onChange(!on)} style={{ width: 28, height: 16, background: on ? C.coral : "#E5E7EB", borderRadius: 20, position: "relative", transition: "background 0.15s", display: "inline-block" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 14 : 2, width: 12, height: 12, background: "white", borderRadius: "50%", transition: "left 0.15s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
      </span>
      {label}
    </label>
  );
}

// ─── Account card, add card, limits modal ────────────────────────────────
function AccountCard({
  acc,
  selected,
  onSelect,
  onRunCampaign,
  onSettings,
  onRescrape,
  onDelete,
  usage,
  rescrapingId,
}: {
  acc: Account;
  selected: boolean;
  onSelect: () => void;
  onRunCampaign: (id: string) => void;
  onSettings: (id: string) => void;
  onRescrape: (id: string) => void;
  onDelete: (id: string) => void;
  usage: Record<string, number> | undefined;
  rescrapingId: string | null;
}) {
  const [imgErr, setImgErr] = useState(false);
  const isCompany = acc.type === "company";
  const lim = acc.daily_limits;
  const use = usage || {};
  const rescraping = rescrapingId === acc.id;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        border: `2px solid ${selected ? C.coral : "#E5E7EB"}`,
        boxShadow: selected ? `0 0 0 4px ${C.coral}18` : "none",
        overflow: "hidden",
        transition: "all 0.18s",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
      }}
      onClick={onSelect}
    >
      <div style={{ height: 6, background: isCompany ? `linear-gradient(90deg, ${C.navy} 0%, #2563EB 100%)` : `linear-gradient(90deg, ${C.coral} 0%, #FF9A6C 100%)` }} />
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", padding: "2px 8px", borderRadius: 20, background: isCompany ? "#EFF6FF" : "#FFF1ED", color: isCompany ? "#1D4ED8" : C.coral }}>
              {isCompany ? "Company" : "Personal"}
            </span>
            <StatusPill status={acc.status} />
          </div>
          {selected && (
            <span style={{ fontSize: 9, fontWeight: 800, background: C.coral, color: "white", padding: "2px 8px", borderRadius: 20 }}>ACTIVE</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ width: 56, height: 56, borderRadius: isCompany ? 12 : "50%", border: `2px solid ${selected ? C.coral : "#E5E7EB"}`, overflow: "hidden", flexShrink: 0, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: C.navy }}>
            {!imgErr && acc.pic ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={acc.pic} alt={acc.name} onError={() => setImgErr(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              initials(acc.name)
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: C.navy }}>{acc.name}</span>
              {acc.verified && <span style={{ fontSize: 10, color: C.blue }}>✓</span>}
            </div>
            <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.4, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {acc.headline}
            </div>
            <div style={{ fontSize: 10, color: C.gray }}>{acc.location}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #F3F4F6" }}>
        {(
          [
            !isCompany && ["connections", acc.connections?.toLocaleString() ?? "—", "Connections"],
            ["followers", acc.followers?.toLocaleString() ?? "—", "Followers"],
            isCompany
              ? ["employees", acc.employee_count ?? "—", "Employees"]
              : ["recommendations", acc.recommendations ?? "—", "Recommendations"],
          ].filter(Boolean) as [string, string | number, string][]
        ).map(([key, val, label]) => (
          <div key={key} style={{ flex: 1, textAlign: "center", padding: "10px 4px", borderRight: "1px solid #F3F4F6" }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>{val}</div>
            <div style={{ fontSize: 9, color: C.gray, marginTop: 1, textTransform: "uppercase", letterSpacing: "0.3px" }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #F3F4F6", fontSize: 11, color: "#374151", lineHeight: 1.5, background: "#FAFAFA" }}>
        {acc.role}
      </div>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8 }}>Today&apos;s usage</div>
        {Object.entries(lim).map(([k, max]) => (
          <LimitBar key={k} label={k} used={use[k] || 0} max={max} />
        ))}
      </div>
      <div style={{ padding: "10px 14px", display: "flex", gap: 6, alignItems: "center", marginTop: "auto" }}>
        <button onClick={(e) => { e.stopPropagation(); onRescrape(acc.id); }} disabled={rescraping} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "1px solid #E5E7EB", background: "transparent", color: "#6B7280", fontSize: 10, fontWeight: 600, cursor: rescraping ? "default" : "pointer", fontFamily: "inherit", opacity: rescraping ? 0.5 : 1 }}>
          {rescraping ? "Scraping…" : "↺ Re-scrape"}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onSettings(acc.id); }} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "1px solid #E5E7EB", background: "transparent", color: "#6B7280", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>⚙ Limits</button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm(`Remove ${acc.name}?`)) onDelete(acc.id); }} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #FECACA", background: "transparent", color: "#DC2626", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>×</button>
        <button onClick={(e) => { e.stopPropagation(); onRunCampaign(acc.id); }} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none", background: C.coral, color: "white", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Run Campaign →
        </button>
      </div>
      <div style={{ textAlign: "right", padding: "0 14px 8px", fontSize: 9, color: C.gray }}>
        Scraped {timeAgo(acc.scraped_at)} via Apify
      </div>
    </div>
  );
}

function AddAccountCard({ onAdd, scraping }: { onAdd: (url: string, name: string) => void; scraping: boolean }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const valid = /linkedin\.com\/(in|company)\//i.test(url);
  const isCompany = /linkedin\.com\/company\//i.test(url);

  return (
    <div style={{ background: "white", borderRadius: 16, border: "1.5px dashed #D1D5DB", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 20px", minHeight: 340 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: C.gray, marginBottom: 10 }}>+</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: C.navy, marginBottom: 4 }}>Add LinkedIn Account</div>
      <div style={{ fontSize: 11, color: C.gray, textAlign: "center", lineHeight: 1.5, marginBottom: 18 }}>
        Scraped live via Apify (server-side).
      </div>
      <div style={{ width: "100%", marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 5 }}>Display Name (optional)</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rishabh Kumar" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box", color: C.navy }} />
      </div>
      <div style={{ width: "100%", marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 5 }}>LinkedIn URL *</div>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.linkedin.com/in/username/" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${valid ? "#22C55E" : url ? C.coral : "#E5E7EB"}`, fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box", color: C.navy }} />
        {url && <div style={{ fontSize: 10, marginTop: 3, color: valid ? "#15803D" : C.coral }}>{valid ? `✓ ${isCompany ? "Company page" : "Profile"} detected` : "⚠ Must be linkedin.com/in/ or /company/"}</div>}
      </div>
      <button onClick={() => { if (valid) { onAdd(url.trim(), name.trim()); setUrl(""); setName(""); } }} disabled={!valid || scraping} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", cursor: valid && !scraping ? "pointer" : "default", background: valid && !scraping ? C.navy : "#F3F4F6", color: valid && !scraping ? "white" : C.gray, fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
        {scraping ? "⏳ Scraping…" : "Add Account"}
      </button>
    </div>
  );
}

function LimitsModal({ acc, onClose, onSave, saving }: { acc: Account; onClose: () => void; onSave: (id: string, lim: DailyLimits, hrs: WorkingHours) => void; saving: boolean }) {
  const [lim, setLim] = useState<DailyLimits>({ ...acc.daily_limits });
  const [hrs, setHrs] = useState<WorkingHours>({ ...acc.working_hours });
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "24px", width: 380, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Limits — {acc.name}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.gray }}>×</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 10 }}>Daily action limits</div>
          {Object.entries(lim).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: "#374151", textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1").toLowerCase()}</label>
              <input
                type="number"
                value={Number.isFinite(v) ? v : 0}
                min={0}
                max={500}
                onChange={(e) => {
                  const raw = parseInt(e.target.value, 10);
                  const safe = Number.isFinite(raw) ? Math.max(0, Math.min(500, raw)) : 0;
                  setLim((p) => ({ ...p, [k]: safe }));
                }}
                style={{ width: 64, padding: "5px 8px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, textAlign: "center", outline: "none", fontFamily: "inherit" }}
              />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 10 }}>Working hours (IST)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input type="time" value={hrs.from} onChange={(e) => setHrs((p) => ({ ...p, from: e.target.value }))} style={{ flex: 1, padding: "7px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
            <span style={{ color: C.gray }}>–</span>
            <input type="time" value={hrs.to} onChange={(e) => setHrs((p) => ({ ...p, to: e.target.value }))} style={{ flex: 1, padding: "7px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {DAYS.map((d) => (
              <button key={d} onClick={() => setHrs((p) => ({ ...p, days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d] }))} style={{ padding: "4px 10px", borderRadius: 20, border: "1px solid", borderColor: hrs.days.includes(d) ? C.navy : "#E5E7EB", background: hrs.days.includes(d) ? C.navy : "transparent", color: hrs.days.includes(d) ? "white" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{d}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={saving} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #E5E7EB", background: "transparent", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => onSave(acc.id, lim, hrs)} disabled={saving} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: C.navy, color: "white", fontSize: 12, fontWeight: 700, cursor: saving ? "default" : "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Funnel builder components ────────────────────────────────────────────
function ActionBlock({ step, index, selected, onClick, onRemove, total }: { step: FunnelStep; index: number; selected: boolean; onClick: () => void; onRemove: () => void; total: number }) {
  const at = ACTION_TYPES.find((a) => a.id === step.actionId);
  if (!at) return null;
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: selected ? "#FFF1ED" : "white", border: `2px solid ${selected ? C.coral : "#E5E7EB"}`, borderRadius: 10, cursor: "pointer", position: "relative" }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, background: at.bg, color: at.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{at.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>Step {index + 1}: {at.label}</div>
        <div style={{ fontSize: 9, color: C.gray }}>Day {step.delay} · {step.dailyLimit}/day {step.template ? "· template" : ""}</div>
      </div>
      {total > 1 && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ background: "none", border: "none", color: C.gray, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: "0 3px" }} aria-label="Remove step">×</button>
      )}
    </div>
  );
}

function StepSettings({ step, onChange }: { step: FunnelStep; onChange: (patch: Partial<FunnelStep>) => void }) {
  const at = ACTION_TYPES.find((a) => a.id === step.actionId);
  if (!at) return null;
  return (
    <div style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid #E5E7EB" }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: C.navy, marginBottom: 12 }}>Configure: {at.label}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 4 }}>Delay (days)</div>
          <input type="number" value={step.delay} min={0} max={60} onChange={(e) => onChange({ delay: Number(e.target.value) })} style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 4 }}>Daily limit</div>
          <input type="number" value={step.dailyLimit} min={1} max={500} onChange={(e) => onChange({ dailyLimit: Number(e.target.value) })} style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
      </div>

      {at.hasTemplate && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 4 }}>Message template</div>
          <textarea value={step.template} onChange={(e) => onChange({ template: e.target.value })} rows={4} placeholder="Use {firstName}, {company}, {industry}, {headline}, {service}..." style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }} />
          <div style={{ fontSize: 9, color: C.gray, marginTop: 3 }}>Variables: {"{firstName}"}, {"{company}"}, {"{industry}"}, {"{headline}"}, {"{service}"}</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Toggle on={step.aiPersonalise} onChange={(v) => onChange({ aiPersonalise: v })} label="AI-personalise each send (Claude)" />
        <Toggle on={step.replyDetect} onChange={(v) => onChange({ replyDetect: v })} label="Auto-stop if they reply" />
        <Toggle on={step.spintax} onChange={(v) => onChange({ spintax: v })} label="Spintax variations" />
      </div>
    </div>
  );
}

function ProspectRow({ p, selected, onClick }: { p: Prospect; selected: boolean; onClick: () => void }) {
  const [bg, fg] = avatarPalette(p.name);
  const st = STATUS_CFG[p.status];
  return (
    <div onClick={onClick} style={{ display: "flex", gap: 10, padding: "10px 14px", cursor: "pointer", background: selected ? "#F0F4FF" : "white", borderLeft: `3px solid ${selected ? C.coral : "transparent"}`, borderBottom: "1px solid #F3F4F6" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(p.name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 12, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
          <Score v={p.score} />
        </div>
        <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.headline}</div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: st.bg, color: st.c, padding: "2px 7px", borderRadius: 20, fontSize: 9, fontWeight: 600 }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: st.dot }} />
            {st.label}
          </span>
          <span style={{ fontSize: 9, color: C.gray }}>Step {p.step} · {timeAgo(p.lastAction)}</span>
        </div>
      </div>
    </div>
  );
}

function ImportModal({
  campaignName,
  onClose,
  onImport,
  importing,
}: {
  campaignName: string;
  onClose: () => void;
  onImport: (type: "csv" | "urls", data: string) => void;
  importing: boolean;
}) {
  const [mode, setMode] = useState<"csv" | "urls">("csv");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
    setMode("csv");
  }

  const csvExample = `name,headline,company,industry,location,email,linkedin_url
Ankit Bhatia,VP Marketing @ Zomato,Zomato,E-Commerce,Gurugram,a.bhatia@zomato.com,https://linkedin.com/in/ankit-bhatia`;
  const urlExample = `https://linkedin.com/in/ankit-bhatia
https://linkedin.com/in/ritu-shenoy
https://linkedin.com/in/karan-malhotra`;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "20px 22px", width: 540, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Import Prospects</div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>Adding to &ldquo;{campaignName}&rdquo;</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.gray }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button onClick={() => setMode("csv")} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid", borderColor: mode === "csv" ? C.coral : "#E5E7EB", background: mode === "csv" ? "#FFF1ED" : "white", color: mode === "csv" ? C.coral : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📄 CSV</button>
          <button onClick={() => setMode("urls")} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid", borderColor: mode === "urls" ? C.coral : "#E5E7EB", background: mode === "urls" ? "#FFF1ED" : "white", color: mode === "urls" ? C.coral : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🔗 URL List</button>
        </div>

        {mode === "csv" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 4 }}>Upload file</div>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={handleFile} style={{ marginBottom: 10, fontSize: 12 }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 4 }}>Or paste CSV</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={csvExample}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12, fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }}
            />
            <div style={{ fontSize: 10, color: C.gray, marginTop: 4 }}>
              Accepted columns: name, headline, company, industry, location, email, linkedin_url (any order, any case).
              Supports Apollo.io and Sales Navigator exports.
            </div>
          </>
        )}

        {mode === "urls" && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 4 }}>Paste LinkedIn URLs (one per line)</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={urlExample}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12, fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }}
            />
            <div style={{ fontSize: 10, color: C.gray, marginTop: 4 }}>
              Creates a row per URL with name derived from the slug. Headline, company, etc. will be blank
              — enrich by running a profile scrape per-prospect later.
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} disabled={importing} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #E5E7EB", background: "transparent", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => onImport(mode, text)} disabled={!text.trim() || importing} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: text.trim() && !importing ? C.coral : "#F3F4F6", color: text.trim() && !importing ? "white" : C.gray, fontSize: 12, fontWeight: 700, cursor: text.trim() && !importing ? "pointer" : "default", fontFamily: "inherit" }}>
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AnalyticsView({ prospects, campaigns }: { prospects: Prospect[]; campaigns: Campaign[] }) {
  const total = prospects.length;
  const inSeq = prospects.filter((p) => p.status === "in_sequence").length;
  const replied = prospects.filter((p) => p.replyReceived).length;
  const meetings = prospects.filter((p) => p.status === "meeting").length;
  const replyRate = total ? Math.round((replied / total) * 100) : 0;
  const meetingRate = total ? Math.round((meetings / total) * 100) : 0;

  const byIndustry = useMemo(() => {
    const m = new Map<string, number>();
    prospects.forEach((p) => m.set(p.industry, (m.get(p.industry) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [prospects]);

  return (
    <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
      {[
        ["Total Prospects", total, ""],
        ["In Sequence", inSeq, ""],
        ["Replied", replied, `${replyRate}%`],
        ["Meetings", meetings, `${meetingRate}%`],
      ].map(([l, v, pct]) => (
        <div key={l as string} style={{ background: "white", borderRadius: 12, padding: "16px 18px", border: "1px solid #E5E7EB" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>{l as string}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.navy }}>{v as number}</div>
          {pct && <div style={{ fontSize: 11, color: C.coral, fontWeight: 700, marginTop: 2 }}>{pct as string}</div>}
        </div>
      ))}

      <div style={{ gridColumn: "span 2", background: "white", borderRadius: 12, padding: "16px 18px", border: "1px solid #E5E7EB" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10 }}>Prospects by Industry</div>
        {byIndustry.map(([ind, n]) => (
          <div key={ind} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#374151", width: 110 }}>{ind}</span>
            <div style={{ flex: 1, height: 6, background: "#F3F4F6", borderRadius: 3 }}>
              <div style={{ width: `${(n / total) * 100}%`, height: "100%", background: C.coral, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.navy, width: 26, textAlign: "right" }}>{n}</span>
          </div>
        ))}
      </div>

      <div style={{ gridColumn: "span 2", background: "white", borderRadius: 12, padding: "16px 18px", border: "1px solid #E5E7EB" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10 }}>Active Campaigns</div>
        {campaigns.map((c) => (
          <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>{c.name}</span>
              <span style={{ fontSize: 10, color: c.status === "active" ? C.green : C.gray, fontWeight: 700 }}>{c.status.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 10, color: "#6B7280" }}>
              {c.prospects} prospects · {c.inSequence} in sequence · {c.replied} replied · {c.meetings} meetings
            </div>
          </div>
        ))}
        {campaigns.length === 0 && <div style={{ fontSize: 11, color: C.gray }}>No campaigns yet.</div>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
type TabId = "accounts" | "campaigns" | "funnel" | "queue" | "analytics";

export default function LinkedInPage() {
  // Shared
  const [tab, setTab] = useState<TabId>("accounts");

  // Active workflow context — set by "Run Campaign" on an AccountCard.
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false);

  // Accounts state (real backend)
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [usage, setUsage] = useState<UsageMap>({});
  const [log, setLog] = useState<LogEntry[]>([]);
  const [selectedAccId, setSelectedAccId] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [rescrapingId, setRescrapingId] = useState<string | null>(null);
  const [savingLimits, setSavingLimits] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Campaigns (real)
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);

  // Prospects (real, scoped to selectedCampaignId)
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedPros, setSelectedPros] = useState<Prospect | null>(null);
  const [msgDraft, setMsgDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | ProspectStatus>("all");
  const [autoRunning, setAutoRunning] = useState(false);

  // Funnel builder
  const [funnelSteps, setFunnelSteps] = useState<FunnelStep[]>(DEFAULT_STEPS);
  const [selFunnelStep, setSelFunnelStep] = useState(0);

  // Campaign builder
  const [selSource, setSelSource] = useState("company_employees");
  const [sourceUrl, setSourceUrl] = useState("https://www.linkedin.com/company/razorpay/");
  const [campName, setCampName] = useState("New Campaign — CMO Outreach India");

  // ── Load real data ────────────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/accounts");
      const json = (await res.json()) as { data?: { accounts: Account[]; usage: UsageMap }; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setAccounts(json.data?.accounts ?? []);
      setUsage(json.data?.usage ?? {});
      setSelectedAccId((id) => id ?? (json.data?.accounts[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    }
  }, []);

  const loadLog = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/log");
      const json = (await res.json()) as { data?: LogEntry[]; error?: string };
      if (!res.ok || json.error) return;
      setLog(json.data ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/campaigns");
      const json = (await res.json()) as { data?: CampaignApi[]; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      const list = (json.data ?? []).map(campaignFromApi);
      setCampaigns(list);
      setSelectedCampaignId((id) => id ?? list[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    }
  }, []);

  const loadProspects = useCallback(async (campaignId: string) => {
    try {
      const res = await fetch(`/api/linkedin/campaigns/${campaignId}`);
      const json = (await res.json()) as {
        data?: { campaign: CampaignApi; prospects: ProspectApi[] };
        error?: string;
      };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setProspects((json.data?.prospects ?? []).map(prospectFromApi));
    } catch (err) {
      console.warn("Failed to load prospects:", err);
      setProspects([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([loadAccounts(), loadLog(), loadCampaigns()]);
      setLoading(false);
    })();
  }, [loadAccounts, loadLog, loadCampaigns]);

  // Reload prospects + sync funnel when selected campaign changes
  useEffect(() => {
    if (selectedCampaignId) {
      loadProspects(selectedCampaignId);
      const camp = campaigns.find((c) => c.id === selectedCampaignId);
      if (camp && camp.funnelSteps.length > 0) {
        setFunnelSteps(camp.funnelSteps);
        setSelFunnelStep(0);
      }
    } else {
      setProspects([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaignId]);

  // When user clicks "Run Campaign" on an account, pre-fill the campaign form.
  // If that account has no campaigns yet, auto-open the new-campaign form.
  useEffect(() => {
    if (!activeAccountId) return;
    setSelectedAccId(activeAccountId);
    const scoped = campaigns.filter((c) => c.accountId === activeAccountId);
    if (scoped.length === 0) setShowNewCampaignForm(true);
    else setShowNewCampaignForm(false);
  }, [activeAccountId, campaigns]);

  // ── Account handlers ──────────────────────────────────────────────────
  async function handleAddAccount(url: string, name: string) {
    setScraping(true);
    try {
      const res = await fetch("/api/linkedin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name }),
      });
      const json = (await res.json()) as { data?: Account; warning?: string | null; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all([loadAccounts(), loadLog()]);
      if (json.data) setSelectedAccId(json.data.id);
      if (json.warning) {
        alert(`Account saved as a stub.\n\n${json.warning}\n\nClick Re-scrape on the card once a working actor is configured.`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Add failed");
    } finally {
      setScraping(false);
    }
  }

  async function handleRescrape(id: string) {
    setRescrapingId(id);
    try {
      const res = await fetch(`/api/linkedin/accounts/${id}/rescrape`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all([loadAccounts(), loadLog()]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Rescrape failed");
    } finally {
      setRescrapingId(null);
    }
  }

  async function handleSaveLimits(id: string, lim: DailyLimits, hrs: WorkingHours) {
    setSavingLimits(true);
    try {
      const res = await fetch(`/api/linkedin/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_limits: lim, working_hours: hrs }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all([loadAccounts(), loadLog()]);
      setSettingsId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingLimits(false);
    }
  }

  async function handleDeleteAccount(id: string) {
    try {
      const res = await fetch(`/api/linkedin/accounts/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all([loadAccounts(), loadLog()]);
      if (selectedAccId === id) setSelectedAccId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  // ── Prospect / message handlers (real backend) ──────────────────────
  async function handleGenMsg(p: Prospect, stepIdx: number) {
    setGenerating(true);
    try {
      const step = funnelSteps[stepIdx];
      const res = await fetch("/api/linkedin/messages/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_id: p.id,
          step_index: stepIdx,
          action_id: step?.actionId,
          template: step?.template,
        }),
      });
      const json = (await res.json()) as { data?: { message: string; ai_failed?: boolean }; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setMsgDraft(json.data?.message ?? "");
      if (json.data?.ai_failed) {
        alert("AI generation failed — used raw template as fallback. Check ANTHROPIC_API_KEY on Hostinger.");
      }
    } catch (err) {
      // Fallback: template substitution locally (offline-safe)
      const step = funnelSteps[stepIdx];
      const tmpl = step?.template ?? "";
      const firstName = p.firstName || p.name.split(" ")[0] || "there";
      const filled = tmpl
        .replace(/\{firstName\}/g, firstName)
        .replace(/\{company\}/g, p.company || "your company")
        .replace(/\{industry\}/g, p.industry || "your industry")
        .replace(/\{headline\}/g, p.headline || "")
        .replace(/\{service\}/g, "digital marketing & SEO");
      setMsgDraft(filled);
      alert(`AI draft failed — used raw template. (${err instanceof Error ? err.message : "unknown error"})`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSendAdvance(p: Prospect) {
    const nextStep = Math.min(Math.max(p.step, 0) + 1, funnelSteps.length);
    try {
      const res = await fetch(`/api/linkedin/prospects/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: nextStep,
          status: "in_sequence" as ProspectStatus,
          last_message: msgDraft,
        }),
      });
      const json = (await res.json()) as { data?: ProspectApi; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      const updated = prospectFromApi(json.data as ProspectApi);
      setProspects((prev) => prev.map((pr) => (pr.id === p.id ? updated : pr)));
      setSelectedPros(updated);
      setMsgDraft("");
      if (selectedCampaignId) await loadCampaigns();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Send failed");
    }
  }

  async function updateProsStatus(id: string, st: ProspectStatus) {
    try {
      const res = await fetch(`/api/linkedin/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: st,
          reply_received: st === "replied" || st === "meeting",
        }),
      });
      const json = (await res.json()) as { data?: ProspectApi; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      const updated = prospectFromApi(json.data as ProspectApi);
      setProspects((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setSelectedPros((prev) => (prev?.id === id ? updated : prev));
      await loadCampaigns();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleAutoRun() {
    if (!selectedCampaignId) {
      alert("Select a campaign first.");
      return;
    }
    setAutoRunning(true);
    try {
      const res = await fetch(`/api/linkedin/campaigns/${selectedCampaignId}/advance`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        data?: { advanced: number; total_steps?: number; message?: string };
        error?: string;
      };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all([
        loadProspects(selectedCampaignId),
        loadCampaigns(),
        loadLog(),
      ]);
      const advanced = json.data?.advanced ?? 0;
      if (advanced === 0) {
        alert(
          json.data?.message ??
            "No prospects to advance. Add prospects (🔍 Discover or 📁 Import) first, or check that any are in 'Pending' or 'In Sequence' status.",
        );
      } else {
        alert(`✓ Advanced ${advanced} prospect${advanced === 1 ? "" : "s"} by one step.`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Auto-run failed");
    } finally {
      setAutoRunning(false);
    }
  }

  async function handleDiscover() {
    if (!selectedCampaignId) {
      alert("Create/select a campaign first.");
      return;
    }
    setDiscovering(true);
    try {
      const res = await fetch(`/api/linkedin/campaigns/${selectedCampaignId}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_results: 30 }),
      });
      const json = (await res.json()) as {
        data?: { inserted: number; skipped: number };
        error?: string;
      };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all([
        loadProspects(selectedCampaignId),
        loadCampaigns(),
        loadLog(),
      ]);
      alert(`Added ${json.data?.inserted ?? 0} prospects (${json.data?.skipped ?? 0} duplicates skipped).`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Discover failed");
    } finally {
      setDiscovering(false);
    }
  }

  async function handleImport(type: "csv" | "urls", data: string) {
    if (!selectedCampaignId) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/linkedin/campaigns/${selectedCampaignId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data }),
      });
      const json = (await res.json()) as {
        data?: { inserted: number; duplicates: number; invalid: number };
        error?: string;
      };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all([loadProspects(selectedCampaignId), loadCampaigns(), loadLog()]);
      alert(
        `Imported ${json.data?.inserted ?? 0} prospects — ${json.data?.duplicates ?? 0} duplicates, ${json.data?.invalid ?? 0} invalid.`,
      );
      setShowImport(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function addFunnelStep(actionId: string) {
    const at = ACTION_TYPES.find((a) => a.id === actionId);
    if (!at) return;
    const last = funnelSteps[funnelSteps.length - 1];
    const newStep: FunnelStep = {
      id: `step_${Date.now()}`,
      actionId,
      delay: (last?.delay ?? 0) + 3,
      dailyLimit: at.defaultLimit,
      template: at.defaultTemplate,
      replyDetect: true,
      aiPersonalise: true,
      spintax: false,
      attachImage: false,
    };
    setFunnelSteps((prev) => [...prev, newStep]);
    setSelFunnelStep(funnelSteps.length);
  }

  function removeFunnelStep(idx: number) {
    setFunnelSteps((prev) => prev.filter((_, i) => i !== idx));
    if (selFunnelStep >= idx && selFunnelStep > 0) setSelFunnelStep(selFunnelStep - 1);
  }

  function updateFunnelStep(idx: number, patch: Partial<FunnelStep>) {
    setFunnelSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  async function launchCampaign() {
    if (!selectedAccId) {
      alert("Pick an account first.");
      return;
    }
    if (!campName.trim()) {
      alert("Campaign name is required.");
      return;
    }
    setLaunching(true);
    try {
      const res = await fetch("/api/linkedin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campName,
          account_id: selectedAccId,
          source: selSource,
          source_url: sourceUrl,
          funnel_steps: funnelSteps,
          status: "active",
        }),
      });
      const json = (await res.json()) as { data?: CampaignApi; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all([loadCampaigns(), loadLog()]);
      if (json.data) setSelectedCampaignId(json.data.id);
      setTab("queue");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  }

  async function saveFunnelToCampaign() {
    if (!selectedCampaignId) {
      alert("Pick a campaign first (Queue tab → dropdown).");
      return;
    }
    setLaunching(true);
    try {
      const res = await fetch(`/api/linkedin/campaigns/${selectedCampaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funnel_steps: funnelSteps }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all([loadCampaigns(), loadLog()]);
      alert("Funnel saved to campaign.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save funnel failed");
    } finally {
      setLaunching(false);
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm("Delete this campaign and all its prospects?")) return;
    try {
      const res = await fetch(`/api/linkedin/campaigns/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all([loadCampaigns(), loadLog()]);
      if (selectedCampaignId === id) setSelectedCampaignId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────
  const selectedAcc = accounts.find((a) => a.id === selectedAccId) ?? null;
  const settingsAcc = accounts.find((a) => a.id === settingsId) ?? null;
  const filteredProspects = prospects.filter((p) => filterStatus === "all" || p.status === filterStatus);
  const statsTotal = prospects.length;
  const statsInSeq = prospects.filter((p) => p.status === "in_sequence").length;
  const statsReplied = prospects.filter((p) => p.replyReceived).length;
  const statsMeet = prospects.filter((p) => p.status === "meeting").length;

  const TABS: [TabId, string][] = [
    ["accounts", "👤 Accounts"],
    ["campaigns", "📋 Campaigns"],
    ["funnel", "⚡ Build Funnel"],
    ["queue", "📬 Queue"],
    ["analytics", "📊 Analytics"],
  ];

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", color: C.navy }}>
      {settingsAcc && <LimitsModal acc={settingsAcc} onClose={() => setSettingsId(null)} onSave={handleSaveLimits} saving={savingLimits} />}
      {showImport && selectedCampaignId && (
        <ImportModal
          campaignName={campaigns.find((c) => c.id === selectedCampaignId)?.name ?? ""}
          onClose={() => setShowImport(false)}
          onImport={handleImport}
          importing={importing}
        />
      )}

      {/* Page header + stats + actions */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", paddingBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.navy, margin: 0, letterSpacing: "-0.4px" }}>LinkedIn Outreach</h1>
          <p style={{ fontSize: 12, color: "#6B7280", margin: "3px 0 0" }}>
            {loading ? "Loading…" : `${accounts.length} account${accounts.length === 1 ? "" : "s"} · ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} · ${prospects.length} prospects`}
          </p>
        </div>
        {tab === "queue" && (
          <button onClick={handleAutoRun} disabled={autoRunning} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: autoRunning ? "#F3F4F6" : C.coral, color: autoRunning ? C.gray : "white", fontSize: 12, fontWeight: 700, cursor: autoRunning ? "default" : "pointer", fontFamily: "inherit" }}>
            {autoRunning ? "● Auto-running…" : "▶ Auto-run sequence"}
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          ["Prospects", statsTotal, ""],
          ["In Sequence", statsInSeq, ""],
          ["Replied", statsReplied, statsTotal ? `${Math.round((statsReplied / statsTotal) * 100)}%` : ""],
          ["Meetings", statsMeet, ""],
        ].map(([l, v, s]) => (
          <div key={l as string} style={{ flex: 1, background: "white", padding: "12px 14px", borderRadius: 10, border: "1px solid #E5E7EB", textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.navy }}>{v}</div>
            <div style={{ fontSize: 9, color: C.gray, textTransform: "uppercase", letterSpacing: "0.3px" }}>{l}</div>
            {s ? <div style={{ fontSize: 9, color: C.coral, fontWeight: 700 }}>{s}</div> : null}
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, background: "white", borderRadius: "10px 10px 0 0", borderBottom: "1px solid #E5E7EB" }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: "12px 20px", border: "none", cursor: "pointer", fontSize: 13, background: "transparent", color: tab === key ? C.coral : "#6B7280", borderBottom: tab === key ? `2px solid ${C.coral}` : "2px solid transparent", fontWeight: tab === key ? 700 : 500, fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: 12, padding: "10px 14px", borderRadius: 10, margin: "14px 0" }}>{error}</div>
      )}

      {/* Workflow breadcrumb — visible when on Campaigns / Funnel / Queue */}
      {(tab === "campaigns" || tab === "funnel" || tab === "queue") && (() => {
        const activeAcc = activeAccountId ? accounts.find((a) => a.id === activeAccountId) : null;
        const activeCamp = selectedCampaignId ? campaigns.find((c) => c.id === selectedCampaignId) : null;
        const crumb = (isActive: boolean, label: string, onClick: () => void, disabled = false) => (
          <button
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            style={{ background: "none", border: "none", padding: 0, cursor: disabled ? "default" : "pointer", color: isActive ? C.coral : disabled ? C.gray : C.navy, fontWeight: isActive ? 700 : 500, fontSize: 12, fontFamily: "inherit" }}
          >
            {label}
          </button>
        );
        const sep = <span style={{ color: C.gray, fontSize: 12 }}>›</span>;
        return (
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 0", fontSize: 12 }}>
            {crumb(false, activeAcc ? activeAcc.name : "Accounts", () => setTab("accounts"))}
            {sep}
            {crumb(tab === "campaigns", activeCamp?.name ?? "Campaign", () => setTab("campaigns"))}
            {sep}
            {crumb(tab === "funnel", "Funnel", () => selectedCampaignId && setTab("funnel"), !selectedCampaignId)}
            {sep}
            {crumb(tab === "queue", "Queue", () => selectedCampaignId && setTab("queue"), !selectedCampaignId)}
          </div>
        );
      })()}

      {/* Tab content */}
      <div style={{ minHeight: 480, padding: "16px 0" }}>
        {tab === "accounts" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
            {accounts.map((acc) => (
              <AccountCard key={acc.id} acc={acc} selected={selectedAccId === acc.id} onSelect={() => setSelectedAccId(acc.id)} onRunCampaign={(id) => { setSelectedAccId(id); setActiveAccountId(id); setSelectedCampaignId(null); setTab("campaigns"); window.scrollTo({ top: 0, behavior: "smooth" }); }} onSettings={(id) => setSettingsId(id)} onRescrape={handleRescrape} onDelete={handleDeleteAccount} usage={usage[acc.id]} rescrapingId={rescrapingId} />
            ))}
            {!loading && <AddAccountCard onAdd={handleAddAccount} scraping={scraping} />}
          </div>
        )}

        {tab === "campaigns" && (() => {
          const activeAcc = activeAccountId ? accounts.find((a) => a.id === activeAccountId) : null;
          const scopedCampaigns = activeAccountId ? campaigns.filter((c) => c.accountId === activeAccountId) : campaigns;
          const shouldShowPicker = !!activeAcc && scopedCampaigns.length > 0 && !showNewCampaignForm && !selectedCampaignId;
          const shouldShowForm = !activeAcc || showNewCampaignForm || scopedCampaigns.length === 0;
          return (
          <div>
            {activeAcc && (
              <div style={{ marginBottom: 14, padding: "10px 16px", background: C.navy, color: "white", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13 }}>
                  Running as <span style={{ fontWeight: 700 }}>{activeAcc.name}</span>
                </div>
                <button onClick={() => { setActiveAccountId(null); setShowNewCampaignForm(false); }} style={{ background: "none", border: "none", color: C.coral, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                  change
                </button>
              </div>
            )}

            {shouldShowPicker && (
              <div style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <button onClick={() => setShowNewCampaignForm(true)} style={{ padding: 20, borderRadius: 12, border: `2px solid ${C.coral}`, background: "white", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.coral }}>+ New Campaign</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                    Start a fresh sequence for {activeAcc!.name}.
                  </div>
                </button>
                <button onClick={() => { setSelectedCampaignId(scopedCampaigns[0].id); setTab("queue"); }} style={{ padding: 20, borderRadius: 12, border: `2px solid ${C.navy}`, background: "white", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>▶ Continue {scopedCampaigns[0].name}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                    Resume most recent campaign ({scopedCampaigns.length} total).
                  </div>
                </button>
              </div>
            )}

            {shouldShowForm && (
            <div style={{ marginBottom: 16, padding: "14px 18px", background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.navy, marginBottom: 12 }}>New Campaign</div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 4 }}>Campaign name</div>
                  <input value={campName} onChange={(e) => setCampName(e.target.value)} style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 4 }}>From account</div>
                  <select value={selectedAccId ?? ""} onChange={(e) => setSelectedAccId(e.target.value)} style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box", background: "white" }}>
                    <option value="">Select account…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 4 }}>Funnel steps</div>
                  <div style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, background: "#F8F9FB", color: C.navy, fontWeight: 600 }}>{funnelSteps.length} steps configured</div>
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 6 }}>Lead source</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {SOURCES.map((s) => (
                  <button key={s.id} onClick={() => setSelSource(s.id)} style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${selSource === s.id ? C.coral : "#E5E7EB"}`, background: selSource === s.id ? "#FFF1ED" : "white", color: selSource === s.id ? C.coral : "#374151", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {s.icon} {s.label} <span style={{ color: C.gray, fontSize: 9, marginLeft: 4 }}>{s.cost}</span>
                  </button>
                ))}
              </div>
              <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Paste LinkedIn URL (company page, post, search, etc.)" style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={launchCampaign} disabled={!selectedAccId || !campName.trim() || launching} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: selectedAccId && campName.trim() && !launching ? C.coral : "#F3F4F6", color: selectedAccId && campName.trim() && !launching ? "white" : C.gray, fontWeight: 700, fontSize: 12, cursor: selectedAccId && !launching ? "pointer" : "default", fontFamily: "inherit" }}>
                  {launching ? "Launching…" : "Launch Campaign →"}
                </button>
                <span style={{ fontSize: 10, color: C.gray, alignSelf: "center" }}>Once launched, go to Queue and click Discover Prospects.</span>
              </div>
            </div>
            )}

            <div style={{ fontWeight: 700, fontSize: 13, color: C.navy, marginBottom: 10 }}>Existing Campaigns</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 12 }}>
              {campaigns.map((c) => (
                <div key={c.id} onClick={() => { setSelectedCampaignId(c.id); setTab("queue"); }} style={{ background: "white", borderRadius: 12, padding: "14px 16px", border: `2px solid ${selectedCampaignId === c.id ? C.coral : "#E5E7EB"}`, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.navy, flex: 1, paddingRight: 8 }}>{c.name}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: c.status === "active" ? "#F0FDF4" : "#F3F4F6", color: c.status === "active" ? "#15803D" : "#6B7280", textTransform: "uppercase" }}>{c.status}</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteCampaign(c.id); }} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "0 4px" }} aria-label="Delete campaign">×</button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                    {[["Prospects", c.prospects], ["In Seq", c.inSequence], ["Replied", c.replied], ["Meetings", c.meetings]].map(([l, v]) => (
                      <div key={l as string} style={{ textAlign: "center", background: "#F8F9FB", padding: "6px", borderRadius: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>{v}</div>
                        <div style={{ fontSize: 9, color: C.gray, textTransform: "uppercase" }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: C.gray, marginTop: 8 }}>Source: {c.source} · {c.steps} steps · Created {new Date(c.createdAt).toLocaleDateString("en-IN")}</div>
                </div>
              ))}
              {campaigns.length === 0 && <div style={{ color: C.gray, fontSize: 12, padding: 16 }}>No campaigns yet. Create one above.</div>}
            </div>

            {selectedCampaignId && (
              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setTab("funnel")} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: C.coral, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 6px rgba(255,107,74,0.3)" }}>
                  Next: Build Funnel →
                </button>
              </div>
            )}
          </div>
          );
        })()}

        {tab === "funnel" && (
          <div>
            {!selectedCampaignId ? (
              <div style={{ background: "white", borderRadius: 12, padding: 40, border: "1px solid #E5E7EB", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 6 }}>No campaign selected</div>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>Select or create a campaign to build its outreach funnel.</div>
                <button onClick={() => setTab("campaigns")} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: C.coral, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Go to Campaigns →
                </button>
              </div>
            ) : (
            <>
            {/* Funnel context header */}
            <div style={{ background: "white", borderRadius: 12, padding: "14px 18px", border: "1px solid #E5E7EB", marginBottom: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.3px" }}>Funnel for</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginTop: 2 }}>
                  {campaigns.find((c) => c.id === selectedCampaignId)?.name ?? "—"}
                </div>
              </div>
              <select value={selectedCampaignId ?? ""} onChange={(e) => setSelectedCampaignId(e.target.value || null)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, outline: "none", fontFamily: "inherit", background: "white", minWidth: 200, marginLeft: "auto" }}>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button onClick={saveFunnelToCampaign} disabled={launching} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: !launching ? C.navy : "#F3F4F6", color: !launching ? "white" : C.gray, fontSize: 12, fontWeight: 700, cursor: !launching ? "pointer" : "default", fontFamily: "inherit" }}>
                {launching ? "Saving…" : "💾 Save Funnel"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14 }}>
            {/* Left: step list + action picker */}
            <div>
              <div style={{ background: "white", borderRadius: 12, padding: 14, border: "1px solid #E5E7EB", marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", marginBottom: 10 }}>Add step</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {ACTION_TYPES.map((at) => (
                    <button key={at.id} onClick={() => addFunnelStep(at.id)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E5E7EB", background: at.bg, color: at.fg, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: at.bg, marginRight: 4, textAlign: "center", lineHeight: "14px" }}>{at.icon}</span>
                      {at.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ background: "white", borderRadius: 12, padding: 14, border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase" }}>Sequence ({funnelSteps.length} steps)</div>
                {funnelSteps.map((step, i) => (
                  <ActionBlock key={step.id} step={step} index={i} selected={i === selFunnelStep} onClick={() => setSelFunnelStep(i)} onRemove={() => removeFunnelStep(i)} total={funnelSteps.length} />
                ))}
              </div>
            </div>

            {/* Right: step settings */}
            <div>
              {funnelSteps[selFunnelStep] ? (
                <StepSettings step={funnelSteps[selFunnelStep]} onChange={(patch) => updateFunnelStep(selFunnelStep, patch)} />
              ) : (
                <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #E5E7EB", color: C.gray, fontSize: 12 }}>Select a step to configure.</div>
              )}
            </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={async () => { await saveFunnelToCampaign(); await handleDiscover(); setTab("queue"); }} disabled={launching || discovering} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: !launching && !discovering ? C.coral : "#F3F4F6", color: !launching && !discovering ? "white" : C.gray, fontSize: 13, fontWeight: 700, cursor: !launching && !discovering ? "pointer" : "default", fontFamily: "inherit", boxShadow: "0 2px 6px rgba(255,107,74,0.3)" }}>
                {discovering ? "Discovering…" : launching ? "Saving…" : "Save & Next: Discover Prospects →"}
              </button>
            </div>
            </>
            )}
          </div>
        )}

        {tab === "queue" && (
          <div>
            {/* Status stats strip */}
            {selectedCampaignId && prospects.length > 0 && (() => {
              const pendingCt = prospects.filter((p) => p.status === "pending").length;
              const inSeqCt = prospects.filter((p) => p.status === "in_sequence").length;
              const repliedCt = prospects.filter((p) => p.status === "replied").length;
              const meetingCt = prospects.filter((p) => p.status === "meeting").length;
              const optedCt = prospects.filter((p) => p.status === "opted_out").length;
              const pill = (bg: string, bd: string, fg: string, icon: string, n: number, lbl: string) => (
                <span style={{ padding: "5px 12px", borderRadius: 20, background: bg, border: `1px solid ${bd}`, color: fg, fontSize: 12, fontWeight: 600 }}>
                  {icon} {n} {lbl}
                </span>
              );
              return (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {pill("#FEF3C7", "#FCD34D", "#92400E", "🟡", pendingCt, "pending")}
                  {pill("#DBEAFE", "#93C5FD", "#1E40AF", "🔵", inSeqCt, "in sequence")}
                  {pill("#D1FAE5", "#6EE7B7", "#065F46", "🟢", repliedCt, "replied")}
                  {pill("#FCE7F3", "#F9A8D4", "#9D174D", "🤝", meetingCt, "meetings")}
                  {pill("#FEE2E2", "#FCA5A5", "#991B1B", "⛔", optedCt, "opted out")}
                </div>
              );
            })()}
            {/* Campaign picker + discover */}
            <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", border: "1px solid #E5E7EB", marginBottom: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase" }}>Campaign</div>
              <select value={selectedCampaignId ?? ""} onChange={(e) => setSelectedCampaignId(e.target.value || null)} style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, outline: "none", fontFamily: "inherit", background: "white", minWidth: 260 }}>
                <option value="">Select campaign…</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.prospects} prospects)</option>
                ))}
              </select>
              {(() => {
                const camp = campaigns.find((c) => c.id === selectedCampaignId);
                const canDiscover = camp ? AUTOMATED_SOURCE_IDS.has(camp.source) : false;
                const discoverDisabled = !selectedCampaignId || discovering || !canDiscover;
                return (
                  <button
                    onClick={handleDiscover}
                    disabled={discoverDisabled}
                    title={canDiscover ? "" : "This source type is not automated — use Import CSV / URLs instead."}
                    style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: !discoverDisabled ? C.navy : "#F3F4F6", color: !discoverDisabled ? "white" : C.gray, fontSize: 12, fontWeight: 700, cursor: !discoverDisabled ? "pointer" : "not-allowed", fontFamily: "inherit" }}
                  >
                    {discovering ? "⏳ Discovering via Apify…" : canDiscover ? "🔍 Discover Prospects" : "🔍 Discover (manual source)"}
                  </button>
                );
              })()}
              <button onClick={() => setShowImport(true)} disabled={!selectedCampaignId} style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid ${selectedCampaignId ? C.navy : "#E5E7EB"}`, background: "white", color: selectedCampaignId ? C.navy : C.gray, fontSize: 12, fontWeight: 700, cursor: selectedCampaignId ? "pointer" : "default", fontFamily: "inherit" }}>
                📁 Import CSV / URLs
              </button>
              <span style={{ fontSize: 10, color: C.gray, marginLeft: "auto" }}>{prospects.length} prospect{prospects.length === 1 ? "" : "s"} in this campaign</span>
            </div>

            <div style={{ display: "flex", gap: 14, minHeight: 520 }}>
            {/* Left: prospect list */}
            <div style={{ width: 340, background: "white", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {(["all", "pending", "in_sequence", "replied", "meeting", "opted_out"] as const).map((f) => (
                    <button key={f} onClick={() => setFilterStatus(f)} style={{ padding: "3px 9px", borderRadius: 20, border: "1px solid", borderColor: filterStatus === f ? C.navy : "#E5E7EB", background: filterStatus === f ? C.navy : "transparent", color: filterStatus === f ? "white" : "#6B7280", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                      {f.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {filteredProspects.map((p) => (
                  <ProspectRow key={p.id} p={p} selected={selectedPros?.id === p.id} onClick={() => { setSelectedPros(p); setMsgDraft(""); }} />
                ))}
                {filteredProspects.length === 0 && selectedCampaignId && prospects.length === 0 && (
                  <div style={{ padding: 28, textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.navy, marginBottom: 4 }}>
                      This campaign has no prospects yet
                    </div>
                    <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.5 }}>
                      Click <strong>🔍 Discover Prospects</strong> (Apify) or <strong>📁 Import CSV / URLs</strong> above.
                    </div>
                  </div>
                )}
                {filteredProspects.length === 0 && prospects.length > 0 && (
                  <div style={{ padding: 24, textAlign: "center", color: C.gray, fontSize: 12 }}>
                    No prospects match &ldquo;{filterStatus.replace("_", " ")}&rdquo; filter. Try &ldquo;All&rdquo;.
                  </div>
                )}
                {filteredProspects.length === 0 && !selectedCampaignId && (
                  <div style={{ padding: 24, textAlign: "center", color: C.gray, fontSize: 12 }}>
                    Pick a campaign above to see prospects.
                  </div>
                )}
              </div>
              <div style={{ padding: "8px 14px", borderTop: "1px solid #F3F4F6", fontSize: 10, color: C.gray }}>
                {filteredProspects.length} of {prospects.length} prospects
              </div>
            </div>

            {/* Right: prospect detail */}
            <div style={{ flex: 1 }}>
              {selectedPros ? (
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: C.navy }}>{selectedPros.name}</div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{selectedPros.headline}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Score v={selectedPros.score} />
                      <select value={selectedPros.status} onChange={(e) => updateProsStatus(selectedPros.id, e.target.value as ProspectStatus)} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #E5E7EB", fontSize: 11, fontFamily: "inherit" }}>
                        {(Object.keys(STATUS_CFG) as ProspectStatus[]).map((k) => (
                          <option key={k} value={k}>{STATUS_CFG[k].label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Step selector */}
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                    {funnelSteps.map((_, i) => (
                      <button key={i} onClick={() => handleGenMsg(selectedPros, i)} style={{ padding: "4px 9px", borderRadius: 20, border: `1px solid ${i === selectedPros.step ? C.coral : "#E5E7EB"}`, background: i === selectedPros.step ? "#FFF1ED" : "transparent", color: i === selectedPros.step ? C.coral : C.gray, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        Step {i + 1}
                      </button>
                    ))}
                  </div>

                  <textarea value={msgDraft} onChange={(e) => setMsgDraft(e.target.value)} rows={7} placeholder={generating ? "✨ Personalising message…" : "Click a Step number above to generate a personalised message for this prospect…"} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${generating ? C.coral : "#E5E7EB"}`, fontSize: 13, lineHeight: 1.6, color: "#1F2937", fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box", transition: "border-color 0.2s" }} />

                  <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                    <button
                      disabled={!msgDraft || generating}
                      onClick={() => handleSendAdvance(selectedPros)}
                      title="Marks this step as sent and advances the prospect. You still need to paste the message into LinkedIn manually — LinkedIn has no public send API."
                      style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: msgDraft && !generating ? C.coral : "#F3F4F6", color: msgDraft && !generating ? "white" : C.gray, fontWeight: 700, fontSize: 12, cursor: msgDraft && !generating ? "pointer" : "default", fontFamily: "inherit" }}
                    >
                      ✓ Mark Sent & Advance
                    </button>
                    {msgDraft && (
                      <button onClick={() => navigator.clipboard?.writeText(msgDraft)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Copy</button>
                    )}
                    <span style={{ fontSize: 10, color: C.gray, marginLeft: "auto" }}>{msgDraft.length} chars</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
                    {[
                      ["Company", selectedPros.company],
                      ["Industry", selectedPros.industry],
                      ["Location", selectedPros.location],
                      ["Email", selectedPros.email || "—"],
                      ["Score", `${selectedPros.score}%`],
                      ["Step", `${selectedPros.step} / ${funnelSteps.length}`],
                      ["Status", STATUS_CFG[selectedPros.status].label],
                      ["Last Action", timeAgo(selectedPros.lastAction)],
                    ].map(([l, v]) => (
                      <div key={l} style={{ padding: "8px 10px", background: "#F8F9FB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 3 }}>{l}</div>
                        <div style={{ fontSize: 11, color: C.navy, fontWeight: 500 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 40, textAlign: "center", color: C.gray, fontSize: 13 }}>
                  {selectedCampaignId ? "Select a prospect to view details & compose messages" : "Pick a campaign above to see prospects."}
                </div>
              )}
            </div>
            </div>

            {selectedCampaignId && (
              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setTab("analytics")} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: C.coral, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 6px rgba(255,107,74,0.3)" }}>
                  Next: View Analytics →
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "analytics" && (
          <div>
            <button onClick={() => setTab("queue")} style={{ marginBottom: 14, background: "none", border: "none", color: C.navy, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
              ← Back to Queue
            </button>
            <AnalyticsView prospects={prospects} campaigns={campaigns} />
          </div>
        )}
      </div>

      {/* Activity log (only on Accounts tab) */}
      {tab === "accounts" && (
        <div style={{ background: C.navy, borderRadius: 12, padding: "12px 16px", fontFamily: "monospace", fontSize: 11, maxHeight: 150, overflowY: "auto", marginTop: 16 }}>
          <div style={{ color: "#4ADE80", fontWeight: 700, marginBottom: 8, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>Activity Log</div>
          {log.length === 0 && <div style={{ color: "rgba(255,255,255,0.4)" }}>No activity yet.</div>}
          {log.map((l) => (
            <div key={l.id} style={{ marginBottom: 3, color: l.type === "success" ? "#4ADE80" : l.type === "warn" ? "#FBBF24" : l.type === "error" ? "#F87171" : "rgba(255,255,255,0.6)" }}>
              <span style={{ color: "rgba(255,255,255,0.25)" }}>{fmtClock(l.created_at)} </span>
              {l.message}
            </div>
          ))}
        </div>
      )}

      {/* Selected account context — small bar on non-accounts tabs */}
      {selectedAcc && tab !== "accounts" && (
        <div style={{ position: "sticky", bottom: 0, background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", marginTop: 14, fontSize: 11, color: "#374151", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase" }}>Running from</span>
          <span style={{ fontWeight: 700, color: C.navy }}>{selectedAcc.name}</span>
          <span style={{ color: C.gray }}>· {selectedAcc.type === "company" ? "Company page" : "Personal"}</span>
          <span style={{ marginLeft: "auto", color: C.gray }}>
            {selectedAcc.working_hours.from}–{selectedAcc.working_hours.to} IST · {selectedAcc.working_hours.days.join(" · ")}
          </span>
        </div>
      )}
    </div>
  );
}
