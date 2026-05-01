"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Loader2, MessageSquare, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlowCard } from "./GlowCard";

interface TrackedPrompt {
  id: string;
  org_id: string;
  brand_name: string;
  prompt: string;
  frequency_days: number;
  last_scanned_at: string | null;
  last_score: number | null;
  drop_alert_threshold: number;
  paused: boolean;
  created_at: string;
  updated_at: string;
}

type PatchFields = Partial<Pick<TrackedPrompt, "paused" | "frequency_days" | "drop_alert_threshold">>;

interface ListResponse { data?: { items?: TrackedPrompt[] }; error?: string }
interface HistoryResponse { data?: { prompts?: Array<{ prompt: string; trendData?: number[] }> } }

const FREQS = [1, 3, 7, 14] as const;
const THRESHOLDS = [5, 10, 15, 25] as const;

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "never";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function scoreCls(s: number | null): string {
  if (s === null) return "bg-foreground-tertiary/15 text-foreground-tertiary";
  if (s >= 70) return "bg-emerald-500/15 text-emerald-500";
  if (s >= 40) return "bg-amber-500/15 text-amber-500";
  return "bg-red-500/15 text-red-500";
}

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <span className="text-[10px] text-foreground-tertiary">—</span>;
  const w = 60, h = 20;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-accent">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface TrackedPromptsTabProps { brandName: string; onRunScan?: () => void }

export default function TrackedPromptsTab({ brandName, onRunScan }: TrackedPromptsTabProps) {
  const [items, setItems] = useState<TrackedPrompt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [trendMap, setTrendMap] = useState<Record<string, number[]>>({});

  const setBusy = useCallback((id: string, on: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/xapi/searchlens/tracked-prompts", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ListResponse;
      setItems(json.data?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tracked prompts");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadItems(); }, [loadItems]);

  useEffect(() => {
    if (!items || items.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/xapi/searchlens/history?limit=10", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as HistoryResponse;
        const map: Record<string, number[]> = {};
        for (const p of json.data?.prompts ?? []) {
          if (p.prompt && Array.isArray(p.trendData)) map[p.prompt] = p.trendData;
        }
        if (!cancelled) setTrendMap(map);
      } catch { /* history optional */ }
    })();
    return () => { cancelled = true; };
  }, [items]);

  const handlePatch = useCallback(async (id: string, patch: PatchFields) => {
    setBusy(id, true);
    try {
      const res = await fetch("/xapi/searchlens/tracked-prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev ? prev.map((it) => (it.id === id ? { ...it, ...patch } : it)) : prev);
    } catch { /* swallow */ } finally { setBusy(id, false); }
  }, [setBusy]);

  const handleDelete = useCallback(async (id: string) => {
    setBusy(id, true);
    try {
      const res = await fetch("/xapi/searchlens/tracked-prompts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev ? prev.filter((it) => it.id !== id) : prev);
    } catch { /* swallow */ } finally { setBusy(id, false); }
  }, [setBusy]);

  const headerNote = useMemo(() => {
    if (!items || items.length === 0) return null;
    const freqs = Array.from(new Set(items.map((i) => i.frequency_days))).sort((a, b) => a - b);
    const label = freqs.length === 1 ? `${freqs[0]}d` : `${freqs[0]}–${freqs[freqs.length - 1]}d`;
    return `Tracked prompts refresh automatically every ${label}.`;
  }, [items]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-foreground-tertiary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading tracked prompts…
      </div>
    );
  }

  if (error && (!items || items.length === 0)) {
    return (
      <GlowCard className="text-center">
        <div className="text-[13px] text-foreground">Could not load tracked prompts</div>
        <div className="mt-1 text-[12px] text-foreground-tertiary">{error}</div>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => void loadItems()}>Retry</Button>
      </GlowCard>
    );
  }

  if (!items || items.length === 0) {
    return (
      <GlowCard className="text-center">
        <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
          <MessageSquare className="h-5 w-5 text-accent" strokeWidth={1.8} />
        </div>
        <h3 className="mb-1 text-[14px] font-semibold text-foreground">No prompts tracked yet</h3>
        <p className="mx-auto mb-3 max-w-md text-[12px] leading-relaxed text-foreground-tertiary">
          Mark prompts on the Prompts tab to start daily monitoring{brandName ? ` for ${brandName}` : ""}.
        </p>
        {onRunScan && (
          <Button size="sm" className="bg-accent text-white hover:bg-accent/90" onClick={onRunScan}>
            Go to Prompts
          </Button>
        )}
      </GlowCard>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground">Tracked Prompts</span>
        {headerNote && <span className="text-[11px] text-foreground-tertiary">{headerNote}</span>}
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const trend = trendMap[item.prompt] ?? [];
          const busy = busyIds.has(item.id);
          const freqLabel = item.frequency_days === 1 ? "Daily" : `Every ${item.frequency_days}d`;
          return (
            <GlowCard key={item.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-snug text-foreground">{item.prompt}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-tertiary">
                    <span>Last scan {timeAgo(item.last_scanned_at)}</span>
                    <span className="text-foreground-tertiary/50">•</span>
                    <span>{freqLabel}</span>
                    {item.paused && (<><span className="text-foreground-tertiary/50">•</span><span className="text-amber-500">Paused</span></>)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <MiniSparkline data={trend} />
                  <span className={`rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums ${scoreCls(item.last_score)}`}>
                    {item.last_score ?? "—"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <label className="flex items-center gap-1.5 text-foreground-tertiary">
                  <Activity className="h-3 w-3" strokeWidth={1.8} /> Frequency
                  <select
                    aria-label="Frequency in days"
                    className="rounded border border-divider bg-background-secondary px-1.5 py-0.5 text-[11px] text-foreground outline-none disabled:opacity-50"
                    value={item.frequency_days} disabled={busy}
                    onChange={(e) => void handlePatch(item.id, { frequency_days: Number(e.target.value) })}
                  >
                    {FREQS.map((d) => (<option key={d} value={d}>{d === 1 ? "Daily" : `Every ${d}d`}</option>))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-foreground-tertiary">
                  Alert on −
                  <select
                    aria-label="Drop alert threshold"
                    className="rounded border border-divider bg-background-secondary px-1.5 py-0.5 text-[11px] text-foreground outline-none disabled:opacity-50"
                    value={item.drop_alert_threshold} disabled={busy}
                    onChange={(e) => void handlePatch(item.id, { drop_alert_threshold: Number(e.target.value) })}
                  >
                    {THRESHOLDS.map((t) => (<option key={t} value={t}>{t}%</option>))}
                  </select>
                </label>
                <div className="ml-auto flex items-center gap-1.5">
                  <Button size="sm" variant="outline" disabled={busy}
                    onClick={() => void handlePatch(item.id, { paused: !item.paused })}>
                    {item.paused
                      ? <Play className="h-3 w-3" data-icon="inline-start" strokeWidth={2} />
                      : <Pause className="h-3 w-3" data-icon="inline-start" strokeWidth={2} />}
                    {item.paused ? "Resume" : "Pause"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy}
                    onClick={() => void handleDelete(item.id)} aria-label="Delete tracked prompt">
                    <Trash2 className="h-3 w-3 text-red-500" strokeWidth={2} />
                  </Button>
                </div>
              </div>
            </GlowCard>
          );
        })}
      </div>
    </div>
  );
}
