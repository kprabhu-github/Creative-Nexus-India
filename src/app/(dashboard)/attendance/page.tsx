"use client";

// Attendance dashboard. Three blocks:
//   1. AttendanceStatusBar — auto check-in + status pills (per current user)
//   2. My month grid — calendar of the user's status per day this month
//   3. Team today — every active teammate's current status

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Home,
  Video,
  Coffee,
  Thermometer,
  XCircle,
  Plane,
  Circle,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { AttendanceStatusBar } from "@/components/hr/AttendanceStatusBar";
import type { AttendanceLog, AttendanceStatus } from "@/lib/hr/types";
import { ATTENDANCE_LABEL } from "@/lib/hr/types";

const STATUS_ICON: Record<AttendanceStatus, LucideIcon> = {
  present: CheckCircle2,
  wfh: Home,
  meeting: Video,
  away: Coffee,
  sick: Thermometer,
  absent: XCircle,
  leave: Plane,
};

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: "text-emerald-500 bg-emerald-500/10",
  wfh: "text-blue-500 bg-blue-500/10",
  meeting: "text-violet-500 bg-violet-500/10",
  away: "text-amber-500 bg-amber-500/10",
  sick: "text-rose-500 bg-rose-500/10",
  absent: "text-foreground-tertiary bg-foreground/10",
  leave: "text-indigo-500 bg-indigo-500/10",
};

interface TeamTodayRow {
  id: string;
  name: string;
  title: string;
  department: string | null;
  photo_url: string | null;
  log: AttendanceLog | null;
}

