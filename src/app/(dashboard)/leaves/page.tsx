"use client";

// Leaves page: apply form (top) + my history (middle) + admin pending queue
// (bottom). Admin queue auto-shows if there are any pending requests; any
// authenticated user can approve/reject (RBAC tightening lives in a later
// slice — for now the team self-manages).

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  AlertTriangle,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import type {
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  LeaveUrgency,
} from "@/lib/hr/types";
import { LEAVE_TYPES, LEAVE_TYPE_LABEL } from "@/lib/hr/types";

interface LeaveWithMember extends LeaveRequest {
  hr_team_members?: {
    id: string;
    name: string;
    photo_url: string | null;
    title: string;
    department: string | null;
  };
}

const STATUS_TONE: Record<LeaveStatus, string> = {
  pending: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  approved: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
  rejected: "text-rose-500 bg-rose-500/10 border-rose-500/30",
  cancelled: "text-foreground-tertiary bg-foreground/10 border-foreground/20",
};
const STATUS_ICON: Record<LeaveStatus, LucideIcon> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  cancelled: XCircle,
};

const URGENCY_TONE: Record<LeaveUrgency, string> = {
  normal: "text-foreground-tertiary",
  urgent: "text-amber-500",
  emergency: "text-rose-500",
};

const URGENCY_ICON: Record<LeaveUrgency, LucideIcon> = {
  normal: Clock,
  urgent: AlertTriangle,
  emergency: Flame,
};

