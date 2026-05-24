"use client";

// Slide-in task detail drawer. Read view of all fields + admin Edit toggle
// that opens TaskFormModal. Comments thread at the bottom with inline
// add (⌘↵ to post). Subscribes to pm_task_comments realtime so a teammate's
// comment appears within ~1s.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Pencil,
  Trash2,
  CalendarDays,
  User,
  Flame,
  ArrowUp,
  ArrowDown,
  Minus,
  CircleDot,
  Circle,
  Check,
  Eye,
  Ban,
  MessageCircle,
  Send,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  PmTask,
  PmTaskComment,
  TaskPriority,
  TaskStatus,
} from "@/lib/pm/types";
import { TASK_STATUS_LABEL } from "@/lib/pm/types";
import { TaskFormModal } from "./TaskFormModal";

interface Props {
  task: PmTask;
  /** Project name for breadcrumb. */
  projectName?: string;
  /** Admin can edit + delete; non-admin can still comment. */
  isAdmin?: boolean;
  onClose: () => void;
}

interface TeamLite {
  id: string;
  name: string;
  photo_url: string | null;
}

const STATUS_ICON: Record<TaskStatus, LucideIcon> = {
  todo: Circle,
  in_progress: CircleDot,
  review: Eye,
  done: Check,
  blocked: Ban,
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "text-foreground-tertiary",
  in_progress: "text-blue-500",
  review: "text-amber-500",
  done: "text-emerald-500",
  blocked: "text-rose-500",
};

const PRIORITY_ICON: Record<TaskPriority, LucideIcon> = {
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  urgent: Flame,
};

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

