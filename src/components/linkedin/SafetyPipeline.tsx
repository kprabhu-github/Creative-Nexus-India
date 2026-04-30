"use client";

// ---------------------------------------------------------------------------
// SafetyPipeline — visual stack of the 10 safety checkpoints.
//
// Fetches /api/linkedin/safety-preview with (account_id, action_key,
// profile_url). Re-fetches whenever any input changes. Shows pass / warn /
// fail / skip per checkpoint with a summary bar and each checkpoint's hint.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";

export type CheckpointStatus = "pass" | "warn" | "fail" | "skip";
export type PipelineDecision = "allow" | "warn" | "block";

export interface CheckpointResult {
  id: string;
  name: string;
  status: CheckpointStatus;
  message: string;
  hint?: string;
  meta?: Record<string, unknown>;
}

export interface PipelineResult {
  decision: PipelineDecision;
  blocked_by?: string;
  first_warning?: string;
  checkpoints: CheckpointResult[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failures: number;
    skipped: number;
  };
}

interface Props {
  accountId: string | null;
  actionKey: string;
  profileUrl?: string | null;
  onDecisionChange?: (decision: PipelineDecision) => void;
}

const STATUS_GLYPH: Record<CheckpointStatus, string> = {
  pass: "✓",
  warn: "!",
  fail: "×",
  skip: "–",
};

const STATUS_STYLES: Record<CheckpointStatus, string> = {
  pass: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-100 text-amber-700 ring-amber-200",
  fail: "bg-rose-100 text-rose-700 ring-rose-200",
  skip: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function SafetyPipeline({
  accountId,
  actionKey,
  profileUrl,
  onDecisionChange,
}: Props) {
  const [data, setData] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (accountId) params.set("account_id", accountId);
    if (profileUrl) params.set("profile_url", profileUrl);
    params.set("action_key", actionKey);

    fetch(`/xapi/linkedin/safety-preview?${params.toString()}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.error) {
          setError(j.error);
          setData(null);
          return;
        }
        setData(j.data);
        if (onDecisionChange && j.data?.decision) {
          onDecisionChange(j.data.decision);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Preview failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, actionKey, profileUrl, onDecisionChange]);

  if (loading && !data) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-500">
        Running safety pipeline…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
        Safety preview error: {error}
      </div>
    );
  }
  if (!data) return null;

  const headerTone = {
    allow: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warn: "bg-amber-50 text-amber-900 border-amber-300",
    block: "bg-rose-50 text-rose-800 border-rose-300",
  }[data.decision];

  const headerLabel = {
    allow: "All checkpoints clear",
    warn: "Warnings present — allowed with caution",
    block: "Blocked",
  }[data.decision];

  return (
    <div className="space-y-2">
      {/* Summary bar */}
      <div
        className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs font-medium ${headerTone}`}
      >
        <span>Safety pipeline · {headerLabel}</span>
        <span className="tabular-nums">
          {data.summary.passed} pass · {data.summary.warnings} warn ·{" "}
          {data.summary.failures} fail · {data.summary.skipped} skip
        </span>
      </div>

      {/* Checkpoints */}
      <ol className="space-y-1">
        {data.checkpoints.map((c, idx) => (
          <li
            key={c.id}
            className={`flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs ${
              data.blocked_by === c.id ? "ring-2 ring-rose-300" : ""
            }`}
          >
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1 ring-inset ${STATUS_STYLES[c.status]}`}
              aria-label={c.status}
              title={c.status}
            >
              {STATUS_GLYPH[c.status]}
            </span>
            <span className="shrink-0 text-slate-400 tabular-nums">
              {idx + 1}.
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium text-slate-800">{c.name}</span>
                <span className="text-slate-500">{c.message}</span>
              </div>
              {c.hint ? (
                <div className="mt-0.5 text-[11px] italic text-slate-500">
                  {c.hint}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
