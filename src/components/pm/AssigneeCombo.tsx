"use client";

// Searchable assignee combobox with "Recommended" group at top + "All" group
// below. Uses /xapi/team/recommended?project_id= so the boost reflects the
// project context (project lead, peers already on the project, least busy).
//
// Keyboard: arrows navigate, Enter selects, Esc closes.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Check,
  X,
  User,
  Sparkles,
  ChevronDown,
  UserPlus,
  Loader2,
} from "lucide-react";

export interface AssigneeOption {
  id: string;
  name: string;
  title: string;
  department: string | null;
  photo_url: string | null;
  open_task_count: number;
  recommendation_reason: string | null;
}

interface Props {
  projectId?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  /** Compact = used inside an inline row; full = used in a form */
  variant?: "compact" | "full";
}

interface ApiResponse {
  recommended: AssigneeOption[];
  all: AssigneeOption[];
}

export function AssigneeCombo({
  projectId,
  value,
  onChange,
  disabled,
  variant = "full",
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hoverIdx, setHoverIdx] = useState(0);
  const [addMode, setAddMode] = useState(false);
  const [addingName, setAddingName] = useState("");
  const [addingTitle, setAddingTitle] = useState("");
  const [addingDept, setAddingDept] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const addNameRef = useRef<HTMLInputElement | null>(null);

  const dataQ = useQuery({
    queryKey: ["pm-team-recommended", projectId ?? "none"],
    queryFn: async (): Promise<ApiResponse> => {
      const url = projectId
        ? `/xapi/team/recommended?project_id=${projectId}`
        : "/xapi/team/recommended";
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as { data?: ApiResponse; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data ?? { recommended: [], all: [] };
    },
    enabled: open,
    staleTime: 30_000,
  });

  const selected = useMemo(() => {
    const all = dataQ.data?.all ?? [];
    return value ? all.find((m) => m.id === value) ?? null : null;
  }, [value, dataQ.data]);

  // Filter + group: when there's a query, drop the recommended grouping and
  // show one filtered list. When no query, show two groups.
  const view = useMemo(() => {
    const all = dataQ.data?.all ?? [];
    const rec = dataQ.data?.recommended ?? [];
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      const filtered = all.filter(
        (m) =>
          m.name.toLowerCase().includes(needle) ||
          m.title.toLowerCase().includes(needle) ||
          (m.department ?? "").toLowerCase().includes(needle),
      );
      return { recommended: [] as AssigneeOption[], rest: filtered };
    }
    const recIds = new Set(rec.map((r) => r.id));
    return { recommended: rec, rest: all.filter((m) => !recIds.has(m.id)) };
  }, [q, dataQ.data]);

  const flat = useMemo(
    () => [...view.recommended, ...view.rest],
    [view.recommended, view.rest],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setHoverIdx(0);
      // Defer focus so the popover finishes mounting first.
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setAddMode(false);
      setAddError(null);
    }
  }, [open]);

  useEffect(() => {
    if (addMode) {
      // Prefill name from the current search query so the user doesn't retype.
      if (!addingName) setAddingName(q.trim());
      setTimeout(() => addNameRef.current?.focus(), 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMode]);

  const addTeammate = async () => {
    const name = addingName.trim();
    if (!name) {
      setAddError("Name required");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/xapi/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          title: addingTitle.trim() || "Team member",
          department: addingDept.trim() || null,
          role_tag: "team",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { member: { id: string } };
        error?: string;
      };
      if (!res.ok || !json.data?.member) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      // Invalidate so the new teammate shows in this combo (and elsewhere)
      // and select them immediately.
      await qc.invalidateQueries({ queryKey: ["pm-team-recommended"] });
      await qc.invalidateQueries({ queryKey: ["pm-team-lite"] });
      onChange(json.data.member.id);
      setAddingName("");
      setAddingTitle("");
      setAddingDept("");
      setAddMode(false);
      setOpen(false);
      setQ("");
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoverIdx((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoverIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = flat[hoverIdx];
      if (pick) {
        onChange(pick.id);
        setOpen(false);
        setQ("");
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const TriggerInner = () => {
    if (selected) {
      return (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <Avatar member={selected} size={variant === "compact" ? 18 : 22} />
          <span className="truncate text-foreground">{selected.name}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-foreground-tertiary">
        <User className="w-3.5 h-3.5" strokeWidth={1.8} />
        Unassigned
      </span>
    );
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const isFull = variant === "full";

  return (
    <div
      className={["relative", isFull ? "block w-full" : "inline-block"].join(" ")}
      ref={popRef}
    >
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          "inline-flex items-center gap-1.5 rounded-md border transition-colors disabled:opacity-50",
          isFull
            ? "h-9 w-full justify-between border-input bg-background dark:bg-card px-3 text-[13px]"
            : "h-7 max-w-[200px] border-transparent hover:border-divider bg-transparent px-2 text-[12px]",
          open ? "border-accent/40 ring-2 ring-accent/15" : "",
        ].join(" ")}
      >
        <TriggerInner />
        <span className="ml-auto inline-flex items-center gap-1 shrink-0">
          {selected && !disabled && (
            <span
              role="button"
              onClick={clear}
              className="inline-flex w-4 h-4 items-center justify-center rounded text-foreground-tertiary hover:text-foreground hover:bg-foreground/10"
              aria-label="Clear assignee"
            >
              <X className="w-3 h-3" strokeWidth={2} />
            </span>
          )}
          {isFull && (
            <ChevronDown
              className={`w-3.5 h-3.5 text-foreground-tertiary transition-transform ${open ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          )}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className={[
            // z-[60] keeps the popover above any modal scrim (z-50) it might
            // live inside; bg-background is intentionally opaque so the
            // popover never bleeds the form behind it.
            "absolute z-[60] mt-1 rounded-lg border border-divider bg-background shadow-xl overflow-hidden",
            isFull ? "left-0 right-0" : "right-0 w-[300px]",
          ].join(" ")}
        >
          {/* Search */}
          <div className="relative border-b border-divider">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-tertiary"
              strokeWidth={1.8}
            />
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
              placeholder="Search teammates…"
              aria-label="Search teammates"
              className="w-full h-9 pl-8 pr-3 text-[12.5px] bg-transparent text-foreground placeholder:text-foreground-tertiary outline-none"
            />
          </div>

          <div className="max-h-[280px] overflow-y-auto py-1 min-h-[60px]">
            {dataQ.isLoading && (
              <div className="px-3 py-3 text-[12px] text-foreground-tertiary">
                Loading teammates…
              </div>
            )}
            {dataQ.isError && (
              <div className="px-3 py-3 text-[12px] text-rose-500">
                Failed to load: {(dataQ.error as Error)?.message ?? "unknown"}
              </div>
            )}
            {!dataQ.isLoading && !dataQ.isError && flat.length === 0 && (
              <div className="px-3 py-3 text-[12px] text-foreground-tertiary">
                {q ? `No teammate matches "${q}"` : "No teammates yet"}
              </div>
            )}

            {view.recommended.length > 0 && (
              <GroupLabel
                icon={<Sparkles className="w-3 h-3" strokeWidth={2} />}
                label="Recommended"
              />
            )}
            {view.recommended.map((m, i) => (
              <Row
                key={m.id}
                member={m}
                selected={value === m.id}
                hover={i === hoverIdx}
                onPick={() => {
                  onChange(m.id);
                  setOpen(false);
                  setQ("");
                }}
              />
            ))}

            {view.rest.length > 0 && (
              <GroupLabel label={q ? "Matches" : "All teammates"} />
            )}
            {view.rest.map((m, i) => (
              <Row
                key={m.id}
                member={m}
                selected={value === m.id}
                hover={view.recommended.length + i === hoverIdx}
                onPick={() => {
                  onChange(m.id);
                  setOpen(false);
                  setQ("");
                }}
              />
            ))}
          </div>

          {/* Add-new-teammate footer */}
          <div className="border-t border-divider bg-background-secondary/40">
            {!addMode ? (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setAddMode(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-accent hover:bg-foreground/5 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" strokeWidth={2} />
                Add new teammate{q ? ` "${q}"` : ""}
              </button>
            ) : (
              <div
                className="p-2.5 space-y-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !adding) {
                    e.preventDefault();
                    void addTeammate();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setAddMode(false);
                  }
                }}
              >
                <input
                  ref={addNameRef}
                  type="text"
                  value={addingName}
                  onChange={(e) => setAddingName(e.target.value)}
                  placeholder="Full name *"
                  required
                  disabled={adding}
                  className={inlineInput()}
                />
                <input
                  type="text"
                  value={addingTitle}
                  onChange={(e) => setAddingTitle(e.target.value)}
                  placeholder="Title (e.g. Designer)"
                  disabled={adding}
                  className={inlineInput()}
                />
                <input
                  type="text"
                  value={addingDept}
                  onChange={(e) => setAddingDept(e.target.value)}
                  placeholder="Department (optional)"
                  disabled={adding}
                  className={inlineInput()}
                />
                {addError && (
                  <div className="text-[11px] text-rose-500" role="alert">
                    {addError}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-foreground-tertiary">
                    Enter to save · Esc to cancel
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setAddMode(false);
                      }}
                      disabled={adding}
                      className="h-7 px-2 rounded text-[11px] font-medium text-foreground-secondary hover:bg-foreground/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        void addTeammate();
                      }}
                      disabled={adding || !addingName.trim()}
                      className="h-7 px-2.5 inline-flex items-center gap-1 rounded bg-accent text-white text-[11px] font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      {adding ? (
                        <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
                      ) : null}
                      {adding ? "Saving" : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function inlineInput(): string {
  return [
    "w-full h-7 px-2 rounded border border-input bg-background text-foreground text-[12px]",
    "placeholder:text-foreground-tertiary outline-none transition-all",
    "focus:border-accent/40 focus:ring-2 focus:ring-accent/15",
    "disabled:opacity-50 dark:bg-card",
  ].join(" ");
}

function GroupLabel({
  label,
  icon,
}: {
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-tertiary">
      {icon}
      {label}
    </div>
  );
}

function Row({
  member,
  selected,
  hover,
  onPick,
}: {
  member: AssigneeOption;
  selected: boolean;
  hover: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // mousedown before blur so input doesn't intercept
        e.preventDefault();
        onPick();
      }}
      role="option"
      aria-selected={selected}
      className={[
        "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors",
        hover ? "bg-foreground/5" : "",
        selected ? "bg-accent/10" : "",
      ].join(" ")}
    >
      <Avatar member={member} size={22} />
      <span className="flex-1 min-w-0">
        <span className="block text-[12.5px] font-medium text-foreground truncate">
          {member.name}
        </span>
        <span className="block text-[10.5px] text-foreground-tertiary truncate">
          {member.recommendation_reason ?? member.title}
          {member.open_task_count > 0 && (
            <span className="ml-1 opacity-70">· {member.open_task_count} open</span>
          )}
        </span>
      </span>
      {selected && (
        <Check className="w-3.5 h-3.5 text-accent shrink-0" strokeWidth={2.5} />
      )}
    </button>
  );
}

function Avatar({ member, size }: { member: AssigneeOption; size: number }) {
  if (member.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.photo_url}
        alt={member.name}
        className="rounded-full object-cover bg-foreground/10"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="rounded-full bg-foreground/10 inline-flex items-center justify-center text-[9px] font-bold text-foreground-secondary shrink-0"
      style={{ width: size, height: size }}
    >
      {member.name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("")}
    </span>
  );
}
