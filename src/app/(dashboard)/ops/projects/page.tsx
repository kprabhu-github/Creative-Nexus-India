"use client";

import { useState } from "react";
import { ListChecks, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

type Priority = "High" | "Medium" | "Low";
type Column = "To Do" | "In Progress" | "Done";

interface Task {
  id: string;
  title: string;
  assignee: string;
  priority: Priority;
  column: Column;
}

const tasks: Task[] = [
  // To Do
  { id: "t1", title: "Design settings page layout", assignee: "PS", priority: "Medium", column: "To Do" },
  { id: "t2", title: "Write RLS policies for finance tables", assignee: "AM", priority: "High", column: "To Do" },
  { id: "t3", title: "Add GST calculation logic", assignee: "VS", priority: "High", column: "To Do" },
  { id: "t4", title: "Create attendance API routes", assignee: "RV", priority: "Low", column: "To Do" },
  // In Progress
  { id: "t5", title: "Build Slack bot command handler", assignee: "KJ", priority: "High", column: "In Progress" },
  { id: "t6", title: "Implement quality score dashboard", assignee: "AM", priority: "Medium", column: "In Progress" },
  { id: "t7", title: "Style executive metrics cards", assignee: "AG", priority: "Medium", column: "In Progress" },
  // Done
  { id: "t8", title: "Set up Supabase auth flow", assignee: "AM", priority: "High", column: "Done" },
  { id: "t9", title: "Create sidebar navigation", assignee: "PS", priority: "High", column: "Done" },
  { id: "t10", title: "Build page-header component", assignee: "PS", priority: "Medium", column: "Done" },
  { id: "t11", title: "Deploy staging environment", assignee: "VS", priority: "Medium", column: "Done" },
  { id: "t12", title: "Seed database with test data", assignee: "AM", priority: "Low", column: "Done" },
];

function priorityType(p: Priority) {
  switch (p) {
    case "High": return "error" as const;
    case "Medium": return "warning" as const;
    case "Low": return "neutral" as const;
  }
}

const columns: Column[] = ["To Do", "In Progress", "Done"];
const views = ["Board", "List"] as const;
type View = (typeof views)[number];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 bg-background dark:bg-background/40">
      <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-semibold text-accent">{task.assignee}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-foreground">{task.title}</div>
      </div>
      <StatusBadge type={priorityType(task.priority)}>{task.priority}</StatusBadge>
    </div>
  );
}

function BoardView() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.column === col);
        return (
          <div key={col}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-foreground">{col}</span>
              <span className="text-[11px] font-medium text-foreground-tertiary">{colTasks.length}</span>
            </div>
            <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
              {colTasks.map((task, i) => (
                <div key={task.id}>
                  <TaskCard task={task} />
                  {i < colTasks.length - 1 && <div className="h-px bg-divider mx-3.5" />}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView() {
  return (
    <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
      {tasks.map((task, i) => (
        <div key={task.id}>
          <div className="flex items-center gap-3 px-3.5 py-2.5 bg-background dark:bg-background/40">
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-semibold text-accent">{task.assignee}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-foreground">{task.title}</div>
            </div>
            <span className="text-[11px] font-medium text-foreground-tertiary bg-foreground-tertiary/8 px-1.5 py-0.5 rounded-full">
              {task.column}
            </span>
            <StatusBadge type={priorityType(task.priority)}>{task.priority}</StatusBadge>
          </div>
          {i < tasks.length - 1 && <div className="h-px bg-divider mx-3.5" />}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProjectOpsPage() {
  const [view, setView] = useState<View>("Board");

  const doneTasks = tasks.filter((t) => t.column === "Done").length;
  const totalTasks = tasks.length;
  const daysRemaining = 6;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Sprints"
        description="Kanban boards, task tracking, and sprint management."
        actions={
          <SegmentedControl
            options={[...views]}
            value={view}
            onChange={(v) => setView(v as View)}
          />
        }
      />

      {/* Current Sprint Card */}
      <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-accent/10 flex items-center justify-center shrink-0">
              <ListChecks className="w-4 h-4 text-accent" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-foreground">Sprint 14 -- Apr 7-21</div>
              <div className="text-xs text-foreground-tertiary">{doneTasks}/{totalTasks} tasks completed</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-foreground-tertiary">
              <Clock className="w-3.5 h-3.5" strokeWidth={2} />
              {daysRemaining} days remaining
            </div>
            <StatusBadge type="info">Active</StatusBadge>
          </div>
        </div>
        <ProgressBar value={doneTasks} max={totalTasks} color="accent" className="mt-3" />
      </div>

      {/* Board / List View */}
      {view === "Board" && <BoardView />}
      {view === "List" && <ListView />}
    </div>
  );
}
