"use client";

import { useCallback, useEffect, useState } from "react";

// ─── CNX brand tokens ──────────────────────────────────────────────────────
const NAVY = "#0B1C3D";
const CORAL = "#FF6B4A";

// ─── Types (match DB schema) ──────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────
function LimitBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(Math.round((used / max) * 100), 100);
  const color = pct > 80 ? CORAL : pct > 50 ? "#F97316" : "#22C55E";
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
        <span style={{ color: "#9CA3AF", textTransform: "capitalize" }}>
          {label.replace(/([A-Z])/g, " $1").toLowerCase()}
        </span>
        <span style={{ fontWeight: 600, color: pct > 80 ? CORAL : "#6B7280" }}>
          {used}/{max}
        </span>
      </div>
      <div style={{ height: 3, background: "#F3F4F6", borderRadius: 2 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Account["status"] }) {
  const map: Record<Account["status"], { bg: string; c: string; dot: string; label: string }> = {
    ready: { bg: "#F0FDF4", c: "#15803D", dot: "#22C55E", label: "Ready" },
    active: { bg: "#EFF6FF", c: "#1D4ED8", dot: "#3B82F6", label: "Running" },
    paused: { bg: "#FFF7ED", c: "#C2410C", dot: "#F97316", label: "Paused" },
  };
  const s = map[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: s.bg,
        color: s.c,
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

function AccountCard({
  acc,
  selected,
  onSelect,
  onSettings,
  onRescrape,
  onDelete,
  usage,
  rescrapingId,
}: {
  acc: Account;
  selected: boolean;
  onSelect: () => void;
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
        border: `2px solid ${selected ? CORAL : "#E5E7EB"}`,
        boxShadow: selected ? `0 0 0 4px ${CORAL}18` : "none",
        overflow: "hidden",
        transition: "all 0.18s",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
      }}
      onClick={onSelect}
    >
      <div
        style={{
          height: 6,
          background: isCompany
            ? `linear-gradient(90deg, ${NAVY} 0%, #2563EB 100%)`
            : `linear-gradient(90deg, ${CORAL} 0%, #FF9A6C 100%)`,
        }}
      />

      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #F3F4F6" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.6px",
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: 20,
                background: isCompany ? "#EFF6FF" : "#FFF1ED",
                color: isCompany ? "#1D4ED8" : CORAL,
              }}
            >
              {isCompany ? "Company Page" : "Personal Profile"}
            </span>
            <StatusPill status={acc.status} />
          </div>
          {selected && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.5px",
                background: CORAL,
                color: "white",
                padding: "2px 8px",
                borderRadius: 20,
              }}
            >
              ACTIVE
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: isCompany ? 12 : "50%",
              border: `2px solid ${selected ? CORAL : "#E5E7EB"}`,
              overflow: "hidden",
              flexShrink: 0,
              background: "#F3F4F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
              color: NAVY,
            }}
          >
            {!imgErr && acc.pic ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={acc.pic}
                alt={acc.name}
                onError={() => setImgErr(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              initials(acc.name)
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: NAVY }}>{acc.name}</span>
              {acc.verified && <span style={{ fontSize: 10, color: "#3B82F6" }}>✓</span>}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#6B7280",
                lineHeight: 1.4,
                marginBottom: 4,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {acc.headline}
            </div>
            <div style={{ fontSize: 10, color: "#9CA3AF" }}>{acc.location}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #F3F4F6" }}>
        {(
          [
            !isCompany && [
              "connections",
              acc.connections?.toLocaleString() ?? "—",
              "Connections",
            ],
            ["followers", acc.followers?.toLocaleString() ?? "—", "Followers"],
            isCompany
              ? ["employees", acc.employee_count ?? "—", "Employees"]
              : ["recommendations", acc.recommendations ?? "—", "Recommendations"],
          ].filter(Boolean) as [string, string | number, string][]
        ).map(([key, val, label]) => (
          <div
            key={key}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "10px 4px",
              borderRight: "1px solid #F3F4F6",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 16, color: NAVY }}>{val}</div>
            <div
              style={{
                fontSize: 9,
                color: "#9CA3AF",
                marginTop: 1,
                textTransform: "uppercase",
                letterSpacing: "0.3px",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #F3F4F6",
          fontSize: 11,
          color: "#374151",
          lineHeight: 1.5,
          background: "#FAFAFA",
        }}
      >
        {acc.role}
      </div>

      <div style={{ padding: "10px 16px", borderBottom: "1px solid #F3F4F6" }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: "0.4px",
            marginBottom: 6,
          }}
        >
          Allowed actions
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {acc.allowed_actions.map((a) => (
            <span
              key={a}
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 20,
                background: "#F0F4FF",
                color: NAVY,
                textTransform: "capitalize",
              }}
            >
              {a.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: "10px 16px", borderBottom: "1px solid #F3F4F6" }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: "0.4px",
            marginBottom: 8,
          }}
        >
          Today&apos;s usage
        </div>
        {Object.entries(lim).map(([k, max]) => (
          <LimitBar key={k} label={k} used={use[k] || 0} max={max} />
        ))}
      </div>

      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid #F3F4F6",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 10, color: "#9CA3AF" }}>Working hours</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: NAVY }}>
          {acc.working_hours.from}–{acc.working_hours.to} IST ·{" "}
          {acc.working_hours.days.slice(0, 3).join(" ")}…
        </span>
      </div>

      <div style={{ padding: "10px 14px", display: "flex", gap: 6, alignItems: "center", marginTop: "auto" }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRescrape(acc.id);
          }}
          disabled={rescraping}
          style={{
            flex: 1,
            padding: "6px 0",
            borderRadius: 8,
            border: "1px solid #E5E7EB",
            background: "transparent",
            color: "#6B7280",
            fontSize: 10,
            fontWeight: 600,
            cursor: rescraping ? "default" : "pointer",
            fontFamily: "inherit",
            opacity: rescraping ? 0.5 : 1,
          }}
        >
          {rescraping ? "Scraping…" : "↺ Re-scrape"}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSettings(acc.id);
          }}
          style={{
            flex: 1,
            padding: "6px 0",
            borderRadius: 8,
            border: "1px solid #E5E7EB",
            background: "transparent",
            color: "#6B7280",
            fontSize: 10,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ⚙ Limits
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Remove ${acc.name} from your LinkedIn accounts?`)) {
              onDelete(acc.id);
            }
          }}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid #FECACA",
            background: "transparent",
            color: "#DC2626",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          aria-label="Delete account"
        >
          ×
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          style={{
            flex: 1,
            padding: "6px 0",
            borderRadius: 8,
            border: "none",
            background: selected ? "#F3F4F6" : NAVY,
            color: selected ? "#9CA3AF" : "white",
            fontSize: 10,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {selected ? "✓ Selected" : "Use Account"}
        </button>
      </div>

      <div style={{ textAlign: "right", padding: "0 14px 8px", fontSize: 9, color: "#9CA3AF" }}>
        Scraped {timeAgo(acc.scraped_at)} via Apify
      </div>
    </div>
  );
}

function AddAccountCard({
  onAdd,
  scraping,
}: {
  onAdd: (url: string, name: string) => void;
  scraping: boolean;
}) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const isPersonal = url.includes("linkedin.com/in/");
  const isCompany = url.includes("linkedin.com/company/");
  const valid = isPersonal || isCompany;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        border: "1.5px dashed #D1D5DB",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "24px 20px",
        minHeight: 340,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "#F3F4F6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          color: "#9CA3AF",
          marginBottom: 10,
        }}
      >
        +
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginBottom: 4 }}>
        Add LinkedIn Account
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#9CA3AF",
          textAlign: "center",
          lineHeight: 1.5,
          marginBottom: 20,
        }}
      >
        Personal profile or company page.
        <br />
        Scraped live via Apify — server-side, no cookies needed.
      </div>

      <div style={{ width: "100%", marginBottom: 10 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: "0.4px",
            marginBottom: 5,
          }}
        >
          Display Name (optional)
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rishabh Kumar"
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #E5E7EB",
            fontSize: 12,
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
            color: NAVY,
          }}
        />
      </div>

      <div style={{ width: "100%", marginBottom: 10 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: "0.4px",
            marginBottom: 5,
          }}
        >
          LinkedIn URL *
        </div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.linkedin.com/in/username/"
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: `1.5px solid ${valid && url ? "#22C55E" : url ? CORAL : "#E5E7EB"}`,
            fontSize: 12,
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
            color: NAVY,
          }}
        />
        {url && (
          <div style={{ fontSize: 10, marginTop: 3, color: valid ? "#15803D" : CORAL }}>
            {valid
              ? `✓ ${isCompany ? "Company page" : "Personal profile"} detected`
              : "⚠ Must be a linkedin.com/in/ or /company/ URL"}
          </div>
        )}
      </div>

      <div
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          background: "#F8F9FB",
          border: "1px solid #F3F4F6",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: "0.4px",
            marginBottom: 4,
          }}
        >
          Examples to add
        </div>
        {(
          [
            ["Rishabh Kumar", "linkedin.com/in/rishabh-kumar-bb076124"],
            ["Tisha Garg", "linkedin.com/in/tishagarg"],
            ["Parshant Hadala", "linkedin.com/in/parshanthadala"],
          ] as [string, string][]
        ).map(([n, u]) => (
          <div
            key={u}
            onClick={() => {
              setUrl(`https://www.${u}`);
              setName(n);
            }}
            style={{
              fontSize: 10,
              color: "#374151",
              cursor: "pointer",
              padding: "2px 0",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span style={{ color: CORAL }}>→</span>
            <span style={{ color: "#6B7280" }}>{n}</span>
            <span style={{ color: "#9CA3AF", fontFamily: "monospace", fontSize: 9 }}>
              {u.split("/in/")[1] || u}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          if (valid) {
            onAdd(url.trim(), name.trim());
            setUrl("");
            setName("");
          }
        }}
        disabled={!valid || scraping}
        style={{
          width: "100%",
          padding: "11px 0",
          borderRadius: 10,
          border: "none",
          cursor: valid && !scraping ? "pointer" : "default",
          background: valid && !scraping ? NAVY : "#F3F4F6",
          color: valid && !scraping ? "white" : "#9CA3AF",
          fontWeight: 700,
          fontSize: 13,
          fontFamily: "inherit",
        }}
      >
        {scraping ? "⏳ Scraping via Apify…" : "Add Account"}
      </button>
    </div>
  );
}

