"use client";

// Projects + Tasks management page. Linear/Asana-inspired list view, fully
// data-driven via /xapi/projects + /xapi/tasks. Supabase Realtime keeps
// every connected tab in sync — a teammate adding a task here shows up
// instantly on another browser. Drag-and-drop kanban is a later slice;
// this one ships the dynamic + realtime contract.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
  Check,
  Circle,
  CircleDot,
  Eye,
  Ban,
  CalendarDays,
  Flame,
  Minus,
  ArrowUp,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import type {
  PmProjectWithStats,
  PmTask,
  TaskStatus,
  TaskPriority,
} from "@/lib/pm/types";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_PRIORITIES,
} from "@/lib/pm/types";

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

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: "text-foreground-tertiary",
  medium: "text-foreground-secondary",
  high: "text-amber-500",
  urgent: "text-rose-500",
};

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data as T;
}

export default function ProjectsPage() {
  const qc = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  // ---- Projects ----
  const projectsQ = useQuery({
    queryKey: ["pm-projects"],
    queryFn: () =>
      jfetch<{ projects: PmProjectWithStats[] }>("/xapi/projects?status=active"),
  });

  // ---- Team members (assignee picker) ----
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

  // ---- Realtime: invalidate caches on any pm_* change ----
  useEffect(() => {
    const channel = supabase
      .channel("pm-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pm_projects" },
        () => qc.invalidateQueries({ queryKey: ["pm-projects"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pm_tasks" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["pm-projects"] });
          const projectId =
            (payload.new as { project_id?: string } | null)?.project_id ??
            (payload.old as { project_id?: string } | null)?.project_id;
          if (projectId) {
            qc.invalidateQueries({ queryKey: ["pm-tasks", projectId] });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- New-project inline form state ----
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const createProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setCreatingProject(true);
    setCreateError(null);
    try {
      await jfetch("/xapi/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNewProjectName("");
      // realtime will reload — but kick a refetch anyway for the optimistic feel
      void qc.invalidateQueries({ queryKey: ["pm-projects"] });
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreatingProject(false);
    }
  };

  const projects = projectsQ.data?.projects ?? [];
  const team = teamQ.data ?? [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5">
      <PageHeader title="Projects" description="Track every active deliverable. Updates sync live across the team." />

      {/* New project quick-add */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Plus className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-tertiary" strokeWidth={2} />
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createProject();
            }}
            placeholder="New project name…"
            disabled={creatingProject}
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-[13px] text-foreground placeholder:text-foreground-tertiary outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15 transition-colors dark:bg-card disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={() => void createProject()}
          disabled={!newProjectName.trim() || creatingProject}
          className="h-9 px-4 rounded-lg bg-accent text-white text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {creatingProject ? "Creating…" : "Add project"}
        </button>
        {createError && (
          <span className="text-[11px] text-rose-500">{createError}</span>
        )}
      </div>

      {/* Project list */}
      {projectsQ.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-foreground-tertiary" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-divider bg-background-secondary/40 p-10 text-center">
          <p className="text-[14px] font-medium text-foreground">No active projects</p>
          <p className="mt-1 text-[12px] text-foreground-tertiary">
            Type a project name above to get started. Tasks live under each project.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectRow — collapsible card with inline task list
// ---------------------------------------------------------------------------

function ProjectRow({ project, team }: { project: PmProjectWithStats; team: TeamLite[] }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(project.task_count === 0);
  const [showDelete, setShowDelete] = useState(false);

  const tasksQ = useQuery({
    queryKey: ["pm-tasks", project.id],
    queryFn: () =>
      jfetch<{ tasks: PmTask[] }>(`/xapi/projects/${project.id}/tasks`),
    enabled: expanded,
  });

  const pct = project.task_count
    ? Math.round((project.done_count / project.task_count) * 100)
    : 0;

  const deleteProject = async () => {
    if (!window.confirm(`Delete "${project.name}" and ALL its tasks? This can't be undone.`)) {
      return;
    }
    try {
      await jfetch(`/xapi/projects/${project.id}`, { method: "DELETE" });
      void qc.invalidateQueries({ queryKey: ["pm-projects"] });
    } catch (err) {
      window.alert(`Delete failed: ${(err as Error).message}`);
    }
  };

  return (
    <section className="rounded-xl border border-divider bg-background-secondary/40 overflow-hidden">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-foreground/[0.03] transition-colors"
        onClick={() => setExpanded((e) => !e)}
        onMouseEnter={() => setShowDelete(true)}
        onMouseLeave={() => setShowDelete(false)}
      >
        <button
          type="button"
          className="shrink-0 w-5 h-5 inline-flex items-center justify-center text-foreground-tertiary"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" strokeWidth={2} />
          ) : (
            <ChevronRight className="w-4 h-4" strokeWidth={2} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold text-foreground truncate">
              {project.name}
            </span>
            <span className="text-[11px] text-foreground-tertiary">
              {project.done_count}/{project.task_count}
            </span>
          </div>
          {project.description && (
            <p className="text-[11.5px] text-foreground-tertiary mt-0.5 line-clamp-1">
              {project.description}
            </p>
          )}
        </div>

        {project.deadline && (
          <span
            className={[
              "shrink-0 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border",
              isOverdue(project.deadline)
                ? "border-rose-500/30 text-rose-500 bg-rose-500/5"
                : "border-divider text-foreground-tertiary bg-background/40",
            ].join(" ")}
          >
            <CalendarDays className="w-3 h-3" strokeWidth={2} />
            {formatDate(project.deadline)}
          </span>
        )}

        {/* Mini progress */}
        <div className="shrink-0 hidden sm:flex items-center gap-2 w-32">
          <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10.5px] font-semibold text-foreground-tertiary tabular-nums w-8 text-right">
            {pct}%
          </span>
        </div>

        {showDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void deleteProject();
            }}
            className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md text-foreground-tertiary hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
            aria-label="Delete project"
            title="Delete project"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
          </button>
        )}
      </header>

      {/* Task list */}
      {expanded && (
        <div className="border-t border-divider px-3 py-2 space-y-1">
          {tasksQ.isLoading ? (
            <div className="px-2 py-3 text-[12px] text-foreground-tertiary">
              Loading tasks…
            </div>
          ) : (
            <>
              {(tasksQ.data?.tasks ?? []).length === 0 && (
                <p className="px-2 py-2 text-[12px] text-foreground-tertiary">
                  No tasks yet. Add one below.
                </p>
              )}
              {(tasksQ.data?.tasks ?? []).map((t) => (
                <TaskRow key={t.id} task={t} team={team} />
              ))}
              <NewTaskRow projectId={project.id} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// TaskRow — status cycle, priority, assignee, due date, delete
// ---------------------------------------------------------------------------

function TaskRow({ task, team }: { task: PmTask; team: TeamLite[] }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      await jfetch(`/xapi/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      void qc.invalidateQueries({ queryKey: ["pm-tasks", task.project_id] });
      void qc.invalidateQueries({ queryKey: ["pm-projects"] });
    } catch (err) {
      window.alert(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const cycleStatus = () => {
    const idx = TASK_STATUSES.indexOf(task.status);
    const next = TASK_STATUSES[(idx + 1) % TASK_STATUSES.length];
    void patch({ status: next });
  };

  const cyclePriority = () => {
    const idx = TASK_PRIORITIES.indexOf(task.priority);
    const next = TASK_PRIORITIES[(idx + 1) % TASK_PRIORITIES.length];
    void patch({ priority: next });
  };

  const deleteTask = async () => {
    if (!window.confirm("Delete this task?")) return;
    try {
      await jfetch(`/xapi/tasks/${task.id}`, { method: "DELETE" });
      void qc.invalidateQueries({ queryKey: ["pm-tasks", task.project_id] });
      void qc.invalidateQueries({ queryKey: ["pm-projects"] });
    } catch (err) {
      window.alert(`Delete failed: ${(err as Error).message}`);
    }
  };

  const StatusIcon = STATUS_ICON[task.status];
  const PriorityIcon = PRIORITY_ICON[task.priority];
  const assignee = team.find((m) => m.id === task.assignee_team_member_id);

  return (
    <div
      className={[
        "group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/[0.04] transition-colors",
        saving ? "opacity-60" : "",
        task.status === "done" ? "opacity-70" : "",
      ].join(" ")}
    >
      {/* Status toggle */}
      <button
        type="button"
        onClick={cycleStatus}
        disabled={saving}
        title={`Status: ${TASK_STATUS_LABEL[task.status]} — click to cycle`}
        className={`shrink-0 w-5 h-5 inline-flex items-center justify-center rounded ${STATUS_COLOR[task.status]} hover:bg-foreground/10`}
        aria-label={`Cycle status (currently ${TASK_STATUS_LABEL[task.status]})`}
      >
        <StatusIcon className="w-3.5 h-3.5" strokeWidth={2} />
      </button>

      {/* Title (inline editable) */}
      <InlineTitle task={task} disabled={saving} onSave={(title) => patch({ title })} />

      {/* Priority */}
      <button
        type="button"
        onClick={cyclePriority}
        disabled={saving}
        title={`Priority: ${task.priority}`}
        className={`shrink-0 w-6 h-6 inline-flex items-center justify-center rounded hover:bg-foreground/10 ${PRIORITY_COLOR[task.priority]}`}
        aria-label={`Cycle priority (currently ${task.priority})`}
      >
        <PriorityIcon className="w-3.5 h-3.5" strokeWidth={2} />
      </button>

      {/* Due date */}
      <div className="shrink-0 flex items-center">
        <input
          type="date"
          value={task.due_date ?? ""}
          onChange={(e) => void patch({ due_date: e.target.value || null })}
          className={[
            "h-6 px-1.5 rounded text-[11px] bg-transparent border border-transparent hover:border-divider focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/15 transition-colors",
            task.due_date
              ? isOverdue(task.due_date) && task.status !== "done"
                ? "text-rose-500"
                : "text-foreground-secondary"
              : "text-foreground-tertiary/60",
          ].join(" ")}
          disabled={saving}
        />
      </div>

      {/* Assignee */}
      <select
        value={task.assignee_team_member_id ?? ""}
        onChange={(e) =>
          void patch({ assignee_team_member_id: e.target.value || null })
        }
        disabled={saving}
        className="shrink-0 h-6 max-w-[140px] text-[11px] bg-transparent border border-transparent hover:border-divider rounded px-1.5 text-foreground-secondary focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/15 transition-colors"
        aria-label="Assignee"
      >
        <option value="">Unassigned</option>
        {team.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      {/* Assignee avatar */}
      {assignee && (
        <span
          className="shrink-0 w-5 h-5 rounded-full overflow-hidden bg-foreground/10 flex items-center justify-center text-[9px] font-bold text-foreground-secondary"
          title={assignee.name}
        >
          {assignee.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assignee.photo_url} alt={assignee.name} className="w-full h-full object-cover" />
          ) : (
            initials(assignee.name)
          )}
        </span>
      )}

      {/* Delete */}
      <button
        type="button"
        onClick={() => void deleteTask()}
        className="shrink-0 w-6 h-6 inline-flex items-center justify-center rounded text-foreground-tertiary opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
        aria-label="Delete task"
        title="Delete task"
      >
        <Trash2 className="w-3 h-3" strokeWidth={1.8} />
      </button>
    </div>
  );
}

function InlineTitle({
  task,
  disabled,
  onSave,
}: {
  task: PmTask;
  disabled: boolean;
  onSave: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === task.title) return;
    onSave(next);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(task.title);
            setEditing(false);
          }
        }}
        disabled={disabled}
        className="flex-1 min-w-0 h-7 px-1.5 rounded border border-accent/40 bg-background text-[12.5px] text-foreground outline-none focus:ring-2 focus:ring-accent/20"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={[
        "flex-1 min-w-0 text-left text-[12.5px] truncate hover:text-foreground transition-colors",
        task.status === "done" ? "line-through text-foreground-tertiary" : "text-foreground",
      ].join(" ")}
    >
      {task.title}
    </button>
  );
}

// ---------------------------------------------------------------------------
// NewTaskRow — inline add task at bottom of each project
// ---------------------------------------------------------------------------

function NewTaskRow({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const t = title.trim();
    if (!t) return;
    setSaving(true);
    setError(null);
    try {
      await jfetch(`/xapi/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: t }),
      });
      setTitle("");
      void qc.invalidateQueries({ queryKey: ["pm-tasks", projectId] });
      void qc.invalidateQueries({ queryKey: ["pm-projects"] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <span className="shrink-0 w-5 h-5 inline-flex items-center justify-center text-foreground-tertiary/60">
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
      </span>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void add();
        }}
        placeholder="Add task — press Enter"
        disabled={saving}
        className="flex-1 h-7 px-1.5 text-[12.5px] bg-transparent text-foreground placeholder:text-foreground-tertiary/60 outline-none border-b border-transparent focus:border-accent/30 transition-colors disabled:opacity-50"
      />
      {error && (
        <span className="text-[10.5px] text-rose-500">{error}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOverdue(iso: string): boolean {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