export function TaskDrawer({
  task: initialTask,
  projectName,
  isAdmin = true,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const [mounted, setMounted] = useState(false);
  const [task, setTask] = useState<PmTask>(initialTask);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setTask(initialTask), [initialTask]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setMounted(false);
    setTimeout(onClose, 200);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editing) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Team lookup (assignee + comment authors).
  const teamQ = useQuery({
    queryKey: ["pm-team-lite"],
    queryFn: async (): Promise<TeamLite[]> => {
      const { data } = await supabase
        .from("hr_team_members")
        .select("id, name, photo_url")
        .eq("org_id", ORG_ID)
        .eq("status", "active")
        .order("name");
      return (data ?? []) as TeamLite[];
    },
    staleTime: 60_000,
  });

  const commentsQ = useQuery({
    queryKey: ["pm-task-comments", task.id],
    queryFn: async (): Promise<PmTaskComment[]> => {
      const res = await fetch(`/xapi/tasks/${task.id}/comments`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        data?: { comments: PmTaskComment[] };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data?.comments ?? [];
    },
  });

  // Realtime: invalidate on any insert/update/delete of comments for this task.
  useEffect(() => {
    const channel = supabase
      .channel(`pm-task-comments-${task.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pm_task_comments",
          filter: `task_id=eq.${task.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["pm-task-comments", task.id] }),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pm_tasks",
          filter: `id=eq.${task.id}`,
        },
        (payload) => {
          const next = payload.new as PmTask;
          setTask(next);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [task.id, supabase, qc]);

  const assignee = teamQ.data?.find(
    (m) => m.id === task.assignee_team_member_id,
  );

  const deleteTask = async () => {
    if (!window.confirm("Delete this task and all its comments?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/xapi/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      qc.invalidateQueries({ queryKey: ["pm-tasks", task.project_id] });
      qc.invalidateQueries({ queryKey: ["pm-projects"] });
      close();
    } catch (err) {
      window.alert(`Delete failed: ${(err as Error).message}`);
    } finally {
      setDeleting(false);
    }
  };

  const StatusIcon = STATUS_ICON[task.status];
  const PriorityIcon = PRIORITY_ICON[task.priority];

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-200 ${mounted ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          className={[
            "fixed right-0 top-0 h-full w-full md:w-[520px] bg-background border-l border-divider",
            "flex flex-col overflow-hidden transition-transform duration-[220ms] ease-out",
            mounted ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
        >
          {/* Sticky header */}
          <header className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 h-12 border-b border-divider bg-background/90 backdrop-blur-md">
            <button
              type="button"
              onClick={close}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-foreground-secondary hover:bg-foreground/5"
              aria-label="Close"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
            <span className="text-[11.5px] text-foreground-tertiary truncate">
              {projectName ? `${projectName} · Task` : "Task"}
            </span>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-md text-foreground-secondary hover:bg-foreground/5"
                    aria-label="Edit task"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteTask()}
                    disabled={deleting}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-md text-foreground-secondary hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
                    aria-label="Delete task"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </>
              )}
            </div>
          </header>

          {/* Scroll area */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* Title + status */}
            <section>
              <div className="flex items-start gap-3">
                <StatusIcon
                  className={`w-5 h-5 mt-0.5 shrink-0 ${STATUS_COLOR[task.status]}`}
                  strokeWidth={2}
                />
                <h1 className="text-[19px] font-semibold tracking-tight text-foreground leading-snug">
                  {task.title}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Pill icon={StatusIcon} label={TASK_STATUS_LABEL[task.status]} tone="muted" />
                <Pill
                  icon={PriorityIcon}
                  label={task.priority}
                  tone={
                    task.priority === "urgent" || task.priority === "high"
                      ? "warn"
                      : "muted"
                  }
                  className="capitalize"
                />
              </div>
            </section>

            {/* Meta grid */}
            <section className="rounded-xl border border-divider bg-background-secondary/40 divide-y divide-divider text-[12.5px]">
              <Row label="Assignee">
                {assignee ? (
                  <span className="inline-flex items-center gap-2">
                    {assignee.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={assignee.photo_url}
                        alt={assignee.name}
                        className="w-5 h-5 rounded-full object-cover bg-foreground/10"
                      />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-foreground/10 inline-flex items-center justify-center text-[9px] font-bold text-foreground-secondary">
                        {initials(assignee.name)}
                      </span>
                    )}
                    <span className="text-foreground">{assignee.name}</span>
                  </span>
                ) : (
                  <span className="text-foreground-tertiary inline-flex items-center gap-1">
                    <User className="w-3.5 h-3.5" strokeWidth={1.8} />
                    Unassigned
                  </span>
                )}
              </Row>
              <Row label="Timeline">
                <span className="inline-flex items-center gap-1.5 text-foreground-secondary">
                  <CalendarDays className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={1.8} />
                  {fmtRange(task.start_date, task.due_date)}
                </span>
              </Row>
              <Row label="Created">
                <span className="text-foreground-secondary">
                  {fmtDateTime(task.created_at)}
                </span>
              </Row>
              <Row label="Last updated">
                <span className="text-foreground-secondary">
                  {fmtDateTime(task.updated_at)}
                </span>
              </Row>
            </section>

            {/* Description */}
            {task.description && (
              <section>
                <SectionLabel>Description</SectionLabel>
                <p className="text-[13px] leading-relaxed text-foreground-secondary whitespace-pre-line">
                  {task.description}
                </p>
              </section>
            )}

            {/* Comments */}
            <section>
              <SectionLabel>
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5" strokeWidth={2} />
                  Comments
                  {(commentsQ.data?.length ?? 0) > 0 && (
                    <span className="text-foreground-tertiary">
                      ({commentsQ.data?.length})
                    </span>
                  )}
                </span>
              </SectionLabel>

              <div className="space-y-3">
                {commentsQ.isLoading && (
                  <p className="text-[12px] text-foreground-tertiary">Loading…</p>
                )}
                {commentsQ.isFetched && (commentsQ.data?.length ?? 0) === 0 && (
                  <p className="text-[12px] text-foreground-tertiary">
                    No comments yet. Be the first.
                  </p>
                )}
                {(commentsQ.data ?? []).map((c) => {
                  const author = c.author_team_member_id
                    ? teamQ.data?.find((m) => m.id === c.author_team_member_id)
                    : null;
                  return (
                    <article
                      key={c.id}
                      className="rounded-lg border border-divider bg-background-secondary/40 p-3"
                    >
                      <header className="flex items-center gap-2 mb-1.5">
                        {author?.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={author.photo_url}
                            alt={author.name}
                            className="w-5 h-5 rounded-full object-cover bg-foreground/10"
                          />
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-foreground/10 inline-flex items-center justify-center text-[9px] font-bold text-foreground-secondary">
                            {initials(author?.name ?? c.author_name ?? "?")}
                          </span>
                        )}
                        <span className="text-[12px] font-semibold text-foreground">
                          {author?.name ?? c.author_name ?? "Anonymous"}
                        </span>
                        <span className="text-[10.5px] text-foreground-tertiary">
                          {fmtDateTime(c.created_at)}
                        </span>
                      </header>
                      <p className="text-[12.5px] leading-relaxed text-foreground-secondary whitespace-pre-line">
                        {c.body}
                      </p>
                    </article>
                  );
                })}
              </div>

              <NewCommentForm
                taskId={task.id}
                authors={teamQ.data ?? []}
              />
            </section>
          </div>
        </aside>
      </div>

      {editing && (
        <TaskFormModal
          mode="edit"
          projectId={task.project_id}
          initial={task}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setTask(updated);
            qc.invalidateQueries({ queryKey: ["pm-tasks", task.project_id] });
            qc.invalidateQueries({ queryKey: ["pm-projects"] });
            setEditing(false);
          }}
        />
      )}
    </>
  );
}

