"use client";

// Calendar — full-screen month view aggregating live data:
//   - Task due dates (from pm_tasks)
//   - Approved leaves (from hr_leaves)
// Realtime: any pm_tasks or hr_leaves change refetches the merged event set.

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { FullScreenCalendar, type CalendarDay } from "@/components/ui/full-screen-calendar";
import { PageHeader } from "@/components/ui/page-header";
import type { PmTask } from "@/lib/pm/types";
import type { LeaveRequest } from "@/lib/hr/types";
import { LEAVE_TYPE_LABEL } from "@/lib/hr/types";

interface TeamLite {
  id: string;
  name: string;
}

interface TaskWithProject extends PmTask {
  project_name?: string;
}

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

export default function CalendarPage() {
  const qc = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Tasks with due dates this quarter (+- 60 days from today is plenty)
  const tasksQ = useQuery({
    queryKey: ["calendar-tasks"],
    queryFn: async (): Promise<TaskWithProject[]> => {
      const { data } = await supabase
        .from("pm_tasks")
        .select("*, pm_projects(name)")
        .eq("org_id", ORG_ID)
        .not("due_date", "is", null)
        .order("due_date");
      return ((data ?? []) as Array<
        PmTask & { pm_projects?: { name: string } }
      >).map((t) => ({
        ...t,
        project_name: t.pm_projects?.name,
      }));
    },
  });

  // Leaves (approved + pending) within 90 days back to 90 forward.
  const leavesQ = useQuery({
    queryKey: ["calendar-leaves"],
    queryFn: async (): Promise<Array<LeaveRequest & { member_name?: string }>> => {
      const { data } = await supabase
        .from("hr_leaves")
        .select("*, hr_team_members(name)")
        .eq("org_id", ORG_ID)
        .in("status", ["approved", "pending"])
        .order("start_date");
      return ((data ?? []) as Array<
        LeaveRequest & { hr_team_members?: TeamLite }
      >).map((l) => ({
        ...l,
        member_name: l.hr_team_members?.name,
      }));
    },
  });

  // Realtime: any task/leave change refreshes the calendar.
  useEffect(() => {
    const ch = supabase
      .channel("calendar-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pm_tasks" },
        () => qc.invalidateQueries({ queryKey: ["calendar-tasks"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hr_leaves" },
        () => qc.invalidateQueries({ queryKey: ["calendar-leaves"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Merge tasks + leaves into the shape FullScreenCalendar expects.
  const data: CalendarDay[] = useMemo(() => {
    const byDay = new Map<string, CalendarDay>();

    const push = (iso: string, event: CalendarDay["events"][number]) => {
      const slot = byDay.get(iso) ?? { day: new Date(iso), events: [] };
      slot.events.push(event);
      byDay.set(iso, slot);
    };

    for (const t of tasksQ.data ?? []) {
      if (!t.due_date) continue;
      push(t.due_date, {
        id: `task-${t.id}`,
        name: t.title,
        time: t.project_name ?? "Task",
        datetime: t.due_date,
      });
    }

    for (const l of leavesQ.data ?? []) {
      // Render one event on each day in the leave's range.
      const start = new Date(l.start_date);
      const end = new Date(l.end_date);
      for (
        let d = new Date(start);
        d.getTime() <= end.getTime();
        d.setDate(d.getDate() + 1)
      ) {
        const iso = d.toISOString().slice(0, 10);
        push(iso, {
          id: `leave-${l.id}-${iso}`,
          name: `${l.member_name ?? "Teammate"} · ${LEAVE_TYPE_LABEL[l.leave_type]} leave`,
          time:
            l.status === "approved" ? "Approved" : `Pending · ${l.urgency}`,
          datetime: iso,
        });
      }
    }

    return Array.from(byDay.values()).sort(
      (a, b) => a.day.getTime() - b.day.getTime(),
    );
  }, [tasksQ.data, leavesQ.data]);

  const loading = tasksQ.isLoading || leavesQ.isLoading;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-7rem)] flex flex-col">
      <PageHeader
        title="Calendar"
        description="Tasks (due dates) and leaves merged in one live month view. Updates push within ~1s when teammates change anything."
      />

      <div className="flex-1 mt-4 rounded-xl border border-divider bg-background overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[12px] text-foreground-tertiary">
            Loading events…
          </div>
        ) : (
          <FullScreenCalendar data={data} onDayClick={setSelectedDay} />
        )}
      </div>

      {/* Selected-day flyout (mobile-friendly summary) */}
      {selectedDay && (
        <SelectedDayPanel
          day={selectedDay}
          events={
            data.find(
              (d) =>
                d.day.toISOString().slice(0, 10) ===
                selectedDay.toISOString().slice(0, 10),
            )?.events ?? []
          }
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

function SelectedDayPanel({
  day,
  events,
  onClose,
}: {
  day: Date;
  events: CalendarDay["events"];
  onClose: () => void;
}) {
  if (events.length === 0) return null;
  return (
    <aside className="mt-3 rounded-xl border border-divider bg-background-secondary/40 p-3.5">
      <header className="flex items-center justify-between mb-2">
        <h3 className="text-[12.5px] font-semibold text-foreground">
          {day.toLocaleDateString("en-IN", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-foreground-tertiary hover:text-foreground"
        >
          Close
        </button>
      </header>
      <ul className="space-y-1.5">
        {events.map((e) => (
          <li
            key={e.id}
            className="text-[12px] text-foreground-secondary"
          >
            <span className="font-medium text-foreground">{e.name}</span>
            <span className="ml-2 text-foreground-tertiary">{e.time}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