export default function AttendancePage() {
  const qc = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const [monthOffset, setMonthOffset] = useState(0);

  const monthAnchor = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);
  const monthIso = useMemo(
    () => `${monthAnchor.getFullYear()}-${String(monthAnchor.getMonth() + 1).padStart(2, "0")}`,
    [monthAnchor],
  );

  const myMonthQ = useQuery({
    queryKey: ["att-me-month", monthIso],
    queryFn: async (): Promise<AttendanceLog[]> => {
      const res = await fetch(`/xapi/attendance/me?month=${monthIso}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        data?: { logs: AttendanceLog[] };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data?.logs ?? [];
    },
  });

  const teamTodayQ = useQuery({
    queryKey: ["att-team-today"],
    queryFn: async (): Promise<TeamTodayRow[]> => {
      const res = await fetch("/xapi/attendance/today", { cache: "no-store" });
      const json = (await res.json()) as {
        data?: { rows: TeamTodayRow[] };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data?.rows ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("att-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hr_attendance_logs" },
        () => {
          qc.invalidateQueries({ queryKey: ["att-me-month"] });
          qc.invalidateQueries({ queryKey: ["att-team-today"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5">
      <PageHeader
        title="Attendance"
        description="Auto check-in on dashboard load with IP capture. Switch status anytime; team view updates live."
      />

      <AttendanceStatusBar />

      {/* My month */}
      <section className="rounded-xl border border-divider bg-background-secondary/40">
        <header className="flex items-center justify-between px-4 py-3 border-b border-divider">
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">My month</h3>
            <p className="text-[11px] text-foreground-tertiary">
              {monthAnchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthOffset((o) => o - 1)}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-foreground-secondary hover:bg-foreground/5"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setMonthOffset(0)}
              disabled={monthOffset === 0}
              className="h-8 px-2.5 rounded-md text-[11.5px] font-medium text-foreground-secondary hover:bg-foreground/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setMonthOffset((o) => o + 1)}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-foreground-secondary hover:bg-foreground/5"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="p-4">
          {myMonthQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-foreground-tertiary" />
            </div>
          ) : (
            <MonthGrid anchor={monthAnchor} logs={myMonthQ.data ?? []} />
          )}
          <MonthLegend />
        </div>
      </section>

      {/* Team today */}
      <section className="rounded-xl border border-divider bg-background-secondary/40">
        <header className="flex items-center justify-between px-4 py-3 border-b border-divider">
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">Team today</h3>
            <p className="text-[11px] text-foreground-tertiary">
              Live status across everyone — updates within ~1s.
            </p>
          </div>
          <span className="text-[11px] text-foreground-tertiary tabular-nums">
            {teamTodayQ.data?.length ?? 0} members
          </span>
        </header>

        <div className="p-2">
          {teamTodayQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-foreground-tertiary" />
            </div>
          ) : (
            <ul className="divide-y divide-divider">
              {(teamTodayQ.data ?? []).map((m) => (
                <TeamTodayItem key={m.id} row={m} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MonthGrid
// ---------------------------------------------------------------------------

function MonthGrid({
  anchor,
  logs,
}: {
  anchor: Date;
  logs: AttendanceLog[];
}) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startDay = first.getDay();

  const byDate = new Map<string, AttendanceLog>();
  for (const l of logs) byDate.set(l.log_date, l);

  const cells: Array<{ key: string; day?: number; iso?: string }> = [];
  for (let i = 0; i < startDay; i++) cells.push({ key: `pad-${i}` });
  for (let d = 1; d <= lastDay; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ key: iso, day: d, iso });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-7 gap-1">
      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
        <div
          key={`dow-${i}`}
          className="text-[10px] font-semibold uppercase tracking-wider text-foreground-tertiary text-center pb-1"
        >
          {d}
        </div>
      ))}
      {cells.map((c) => {
        if (!c.day) return <div key={c.key} className="aspect-square" />;
        const log = byDate.get(c.iso!);
        const StatusIcon = log ? STATUS_ICON[log.status] : Circle;
        const colour = log ? STATUS_COLOR[log.status] : "text-foreground-tertiary/40 bg-background";
        const isToday = c.iso === today;
        return (
          <div
            key={c.key}
            title={
              log
                ? `${ATTENDANCE_LABEL[log.status]} · ${new Date(log.checked_in_at).toLocaleTimeString(
                    "en-IN",
                    { hour: "2-digit", minute: "2-digit" },
                  )}`
                : "No log"
            }
            className={[
              "aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 text-[11px] border",
              colour,
              isToday ? "ring-2 ring-accent/30 border-accent/30" : "border-divider/60",
            ].join(" ")}
          >
            <span className="font-semibold tabular-nums">{c.day}</span>
            <StatusIcon className="w-3 h-3" strokeWidth={2} />
          </div>
        );
      })}
    </div>
  );
}

function MonthLegend() {
  return (
    <div className="mt-3 flex flex-wrap gap-2.5">
      {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((s) => {
        const Icon = STATUS_ICON[s];
        return (
          <span
            key={s}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLOR[s]}`}
          >
            <Icon className="w-2.5 h-2.5" strokeWidth={2} />
            {ATTENDANCE_LABEL[s]}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TeamTodayItem
// ---------------------------------------------------------------------------

function TeamTodayItem({ row }: { row: TeamTodayRow }) {
  const status: AttendanceStatus = row.log?.status ?? "absent";
  const Icon = STATUS_ICON[status];
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      {row.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.photo_url}
          alt={row.name}
          className="w-8 h-8 rounded-full object-cover bg-foreground/10"
        />
      ) : (
        <span className="w-8 h-8 rounded-full bg-foreground/10 inline-flex items-center justify-center text-[10px] font-bold text-foreground-secondary">
          {row.name
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? "")
            .join("")}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-medium text-foreground truncate">
          {row.name}
        </p>
        <p className="text-[10.5px] text-foreground-tertiary truncate">
          {row.title}
          {row.department ? ` · ${row.department}` : ""}
        </p>
      </div>
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[status]}`}
      >
        <Icon className="w-3 h-3" strokeWidth={2} />
        {ATTENDANCE_LABEL[status]}
      </span>
    </li>
  );
}
