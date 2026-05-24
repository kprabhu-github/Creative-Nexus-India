"use client";

// Personal "My Tasks" dashboard — every task assigned to the current user,
// grouped by deadline urgency. Subscribes to pm_tasks realtime so an admin
// assignment lands here in ~1s without refresh.
//
// Sections: Overdue · Today · This week · Later · No date · Done (collapsed)

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Check,
  Circle,
  CircleDot,
  Eye,
  Ban,
  Flame,
  ArrowUp,
  ArrowDown,
  Minus,
  CalendarDays,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import type { PmTask, TaskStatus, TaskPriority } from "@/lib/pm/types";
import { TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/pm/types";
import { TaskDrawer } from "@/components/pm/TaskDrawer";

interface MyTask extends PmTask {
  project_name: string;
}

interface MyTasksResponse {
  team_member: {
    id: string;
    name: string;
    title: string;
    photo_url: string | null;
  } | null;
  tasks: MyTask[];
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

export default function MyTasksPage() {
  const qc = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const [openTask, setOpenTask] = useState<MyTask | null>(null);

  const meQ = useQuery({
    queryKey: ["me-tasks"],
    queryFn: async (): Promise<MyTasksResponse> => {
      const res = await fetch("/xapi/me/tasks", { cache: "no-store" });
      const json = (await res.json()) as { data?: MyTasksResponse; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data ?? { team_member: null, tasks: [] };
    },
  });

  // Realtime: any pm_tasks change invalidates the personal list (filter happens
  // server-side, so we just refetch when anything moves).
  useEffect(() => {
    const channel = supabase
      .channel("my-tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pm_tasks" },
        () => qc.invalidateQueries({ queryKey: ["me-tasks"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tasks = meQ.data?.tasks ?? [];
  const grouped = useMemo(() => groupByBucket(tasks), [tasks]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5">
      <PageHeader
        title="My Tasks"
        description={
          meQ.data?.team_member
            ? `Live view for ${meQ.data.team_member.name}. Admins see your updates instantly; their assignments land here in seconds.`
            : "Tasks assigned to you. Realtime sync with the team."
        }
      />

      {meQ.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-foreground-tertiary" />
        </div>
      )}

      {meQ.isError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 text-[13px] text-rose-500">
          Failed to load: {(meQ.error as Error)?.message ?? "unknown"}
        </div>
      )}

      {meQ.isFetched && meQ.data && !meQ.data.team_member && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-[13px] text-foreground-secondary flex items-start gap-3">
          <AlertTriangle
            className="w-4 h-4 text-amber-500 mt-0.5 shrink-0"
            strokeWidth={2}
          />
          <div>
            <p className="font-semibold text-foreground">
              Your account isn&apos;t linked to a team member yet
            </p>
            <p className="mt-1 text-foreground-tertiary">
              An admin can link your login from{" "}
              <a href="/team" className="text-accent underline">
                /team
              </a>{" "}
              so assigned tasks show up here.
            </p>
          </div>
        </div>
      )}

      {meQ.isFetched && tasks.length === 0 && meQ.data?.team_member && (
        <div className="rounded-xl border border-divider bg-background-secondary/40 p-10 text-center">
          <p className="text-[14px] font-medium text-foreground">All clear</p>
          <p className="mt-1 text-[12px] text-foreground-tertiary">
            Nothing assigned to you right now. New tasks land here automatically.
          </p>
        </div>
      )}

      {meQ.data && tasks.length > 0 && (
        <div className="space-y-4">
          <Bucket
            label="Overdue"
            tone="danger"
            items={grouped.overdue}
            onOpen={setOpenTask}
            startOpen
          />
          <Bucket
            label="Today"
            items={grouped.today}
            onOpen={setOpenTask}
            startOpen
          />
          <Bucket
            label="This week"
            items={grouped.thisWeek}
            onOpen={setOpenTask}
            startOpen
          />
          <Bucket label="Later" items={grouped.later} onOpen={setOpenTask} />
          <Bucket label="No date" items={grouped.noDate} onOpen={setOpenTask} />
          <Bucket
            label="Done"
            items={grouped.done}
            onOpen={setOpenTask}
            tone="muted"
          />
        </div>
      )}

      {openTask && (
        <TaskDrawer
          task={openTask}
          projectName={openTask.project_name}
          onClose={() => setOpenTask(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

interface Groups {
  overdue: MyTask[];
  today: MyTask[];
  thisWeek: MyTask[];
  later: MyTask[];
  noDate: MyTask[];
  done: MyTask[];
}

function groupByBucket(tasks: MyTask[]): Groups {
  const out: Groups = {
    overdue: [],
    today: [],
    thisWeek: [],
    later: [],
    noDate: [],
    done: [],
  };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const weekFromNow = new Date(now);
  weekFromNow.setDate(now.getDate() + 7);

  for (const t of tasks) {
    if (t.status === "done") {
      out.done.push(t);
      continue;
    }
    if (!t.due_date) {
      out.noDate.push(t);
      continue;
    }
    const d = new Date(t.due_date);
    if (d < now) out.overdue.push(t);
    else if (d.getTime() === now.getTime()) out.today.push(t);
    else if (d <= weekFromNow) out.thisWeek.push(t);
    else out.later.push(t);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bucket
// ---------------------------------------------------------------------------

function Bucket({
  label,
  items,
  onOpen,
  startOpen = false,
  tone = "default",
}: {
  label: string;
  items: MyTask[];
  onOpen: (t: MyTask) => void;
  startOpen?: boolean;
  tone?: "default" | "danger" | "muted";
}) {
  const [open, setOpen] = useState(startOpen);
  if (items.length === 0) return null;

  const labelCls =
    tone === "danger"
      ? "text-rose-500"
      : tone === "muted"
        ? "text-foreground-tertiary"
        : "text-foreground";

  return (
    <section className="rounded-xl border border-divider bg-background-secondary/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-foreground/[0.03] transition-colors"
      >
        {open ? (
          <ChevronDown
            className="w-4 h-4 text-foreground-tertiary"
            strokeWidth={2}
          />
        ) : (
          <ChevronRight
            className="w-4 h-4 text-foreground-tertiary"
            strokeWidth={2}
          />
        )}
        <span className={`text-[13px] font-semibold ${labelCls}`}>{label}</span>
        <span className="text-[11px] text-foreground-tertiary">
          {items.length}
        </span>
      </button>
      {open && (
        <div className="border-t border-divider divide-y divide-divider">
          {items.map((t) => (
            <TaskItem key={t.id} task={t} onOpen={() => onOpen(t)} />
          ))}
        </div>
      )}
    </section>
  );
}

function TaskItem({ task, onOpen }: { task: MyTask; onOpen: () => void }) {
  const SI = STATUS_ICON[task.status];
  const PI = PRIORITY_ICON[task.priority];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-foreground/[0.04]",
        task.status === "done" ? "opacity-70" : "",
      ].join(" ")}
    >
      <SI
        className={`w-3.5 h-3.5 shrink-0 ${STATUS_COLOR[task.status]}`}
        strokeWidth={2}
      />
      <span className="flex-1 min-w-0">
        <span
          className={[
            "block text-[12.5px] truncate",
            task.status === "done"
              ? "line-through text-foreground-tertiary"
              : "text-foreground",
          ].join(" ")}
        >
          {task.title}
        </span>
        <span className="text-[11px] text-foreground-tertiary truncate">
          {task.project_name} · {TASK_STATUS_LABEL[task.status]}
        </span>
      </span>
      <PI
        className={`w-3.5 h-3.5 shrink-0 ${PRIORITY_COLOR[task.priority]}`}
        strokeWidth={2}
      />
      {task.due_date && (
        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-foreground-tertiary">
          <CalendarDays className="w-3 h-3" strokeWidth={2} />
          {fmtDate(task.due_date)}
        </span>
      )}
    </button>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
}

// TASK_STATUSES re-export protects against tree-shaking the enum away.
void TASK_STATUSES;