function NewCommentForm({
  taskId,
  authors,
}: {
  taskId: string;
  authors: TeamLite[];
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [authorId, setAuthorId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/xapi/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text,
          author_team_member_id: authorId || null,
          author_name: authorId
            ? authors.find((a) => a.id === authorId)?.name ?? null
            : null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setBody("");
      qc.invalidateQueries({ queryKey: ["pm-task-comments", taskId] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-divider bg-background p-2.5 focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/15 transition-colors dark:bg-card">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="Add a comment… (⌘↵ to post)"
        rows={2}
        disabled={saving}
        className="w-full bg-transparent text-[12.5px] text-foreground placeholder:text-foreground-tertiary outline-none resize-y min-h-[44px]"
      />
      <div className="flex items-center justify-between mt-1.5">
        <select
          value={authorId}
          onChange={(e) => setAuthorId(e.target.value)}
          disabled={saving}
          className="h-7 text-[11px] bg-transparent text-foreground-secondary border border-divider rounded px-1.5 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15"
          aria-label="Comment as"
        >
          <option value="">Comment as… (optional)</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-[10.5px] text-rose-500">{error}</span>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !body.trim()}
            className="h-7 px-3 inline-flex items-center gap-1 rounded-md bg-accent text-white text-[11.5px] font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            <Send className="w-3 h-3" strokeWidth={2} />
            {saving ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-foreground-tertiary">
        {label}
      </span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-foreground-tertiary mb-2">
      {children}
    </div>
  );
}

function Pill({
  icon: Icon,
  label,
  tone,
  className,
}: {
  icon: LucideIcon;
  label: string;
  tone: "muted" | "warn" | "danger";
  className?: string;
}) {
  const toneCls = {
    muted:
      "border-divider bg-background-secondary/40 text-foreground-secondary",
    warn: "border-amber-500/30 bg-amber-500/5 text-amber-500",
    danger: "border-rose-500/30 bg-rose-500/5 text-rose-500",
  }[tone];
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium",
        toneCls,
        className ?? "",
      ].join(" ")}
    >
      <Icon className="w-3 h-3" strokeWidth={2} />
      {label}
    </span>
  );
}

function fmtRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Not scheduled";
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return `Starts ${fmt(start)}`;
  return `Due ${fmt(end!)}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
