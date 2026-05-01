"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { GlowCard } from "./GlowCard";
import { ScoreCountUp } from "./ScoreCountUp";

type CheckStatus = "pass" | "warn" | "fail";

interface AuditCheck {
  id: string;
  label: string;
  status: CheckStatus;
  score: number;
  detail: string;
  remediation?: string;
  raw?: string;
}

interface AuditReport {
  domain: string;
  fetched_at: string;
  overall_score: number;
  checks: AuditCheck[];
}

interface ApiResponse {
  data?: AuditReport;
  error?: string;
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-label="pass" />;
  }
  if (status === "warn") {
    return <AlertTriangle className="h-5 w-5 text-amber-500" aria-label="warn" />;
  }
  return <XCircle className="h-5 w-5 text-red-500" aria-label="fail" />;
}

function CheckRow({ check }: { check: AuditCheck }) {
  const [showFix, setShowFix] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  return (
    <GlowCard className="space-y-2">
      <div className="flex items-start gap-3">
        <StatusIcon status={check.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-semibold text-sm">{check.label}</h4>
            <span className="text-xs text-foreground-tertiary tabular-nums">
              {check.score}/100
            </span>
          </div>
          <p className="text-xs text-foreground-tertiary mt-1">{check.detail}</p>

          <div className="flex items-center gap-3 mt-2">
            {check.remediation && (
              <button
                type="button"
                onClick={() => setShowFix((v) => !v)}
                className="text-xs text-coral hover:opacity-80 inline-flex items-center gap-1"
                aria-expanded={showFix}
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showFix ? "rotate-180" : ""}`}
                />
                How to fix
              </button>
            )}
            {check.raw && (
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="text-xs text-foreground-tertiary hover:text-foreground"
                aria-expanded={showRaw}
              >
                {showRaw ? "Hide raw" : "View raw"}
              </button>
            )}
          </div>

          {showFix && check.remediation && (
            <p className="mt-2 rounded-md bg-white/5 px-3 py-2 text-xs">
              {check.remediation}
            </p>
          )}
          {showRaw && check.raw && (
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-black/40 p-3 text-[10px] leading-relaxed whitespace-pre-wrap break-all">
              {check.raw.slice(0, 500)}
            </pre>
          )}
        </div>
      </div>
    </GlowCard>
  );
}

export default function SiteAuditTab({ domain }: { domain: string }) {
  const [input, setInput] = useState(domain);
  const [activeDomain, setActiveDomain] = useState(domain);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runAudit = useCallback(async (target: string) => {
    if (!target) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/xapi/searchlens/site-audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: target }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.data) {
        throw new Error(json.error ?? `Audit failed (HTTP ${res.status})`);
      }
      setReport(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (domain) {
      setActiveDomain(domain);
      void runAudit(domain);
    }
  }, [domain, runAudit]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!next) return;
    setActiveDomain(next);
    void runAudit(next);
  };

  if (!activeDomain && !loading && !report) {
    return (
      <GlowCard className="text-center py-10">
        <p className="text-sm text-foreground-tertiary mb-4">Enter a domain to run audit</p>
        <form onSubmit={onSubmit} className="flex items-center gap-2 max-w-md mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="example.com"
            className="flex-1 rounded-md border border-divider bg-background-secondary px-3 py-2 text-sm focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Run Audit
          </button>
        </form>
      </GlowCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Search Site Audit</h3>
          <p className="text-xs text-foreground-tertiary">{activeDomain}</p>
        </div>
        <button
          type="button"
          onClick={() => void runAudit(activeDomain)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-divider bg-background-secondary px-3 py-1.5 text-xs hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Re-run audit
        </button>
      </div>

      {loading && (
        <GlowCard>
          <div className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-coral" />
            <p className="text-sm text-foreground-tertiary">
              Running audit on {activeDomain}…
            </p>
          </div>
        </GlowCard>
      )}

      {error && !loading && (
        <GlowCard className="border-red-500/30">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">Audit failed</p>
              <p className="text-xs text-foreground-tertiary mt-1">{error}</p>
              <button
                type="button"
                onClick={() => void runAudit(activeDomain)}
                className="mt-3 rounded-md bg-coral px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                Retry
              </button>
            </div>
          </div>
        </GlowCard>
      )}

      {report && !loading && (
        <>
          <GlowCard glow className="text-center py-8">
            <p className="text-xs uppercase tracking-wider text-foreground-tertiary mb-2">
              Overall AI Crawlability Score
            </p>
            <div className="text-5xl font-bold tabular-nums">
              <ScoreCountUp target={report.overall_score} suffix="/100" />
            </div>
            <p className="text-xs text-foreground-tertiary mt-2">
              Audited {new Date(report.fetched_at).toLocaleString()}
            </p>
          </GlowCard>

          <div className="space-y-3">
            {report.checks.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
