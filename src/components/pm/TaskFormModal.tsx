"use client";

// Create / edit task modal. Used in two modes:
//   - mode="create" — POST /xapi/projects/[projectId]/tasks
//   - mode="edit"   — PATCH /xapi/tasks/[task.id]
//
// UX: autofocus title, ⌘↵ to submit, Esc to close, scrim click closes,
// inline validation, disabled state while saving, progressive disclosure
// (description + priority hidden behind "More" toggle).

import { useEffect, useRef, useState } from "react";
import { X, CalendarDays, Flame, Minus, ArrowUp, ArrowDown } from "lucide-react";
import { AssigneeCombo } from "./AssigneeCombo";
import type {
  PmTask,
  TaskPriority,
  TaskStatus,
} from "@/lib/pm/types";
import { TASK_PRIORITIES, TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/pm/types";

interface BaseProps {
  projectId: string;
  onClose: () => void;
  onSaved: (task: PmTask) => void;
}

interface CreateProps extends BaseProps {
  mode: "create";
  initial?: undefined;
}
interface EditProps extends BaseProps {
  mode: "edit";
  initial: PmTask;
}

type Props = CreateProps | EditProps;

interface DraftState {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string;
  due_date: string;
  assignee_team_member_id: string | null;
}

const PRIORITY_ICON: Record<TaskPriority, typeof Flame> = {
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  urgent: Flame,
};

export function TaskFormModal(props: Props) {
  const isEdit = props.mode === "edit";
  const init = isEdit ? props.initial : null;

  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<DraftState>({
    title: init?.title ?? "",
    description: init?.description ?? "",
    status: init?.status ?? "todo",
    priority: init?.priority ?? "medium",
    start_date: init?.start_date ?? "",
    due_date: init?.due_date ?? "",
    assignee_team_member_id: init?.assignee_team_member_id ?? null,
  });
  const [moreOpen, setMoreOpen] = useState(
    Boolean(init?.description || init?.start_date || init?.priority !== "medium"),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 60);
  }, []);

  const close = () => {
    setMounted(false);
    setTimeout(() => props.onClose(), 180);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        e.preventDefault();
        close();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, saving]);

  const submit = async () => {
    const title = draft.title.trim();
    if (!title) {
      setError("Title required");
      titleRef.current?.focus();
      return;
    }
    if (
      draft.start_date &&
      draft.due_date &&
      draft.start_date > draft.due_date
    ) {
      setError("Start date must be before due date");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        title,
        description: draft.description.trim() || null,
        status: draft.status,
        priority: draft.priority,
        start_date: draft.start_date || null,
        due_date: draft.due_date || null,
        assignee_team_member_id: draft.assignee_team_member_id,
      };
      const url = isEdit
        ? `/xapi/tasks/${init!.id}`
        : `/xapi/projects/${props.projectId}/tasks`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { task: PmTask };
        error?: string;
      };
      if (!res.ok || !json.data?.task) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      props.onSaved(json.data.task);
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit task" : "Create task"}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-200 ${mounted ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={[
          "relative w-full max-w-[540px] rounded-2xl border border-divider bg-background shadow-2xl overflow-hidden",
          "transition-all duration-200 ease-out",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        ].join(" ")}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 h-12 border-b border-divider">
          <h2 className="text-[14px] font-semibold text-foreground">
            {isEdit ? "Edit task" : "New task"}
          </h2>
          <button
            type="button"
            onClick={close}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-foreground-tertiary hover:text-foreground hover:bg-foreground/5 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </header>

        <form
          className="p-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {/* Title */}
          <Field label="Title" required>
            <input
              ref={titleRef}
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="What needs to happen?"
              required
              disabled={saving}
              className={input()}
            />
          </Field>

          {/* Assignee */}
          <Field label="Assignee">
            <AssigneeCombo
              projectId={props.projectId}
              value={draft.assignee_team_member_id}
              onChange={(id) =>
                setDraft((d) => ({ ...d, assignee_team_member_id: id }))
              }
              disabled={saving}
            />
          </Field>

          {/* Timeline */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <DateInput
                value={draft.start_date}
                onChange={(v) => setDraft((d) => ({ ...d, start_date: v }))}
                disabled={saving}
              />
            </Field>
            <Field label="Due date">
              <DateInput
                value={draft.due_date}
                onChange={(v) => setDraft((d) => ({ ...d, due_date: v }))}
                disabled={saving}
              />
            </Field>
          </div>

          {/* More toggle: description, priority, status */}
          {!moreOpen && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="text-[11.5px] font-semibold text-accent hover:underline"
            >
              + Add description, priority, status
            </button>
          )}

          {moreOpen && (
            <>
              <Field label="Description">
                <textarea
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                  placeholder="Context, acceptance criteria, links…"
                  rows={4}
                  disabled={saving}
                  className={input("resize-y min-h-[80px]")}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Priority">
                  <div className="flex items-center gap-1">
                    {TASK_PRIORITIES.map((p) => {
                      const Icon = PRIORITY_ICON[p];
                      const active = draft.priority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, priority: p }))}
                          disabled={saving}
                          className={[
                            "h-9 flex-1 inline-flex items-center justify-center gap-1 rounded-md border text-[11.5px] font-medium capitalize transition-colors",
                            active
                              ? "border-accent/40 bg-accent/10 text-accent"
                              : "border-divider text-foreground-secondary hover:border-foreground/20",
                          ].join(" ")}
                          title={p}
                        >
                          <Icon className="w-3 h-3" strokeWidth={2} />
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Status">
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        status: e.target.value as TaskStatus,
                      }))
                    }
                    disabled={saving}
                    className={input()}
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {TASK_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </>
          )}

          {error && (
            <div className="text-[12px] text-rose-500" role="alert">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-divider">
            <span className="text-[10.5px] text-foreground-tertiary">
              ⌘↵ to save · Esc to cancel
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="h-9 px-3 rounded-md text-[12.5px] font-medium text-foreground-secondary hover:bg-foreground/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !draft.title.trim()}
                className="h-9 px-4 rounded-md text-[12.5px] font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {saving ? "Saving…" : isEdit ? "Save changes" : "Create task"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-foreground-tertiary mb-1">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function DateInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <CalendarDays
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-tertiary"
        strokeWidth={1.8}
      />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={input("pl-8")}
      />
    </div>
  );
}

function input(extra = ""): string {
  return [
    "w-full h-9 px-3 rounded-md border border-input bg-background text-foreground text-[13px]",
    "placeholder:text-foreground-tertiary outline-none transition-all",
    "focus:border-accent/40 focus:ring-2 focus:ring-accent/15",
    "disabled:opacity-50 dark:bg-card",
    extra,
  ].join(" ");
}