export default function LeavesPage() {
  const qc = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const myQ = useQuery({
    queryKey: ["leaves", "me"],
    queryFn: () => fetchLeaves("me"),
  });
  const pendingQ = useQuery({
    queryKey: ["leaves", "pending"],
    queryFn: () => fetchLeaves("pending"),
  });

  useEffect(() => {
    const ch = supabase
      .channel("leaves-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hr_leaves" },
        () => {
          qc.invalidateQueries({ queryKey: ["leaves"] });
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
        title="Leaves"
        description="Apply for time off, track your balance, and approve pending requests for the team."
      />

      <ApplyForm
        onSubmitted={() => {
          qc.invalidateQueries({ queryKey: ["leaves"] });
        }}
      />

      {/* Pending queue (admin) */}
      <Section title="Pending approval" count={pendingQ.data?.length ?? 0}>
        {pendingQ.isLoading ? (
          <Loader />
        ) : (pendingQ.data ?? []).length === 0 ? (
          <Empty text="Nothing waiting on approval right now." />
        ) : (
          <ul className="divide-y divide-divider">
            {(pendingQ.data ?? []).map((l) => (
              <LeaveRow key={l.id} leave={l} adminControls />
            ))}
          </ul>
        )}
      </Section>

      {/* My history */}
      <Section title="My requests" count={myQ.data?.length ?? 0}>
        {myQ.isLoading ? (
          <Loader />
        ) : (myQ.data ?? []).length === 0 ? (
          <Empty text="You haven't applied for any leave yet." />
        ) : (
          <ul className="divide-y divide-divider">
            {(myQ.data ?? []).map((l) => (
              <LeaveRow key={l.id} leave={l} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

async function fetchLeaves(scope: "me" | "pending" | "all"): Promise<LeaveWithMember[]> {
  const res = await fetch(`/xapi/leaves?scope=${scope}`, { cache: "no-store" });
  const json = (await res.json()) as {
    data?: { leaves: LeaveWithMember[] };
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data?.leaves ?? [];
}

// ---------------------------------------------------------------------------
// ApplyForm
// ---------------------------------------------------------------------------

function ApplyForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [open, setOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [halfDaySession, setHalfDaySession] = useState<"AM" | "PM">("AM");
  const [urgency, setUrgency] = useState<LeaveUrgency>("normal");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setLeaveType("casual");
    setStartDate("");
    setEndDate("");
    setHalfDay(false);
    setHalfDaySession("AM");
    setUrgency("normal");
    setReason("");
    setError(null);
  };

  const submit = async () => {
    if (!startDate || !endDate) {
      setError("Both start and end dates are required");
      return;
    }
    if (startDate > endDate) {
      setError("Start date must be on or before end date");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/xapi/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          half_day: halfDay,
          half_day_session: halfDay ? halfDaySession : null,
          urgency,
          reason: reason.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      reset();
      setOpen(false);
      onSubmitted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-divider bg-background-secondary/40">
      <header className="flex items-center justify-between px-4 py-3 border-b border-divider">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">Apply for leave</h3>
          <p className="text-[11px] text-foreground-tertiary">
            Casual, sick, earned, emergency, unpaid, WFH, or other.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-accent text-white text-[12.5px] font-semibold hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          {open ? "Hide form" : "New request"}
        </button>
      </header>
      {open && (
        <form
          className="p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Type" required>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                disabled={saving}
                className={inputCls()}
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LEAVE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Urgency">
              <div className="flex items-center gap-1">
                {(["normal", "urgent", "emergency"] as LeaveUrgency[]).map((u) => {
                  const Icon = URGENCY_ICON[u];
                  const active = urgency === u;
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUrgency(u)}
                      disabled={saving}
                      className={[
                        "h-9 flex-1 inline-flex items-center justify-center gap-1 rounded-md border text-[11.5px] font-medium capitalize transition-colors",
                        active
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : `border-divider ${URGENCY_TONE[u]} hover:border-foreground/20`,
                      ].join(" ")}
                    >
                      <Icon className="w-3 h-3" strokeWidth={2} />
                      {u}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Start date" required>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={saving}
                required
                className={inputCls()}
              />
            </Field>
            <Field label="End date" required>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  if (!startDate) setStartDate(e.target.value);
                }}
                disabled={saving}
                required
                className={inputCls()}
              />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-[12px] text-foreground-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={halfDay}
                onChange={(e) => setHalfDay(e.target.checked)}
                disabled={saving}
                className="accent-accent w-3.5 h-3.5"
              />
              Half day
            </label>
            {halfDay && (
              <div className="flex items-center gap-1">
                {(["AM", "PM"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setHalfDaySession(s)}
                    disabled={saving}
                    className={[
                      "h-7 px-2 rounded border text-[11px] font-medium",
                      halfDaySession === s
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-divider text-foreground-secondary",
                    ].join(" ")}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Field label="Reason">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional but recommended for urgent / emergency leaves"
              rows={3}
              disabled={saving}
              className={inputCls("resize-y min-h-[64px]")}
            />
          </Field>

          {error && (
            <p className="text-[12px] text-rose-500" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-divider">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="h-9 px-3 rounded-md text-[12.5px] font-medium text-foreground-secondary hover:bg-foreground/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-md text-[12.5px] font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// LeaveRow
// ---------------------------------------------------------------------------

function LeaveRow({
  leave,
  adminControls,
}: {
  leave: LeaveWithMember;
  adminControls?: boolean;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<null | "approve" | "reject" | "cancel">(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (
    status: "approved" | "rejected" | "cancelled",
    label: "approve" | "reject" | "cancel",
  ) => {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(`/xapi/leaves/${leave.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      qc.invalidateQueries({ queryKey: ["leaves"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const StatusIcon = STATUS_ICON[leave.status];
  const UrgencyIcon = URGENCY_ICON[leave.urgency];
  const member = leave.hr_team_members;

  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-3">
      {member ? (
        member.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.photo_url}
            alt={member.name}
            className="w-8 h-8 rounded-full object-cover bg-foreground/10 shrink-0"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-foreground/10 inline-flex items-center justify-center text-[10px] font-bold text-foreground-secondary shrink-0">
            {member.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")}
          </span>
        )
      ) : (
        <span className="w-8 h-8 rounded-full bg-foreground/10 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-semibold text-foreground">
            {member?.name ?? "Unknown"}
          </span>
          <span className="text-[11px] text-foreground-tertiary capitalize">
            {LEAVE_TYPE_LABEL[leave.leave_type]} leave · {leave.days} {leave.days === 1 ? "day" : "days"}
            {leave.half_day && ` (${leave.half_day_session})`}
          </span>
          {leave.urgency !== "normal" && (
            <span
              className={`inline-flex items-center gap-1 text-[10.5px] font-semibold capitalize ${URGENCY_TONE[leave.urgency]}`}
            >
              <UrgencyIcon className="w-3 h-3" strokeWidth={2} />
              {leave.urgency}
            </span>
          )}
        </div>
        <p className="text-[11px] text-foreground-tertiary mt-0.5 inline-flex items-center gap-1">
          <CalendarDays className="w-3 h-3" strokeWidth={2} />
          {fmtDate(leave.start_date)} → {fmtDate(leave.end_date)}
        </p>
        {leave.reason && (
          <p className="text-[12px] text-foreground-secondary mt-1 line-clamp-2">
            {leave.reason}
          </p>
        )}
        {error && (
          <p className="text-[11px] text-rose-500 mt-1">{error}</p>
        )}
      </div>
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold capitalize border ${STATUS_TONE[leave.status]}`}
      >
        <StatusIcon className="w-3 h-3" strokeWidth={2} />
        {leave.status}
      </span>
      {adminControls && leave.status === "pending" && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void decide("rejected", "reject")}
            disabled={busy !== null}
            className="h-8 px-2.5 rounded-md text-[11.5px] font-medium border border-divider text-foreground-secondary hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 disabled:opacity-40"
          >
            {busy === "reject" ? "…" : "Reject"}
          </button>
          <button
            type="button"
            onClick={() => void decide("approved", "approve")}
            disabled={busy !== null}
            className="h-8 px-3 rounded-md text-[11.5px] font-semibold bg-emerald-500 text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy === "approve" ? "…" : "Approve"}
          </button>
        </div>
      )}
      {!adminControls && leave.status === "pending" && (
        <button
          type="button"
          onClick={() => void decide("cancelled", "cancel")}
          disabled={busy !== null}
          className="h-8 px-2.5 rounded-md text-[11.5px] font-medium border border-divider text-foreground-secondary hover:bg-foreground/5 disabled:opacity-40"
        >
          {busy === "cancel" ? "…" : "Cancel"}
        </button>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-divider bg-background-secondary/40 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-divider">
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        <span className="text-[11px] text-foreground-tertiary tabular-nums">
          {count}
        </span>
      </header>
      <div className="p-2">{children}</div>
    </section>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-5 h-5 animate-spin text-foreground-tertiary" />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="px-3 py-6 text-[12px] text-foreground-tertiary text-center">
      {text}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-foreground-tertiary mb-1">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function inputCls(extra = ""): string {
  return [
    "w-full h-9 px-3 rounded-md border border-input bg-background text-foreground text-[13px]",
    "placeholder:text-foreground-tertiary outline-none transition-all",
    "focus:border-accent/40 focus:ring-2 focus:ring-accent/15",
    "disabled:opacity-50 dark:bg-card",
    extra,
  ].join(" ");
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
