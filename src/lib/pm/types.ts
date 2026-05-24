// Shared types for the project management module.

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "review"
  | "done"
  | "blocked";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";

export interface PmProject {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: TaskPriority;
  deadline: string | null;
  client_id: string | null;
  lead_team_member_id: string | null;
  total_deliverables: number;
  completed_deliverables: number;
  quality_score: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface PmTask {
  id: string;
  org_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  assignee_id: string | null;
  assignee_team_member_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface PmTaskComment {
  id: string;
  org_id: string;
  task_id: string;
  author_team_member_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface PmProjectWithStats extends PmProject {
  task_count: number;
  done_count: number;
}

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
  "blocked",
];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
};

export const TASK_PRIORITIES: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export const PROJECT_STATUSES: ProjectStatus[] = [
  "active",
  "on_hold",
  "completed",
  "archived",
];
