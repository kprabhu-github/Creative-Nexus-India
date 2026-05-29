"use client";

// Status pill bar — auto-checks in on mount and lets the user change today's
// status (Present / WFH / Meeting / Away / Sick / Absent / On leave). Mounts
// on /attendance and /dashboard. Realtime via the parent page invalidation.

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Home,
  Video,
  Coffee,
  Thermometer,
  XCircle,
  Plane,
  Loader2,
  Wifi,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import type { AttendanceLog, AttendanceStatus } from "@/lib/hr/types";

const STATUS_META: Array<{
  key: AttendanceStatus;
  label: string;
  Icon: LucideIcon;
  active: string;
  hint?: string;
}> = [
  { key: "present", label: "Present", Icon: CheckCircle2, active: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { key: "wfh", label: "WFH", Icon: Home, active: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  { key: "meeting", label: "Meeting", Icon: Video, active: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  { key: "away", label: "Away", Icon: Coffee, active: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  { key: "sick", label: "Sick", Icon: Thermometer, active: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  { key: "absent", label: "Absent", Icon: XCircle, active: "bg-foreground/10 text-foreground-secondary border-foreground/20" },
  { key: "leave", label: "On leave", Icon: Plane, active: "bg-indigo-500/15 text-indigo-500 border-indigo-500/30" },
];

export function AttendanceStatusBar() {
  const [log, setLog] = useState<AttendanceLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<AttendanceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlinked, setUnlinked] = useState(false);

  // Auto check-in on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/xapi/attendance/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const json = (await res.json().catch(() => ({}))) as {
          data?: { log: AttendanceLog };
          error?: string;
        };
        if (cancelled) return;
        if (res.status === 404 && json.error?.includes("No team member")) {
          setUnlinked(true);
          return;
        }
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setLog(json.data?.log ?? null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const change = async (next: AttendanceStatus) => {
    setSaving(next);
    setError(null);
    try {
      const res = await fetch("/xapi/attendance/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { log: AttendanceLog };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setLog(json.data?.log ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  if (unlinked) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3 text-[12.5px]">
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" strokeWidth={2} />
        <div>
          <p className="font-semibold text-foreground">Attendance disabled for this account</p>
          <p className="mt-0.5 text-foreground-tertiary">
            Your login isn&apos;t linked to a team-member yet. An admin can link
            you from <a href="/team" className="text-accent underline">/team</a>.
          </p>
        </div>
      </div>
    );
  }

  const current = log?.status ?? "present";

  return (
    <div className="rounded-xl border border-divider bg-background-secondary/40 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-foreground-tertiary">
            Today
          </p>
          <p className="text-[13.5px] font-semibold text-foreground">
            {loading
              ? "Checking in…"
              : log
                ? `You're marked ${
                    STATUS_META.find((s) => s.key === current)?.label ??
                    current
                  }`
                : "Not checked in"}
          </p>
        </div>
        {log?.ip_address && (
          <span
            className="inline-flex items-center gap-1 text-[10.5px] text-foreground-tertiary"
            title={`Detected IP ${log.ip_address} · ${new Date(log.checked_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
          >
            <Wifi className="w-3 h-3" strokeWidth={1.8} />
            {log.ip_address}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Attendance status">
        {STATUS_META.map((s) => {
          const isActive = current === s.key;
          const isSaving = saving === s.key;
          return (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => void change(s.key)}
              disabled={isSaving || loading}
              className={[
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[12px] font-medium transition-colors disabled:opacity-50",
                isActive
                  ? s.active
                  : "border-divider text-foreground-secondary hover:border-foreground/20 hover:bg-foreground/5",
              ].join(" ")}
            >
              {isSaving ? (
                <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
              ) : (
                <s.Icon className="w-3 h-3" strokeWidth={2} />
              )}
              {s.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-[11.5px] text-rose-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