function LimitsModal({
  acc,
  onClose,
  onSave,
  saving,
}: {
  acc: Account;
  onClose: () => void;
  onSave: (id: string, lim: DailyLimits, hrs: WorkingHours) => void;
  saving: boolean;
}) {
  const [lim, setLim] = useState<DailyLimits>({ ...acc.daily_limits });
  const [hrs, setHrs] = useState<WorkingHours>({ ...acc.working_hours });
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: "24px",
          width: 380,
          maxWidth: "90vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, color: NAVY }}>Limits — {acc.name}</div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "#9CA3AF",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#9CA3AF",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
              marginBottom: 10,
            }}
          >
            Daily action limits
          </div>
          {Object.entries(lim).map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <label style={{ fontSize: 12, color: "#374151", textTransform: "capitalize" }}>
                {k.replace(/([A-Z])/g, " $1").toLowerCase()}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  value={v}
                  min={0}
                  max={500}
                  onChange={(e) => setLim((p) => ({ ...p, [k]: Number(e.target.value) }))}
                  style={{
                    width: 64,
                    padding: "5px 8px",
                    borderRadius: 7,
                    border: "1px solid #E5E7EB",
                    fontSize: 12,
                    textAlign: "center",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <span style={{ fontSize: 10, color: "#9CA3AF" }}>/day</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#9CA3AF",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
              marginBottom: 10,
            }}
          >
            Working hours (IST)
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input
              type="time"
              value={hrs.from}
              onChange={(e) => setHrs((p) => ({ ...p, from: e.target.value }))}
              style={{
                flex: 1,
                padding: "7px",
                borderRadius: 7,
                border: "1px solid #E5E7EB",
                fontSize: 12,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <span style={{ color: "#9CA3AF" }}>–</span>
            <input
              type="time"
              value={hrs.to}
              onChange={(e) => setHrs((p) => ({ ...p, to: e.target.value }))}
              style={{
                flex: 1,
                padding: "7px",
                borderRadius: 7,
                border: "1px solid #E5E7EB",
                fontSize: 12,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {DAYS.map((d) => (
              <button
                key={d}
                onClick={() =>
                  setHrs((p) => ({
                    ...p,
                    days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d],
                  }))
                }
                style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: "1px solid",
                  borderColor: hrs.days.includes(d) ? NAVY : "#E5E7EB",
                  background: hrs.days.includes(d) ? NAVY : "transparent",
                  color: hrs.days.includes(d) ? "white" : "#6B7280",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 9,
              border: "1px solid #E5E7EB",
              background: "transparent",
              color: "#374151",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(acc.id, lim, hrs)}
            disabled={saving}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 9,
              border: "none",
              background: NAVY,
              color: "white",
              fontSize: 12,
              fontWeight: 700,
              cursor: saving ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : "Save Limits"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export default function LinkedInPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [rescrapingId, setRescrapingId] = useState<string | null>(null);
  const [savingLimits, setSavingLimits] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [usage, setUsage] = useState<UsageMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/accounts");
      const json = (await res.json()) as {
        data?: { accounts: Account[]; usage: UsageMap };
        error?: string;
      };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setAccounts(json.data?.accounts ?? []);
      setUsage(json.data?.usage ?? {});
      if (!selectedId && json.data && json.data.accounts.length > 0) {
        setSelectedId(json.data.accounts[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    }
  }, [selectedId]);

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

  useEffect(() => {
    (async () => {
      await Promise.all([loadAccounts(), loadLog()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddAccount(url: string, name: string) {
    setScraping(true);
    try {
      const res = await fetch("/api/linkedin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name }),
      });
      const json = (await res.json()) as { data?: Account; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all([loadAccounts(), loadLog()]);
      if (json.data) setSelectedId(json.data.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add account");
    } finally {
      setScraping(false);
    }
  }

  async function handleRescrape(id: string) {
    setRescrapingId(id);
    try {
      const res = await fetch(`/api/linkedin/accounts/${id}/rescrape`, {
        method: "POST",
      });
      const json = (await res.json()) as { data?: Account; error?: string };
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
      const json = (await res.json()) as { data?: Account; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all([loadAccounts(), loadLog()]);
      setSettingsId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save limits");
    } finally {
      setSavingLimits(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/linkedin/accounts/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { data?: { deleted: boolean }; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      await Promise.all([loadAccounts(), loadLog()]);
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const selected = accounts.find((a) => a.id === selectedId) ?? null;
  const settingsAcc = accounts.find((a) => a.id === settingsId) ?? null;

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", color: NAVY }}>
      {settingsAcc && (
        <LimitsModal
          acc={settingsAcc}
          onClose={() => setSettingsId(null)}
          onSave={handleSaveLimits}
          saving={savingLimits}
        />
      )}

      <div style={{ paddingBottom: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 6,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: NAVY,
                margin: 0,
                letterSpacing: "-0.4px",
              }}
            >
              LinkedIn Accounts
            </h1>
            <p style={{ fontSize: 12, color: "#6B7280", margin: "3px 0 0" }}>
              {loading
                ? "Loading accounts…"
                : `${accounts.length} account${accounts.length === 1 ? "" : "s"} configured · ${accounts.filter((a) => a.status === "active").length} running · Scraped live via Apify`}
            </p>
          </div>
          {selected && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#6B7280" }}>Active account</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: CORAL }}>{selected.name}</div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            fontSize: 12,
            padding: "10px 14px",
            borderRadius: 10,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          padding: "6px 0",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
          gap: 16,
        }}
      >
        {accounts.map((acc) => (
          <AccountCard
            key={acc.id}
            acc={acc}
            selected={selectedId === acc.id}
            onSelect={() => setSelectedId(acc.id)}
            onSettings={(id) => setSettingsId(id)}
            onRescrape={handleRescrape}
            onDelete={handleDelete}
            usage={usage[acc.id]}
            rescrapingId={rescrapingId}
          />
        ))}
        {!loading && <AddAccountCard onAdd={handleAddAccount} scraping={scraping} />}
      </div>

      {selected && (
        <div
          style={{
            margin: "16px 0",
            background: "white",
            borderRadius: 12,
            border: "1px solid #E5E7EB",
            padding: "14px 18px",
            display: "flex",
            gap: 24,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: "0.4px",
              }}
            >
              Active account
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: NAVY, marginTop: 2 }}>
              {selected.name}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: "0.4px",
              }}
            >
              LinkedIn URL
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#3B82F6",
                marginTop: 2,
                fontFamily: "monospace",
              }}
            >
              {selected.url.replace("https://www.", "").replace("https://", "")}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: "0.4px",
              }}
            >
              Working hours
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: NAVY, marginTop: 2 }}>
              {selected.working_hours.from}–{selected.working_hours.to} IST ·{" "}
              {selected.working_hours.days.join(" · ")}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: "0.4px",
              }}
            >
              Type
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: NAVY,
                marginTop: 2,
                textTransform: "capitalize",
              }}
            >
              {selected.type === "company" ? "Company Page" : "Personal Profile"}
            </div>
          </div>
          <button
            style={{
              marginLeft: "auto",
              padding: "8px 20px",
              borderRadius: 9,
              border: "none",
              background: CORAL,
              color: "white",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Build Campaign →
          </button>
        </div>
      )}

      <div
        style={{
          background: "#0B1C3D",
          borderRadius: 12,
          padding: "12px 16px",
          fontFamily: "monospace",
          fontSize: 11,
          maxHeight: 180,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            color: "#4ADE80",
            fontWeight: 700,
            marginBottom: 8,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Activity Log
        </div>
        {log.length === 0 && (
          <div style={{ color: "rgba(255,255,255,0.4)" }}>No activity yet.</div>
        )}
        {log.map((l) => (
          <div
            key={l.id}
            style={{
              marginBottom: 3,
              color:
                l.type === "success"
                  ? "#4ADE80"
                  : l.type === "warn"
                    ? "#FBBF24"
                    : l.type === "error"
                      ? "#F87171"
                      : "rgba(255,255,255,0.6)",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.25)" }}>{fmtClock(l.created_at)} </span>
            {l.message}
          </div>
        ))}
      </div>
    </div>
  );
}
