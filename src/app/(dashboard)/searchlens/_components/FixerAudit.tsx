"use client";

// Audit panel — POST /xapi/searchlens/fix/audit with a URL, render a 5-signal
// scorecard. Each row links to the matching generator so the user can fix it
// inline.

import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, XCircle, ArrowRight } from "lucide-react";
import type { FixKind } from "@/lib/searchlens/fix-types";

interface AuditResult {
  signal: string;
  status: "pass" | "fail" | "partial" | "unknown";
  details: Record<string, unknown>;
  recommends: FixKind | null;
}

interface Report {
  site_url: string;
  origin: string;
  score: number;
  results: AuditResult[];
  generated_at: string;
}

const SIGNAL_LABEL: Record<string, string> = {
  llms_txt_present: "llms.txt present",
  robots_ai_rules: "robots.txt AI rules",
  faq_schema: "FAQ JSON-LD",
  answer_block: "Citable answer block",
  meta_quality: "Title + meta quality",
};

const STATUS_ICON: Record<AuditResult["status"], { Icon: typeof CheckCircle2; cls: string }> = {
  pass: { Icon: CheckCircle2, cls: "text-emerald-500" },
  partial: { Icon: AlertCircle, cls: "text-amber-500" },
  fail: { Icon: XCircle, cls: "text-rose-500" },
  unknown: { Icon: AlertCircle, cls: "text-foreground-tertiary" },
};

export function FixerAudit({ onJumpTo }: { onJumpTo: (kind: FixKind) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/xapi/searchlens/fix/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const j = (await r.json()) as { data?: { report: Report }; error?: string };
      if (!r.ok || !j.data) throw new Error(j.error ?? "Audit failed");
      setReport(j.data.report);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="example.com or https://example.com"
          className="flex-1 h-9 px-3 rounded-lg border border-divider bg-background text-[12.5px] text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:border-accent"
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || !url.trim()}
          className="h-9 px-3 rounded-lg bg-accent text-white text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Run audit
        </button>
      </div>

      {error && (
        <div className="text-[11.5px] text-rose-500 px-2">{error}</div>
      )}

      {report && (
        <>
          <div className="flex items-baseline justify-between border-b border-divider pb-2">
            <div className="text-[11px] text-foreground-tertiary">{report.origin}</div>
            <div className="text-[13px] font-semibold text-foreground">
              GEO score <span className="text-accent">{report.score}</span>
              <span className="text-foreground-tertiary"> / 5</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {report.results.map((r) => {
              const { Icon, cls } = STATUS_ICON[r.status];
              return (
                <div key={r.signal} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-foreground/5">
                  <Icon className={`w-4 h-4 ${cls}`} strokeWidth={2} />
                  <div className="flex-1 text-[12px] text-foreground">{SIGNAL_LABEL[r.signal] ?? r.signal}</div>
                  <div className="text-[10.5px] uppercase tracking-wider text-foreground-tertiary">{r.status}</div>
                  {r.recommends && (
                    <button
                      type="button"
                      onClick={() => onJumpTo(r.recommends!)}
                      className="inline-flex items-center gap-0.5 text-[11px] text-accent hover:underline"
                    >
                      Fix <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
