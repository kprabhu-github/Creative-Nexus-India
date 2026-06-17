"use client";

// History panel — lists past fix artifacts, click to re-open in the output
// pane. Subscribes to realtime so new artifacts from other tabs appear here.

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FixArtifact } from "@/lib/searchlens/fix-types";
import { FIX_KIND_LABEL } from "@/lib/searchlens/fix-types";

interface Props {
  onPick: (a: FixArtifact) => void;
}

export function FixerHistory({ onPick }: Props) {
  const qc = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const histQ = useQuery({
    queryKey: ["fix-history"],
    queryFn: async (): Promise<FixArtifact[]> => {
      const res = await fetch("/xapi/searchlens/fix/history?limit=50", {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        data?: { artifacts: FixArtifact[] };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data?.artifacts ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("fix-history-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ais_fix_artifacts" },
        () => qc.invalidateQueries({ queryKey: ["fix-history"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (histQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-4 h-4 animate-spin text-foreground-tertiary" />
      </div>
    );
  }
  if ((histQ.data ?? []).length === 0) {
    return (
      <p className="px-2 py-4 text-[12px] text-foreground-tertiary">
        No artifacts yet. Generate one from another tab.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-divider">
      {(histQ.data ?? []).map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => onPick(a)}
            className="w-full text-left px-2 py-2 hover:bg-foreground/[0.04] transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium text-foreground truncate">
                {a.title}
              </span>
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-foreground/5 text-foreground-secondary">
                {FIX_KIND_LABEL[a.kind]}
              </span>
            </div>
            <div className="text-[10.5px] text-foreground-tertiary mt-0.5 truncate">
              {a.source_url ?? "—"} ·{" "}
              {new Date(a.created_at).toLocaleString("en-IN", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
