"use client";

import { useState } from "react";
import {
  Video,
  CalendarPlus,
  Clock,
  Users,
  CalendarDays,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventType = "Meeting" | "Leave" | "Block" | "Activity" | "Holiday";

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  duration: string;
  type: EventType;
  attendees?: string[];
  allDay?: boolean;
}

interface DayEvents {
  date: string;
  dayLabel: string;
  isToday: boolean;
  events: CalendarEvent[];
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const weekEvents: DayEvents[] = [
  {
    date: "Apr 14",
    dayLabel: "Monday",
    isToday: false,
    events: [
      {
        id: "e1",
        title: "Sprint 14 Planning",
        time: "9:30 AM",
        duration: "1h",
        type: "Meeting",
        attendees: ["PK", "SM", "RK", "AM"],
      },
      {
        id: "e2",
        title: "Natraj \u2014 Casual Leave",
        time: "All day",
        duration: "Full day",
        type: "Leave",
        allDay: true,
      },
    ],
  },
  {
    date: "Apr 15",
    dayLabel: "Tuesday",
    isToday: true,
    events: [
      {
        id: "e3",
        title: "Client Call \u2014 Acme Corp",
        time: "10:00 AM",
        duration: "30min",
        type: "Meeting",
        attendees: ["PK", "LP"],
      },
      {
        id: "e4",
        title: "Design Review",
        time: "2:00 PM",
        duration: "1h",
        type: "Meeting",
        attendees: ["SM", "LP", "DW"],
      },
      {
        id: "e5",
        title: "Team Standup",
        time: "5:00 PM",
        duration: "15min",
        type: "Meeting",
        attendees: ["PK", "SM", "RK", "AM", "LP"],
      },
    ],
  },
  {
    date: "Apr 16",
    dayLabel: "Wednesday",
    isToday: false,
    events: [
      {
        id: "e6",
        title: "WFH Wednesday",
        time: "All day",
        duration: "Full day",
        type: "Block",
        allDay: true,
      },
      {
        id: "e7",
        title: "Webinar: AI in Marketing",
        time: "11:00 AM",
        duration: "2h",
        type: "Activity",
      },
    ],
  },
  {
    date: "Apr 17",
    dayLabel: "Thursday",
    isToday: false,
    events: [
      {
        id: "e8",
        title: "Meridian Finance \u2014 SOW Review",
        time: "11:00 AM",
        duration: "1h",
        type: "Meeting",
        attendees: ["PK", "AM", "NK"],
      },
      {
        id: "e9",
        title: "Anjali \u2014 Half Day Leave",
        time: "PM",
        duration: "Half day",
        type: "Leave",
        allDay: true,
      },
    ],
  },
  {
    date: "Apr 18",
    dayLabel: "Friday",
    isToday: false,
    events: [
      {
        id: "e10",
        title: "Team Lunch",
        time: "1:00 PM",
        duration: "1h",
        type: "Activity",
      },
      {
        id: "e11",
        title: "Sprint 14 Retro",
        time: "4:00 PM",
        duration: "45min",
        type: "Meeting",
        attendees: ["PK", "SM", "RK", "AM", "LP"],
      },
    ],
  },
];

// Upcoming events: next 3 from today onward
const upcomingEvents = weekEvents
  .filter((day) => day.isToday || day.date >= "Apr 15")
  .flatMap((day) =>
    day.events
      .filter((e) => !e.allDay)
      .map((e) => ({ ...e, date: day.date, dayLabel: day.dayLabel }))
  )
  .slice(0, 3);

// Leave this week
const leavesThisWeek = [
  { name: "Natraj", dates: "Apr 14 (Full day)", initials: "NT" },
  { name: "Anjali", dates: "Apr 17 (PM)", initials: "AJ" },
  { name: "Deepak", dates: "Apr 18 (Full day)", initials: "DK" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const viewTabs = ["Week", "Month", "Agenda"] as const;
type ViewTab = (typeof viewTabs)[number];

function eventBorderColor(type: EventType): string {
  switch (type) {
    case "Meeting":
      return "border-l-accent";
    case "Leave":
      return "border-l-warning";
    case "Block":
      return "border-l-foreground-tertiary";
    case "Activity":
      return "border-l-success";
    case "Holiday":
      return "border-l-[hsl(var(--accent))]";
  }
}

function eventBadgeType(type: EventType) {
  switch (type) {
    case "Meeting":
      return "info" as const;
    case "Leave":
      return "warning" as const;
    case "Block":
      return "neutral" as const;
    case "Activity":
      return "success" as const;
    case "Holiday":
      return "info" as const;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-2.5 bg-background dark:bg-background/40 border-l-[3px] ${eventBorderColor(
        event.type
      )}`}
    >
      {/* Time */}
      <div className="w-[72px] shrink-0">
        <span className="text-[12px] font-medium text-foreground-tertiary">
          {event.time}
        </span>
      </div>

      {/* Title and duration */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-foreground truncate">
          {event.title}
        </div>
        <div className="text-[11px] text-foreground-tertiary mt-0.5">
          {event.duration}
        </div>
      </div>

      {/* Type badge */}
      <StatusBadge type={eventBadgeType(event.type)}>{event.type}</StatusBadge>

      {/* Attendees (meetings only) */}
      {event.attendees && event.attendees.length > 0 && (
        <div className="hidden sm:flex items-center -space-x-1.5 shrink-0">
          {event.attendees.slice(0, 4).map((initial) => (
            <div
              key={initial}
              className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center ring-2 ring-background"
            >
              <span className="text-[9px] font-semibold text-accent leading-none">
                {initial}
              </span>
            </div>
          ))}
          {event.attendees.length > 4 && (
            <div className="w-6 h-6 rounded-full bg-background-secondary flex items-center justify-center ring-2 ring-background">
              <span className="text-[9px] font-medium text-foreground-tertiary leading-none">
                +{event.attendees.length - 4}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DayGroup({ day }: { day: DayEvents }) {
  return (
    <div className="mb-4 last:mb-0">
      {/* Day header */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`text-[13px] font-semibold ${
            day.isToday ? "text-accent" : "text-foreground"
          }`}
        >
          {day.dayLabel}
        </span>
        <span
          className={`text-[12px] ${
            day.isToday ? "text-accent" : "text-foreground-tertiary"
          }`}
        >
          {day.date}
        </span>
        {day.isToday && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent text-accent-foreground">
            Today
          </span>
        )}
      </div>

      {/* Events list */}
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {day.events.map((event, i) => (
          <div key={event.id}>
            <EventRow event={event} />
            {i < day.events.length - 1 && (
              <div className="h-px bg-divider mx-3.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <div className="space-y-4">
      {/* Upcoming events */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Clock className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
          <span className="text-[13px] font-semibold text-foreground">Upcoming</span>
        </div>
        <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
          {upcomingEvents.map((event, i) => (
            <div key={event.id}>
              <div className="px-3 py-2.5 bg-background dark:bg-background/40">
                <div className="text-[13px] font-medium text-foreground truncate">
                  {event.title}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-foreground-tertiary">
                    {event.dayLabel}, {event.time}
                  </span>
                  <span className="text-[11px] text-foreground-tertiary">
                    {event.duration}
                  </span>
                </div>
              </div>
              {i < upcomingEvents.length - 1 && (
                <div className="h-px bg-divider mx-3" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Leave calendar */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Users className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
          <span className="text-[13px] font-semibold text-foreground">
            On Leave This Week
          </span>
        </div>
        <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
          {leavesThisWeek.map((person, i) => (
            <div key={person.initials}>
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-background dark:bg-background/40">
                <div className="w-7 h-7 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-semibold text-warning">
                    {person.initials}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground">
                    {person.name}
                  </div>
                  <div className="text-[11px] text-foreground-tertiary">
                    {person.dates}
                  </div>
                </div>
              </div>
              {i < leavesThisWeek.length - 1 && (
                <div className="h-px bg-divider mx-3" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Schedule meeting button */}
      <Button className="w-full">
        <CalendarPlus className="w-3.5 h-3.5" strokeWidth={2} data-icon="inline-start" />
        Schedule Meeting
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View placeholders for Week / Month
// ---------------------------------------------------------------------------

function WeekView() {
  return (
    <div className="bg-background-secondary rounded-[10px] p-6 dark:border dark:border-border text-center">
      <CalendarDays className="w-8 h-8 text-foreground-tertiary mx-auto mb-2" strokeWidth={1.5} />
      <p className="text-[13px] text-foreground-tertiary">
        Week view coming soon. Use the Agenda view for now.
      </p>
    </div>
  );
}

function MonthView() {
  return (
    <div className="bg-background-secondary rounded-[10px] p-6 dark:border dark:border-border text-center">
      <CalendarDays className="w-8 h-8 text-foreground-tertiary mx-auto mb-2" strokeWidth={1.5} />
      <p className="text-[13px] text-foreground-tertiary">
        Month view coming soon. Use the Agenda view for now.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const [activeView, setActiveView] = useState<ViewTab>("Agenda");

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Calendar"
        description="Meetings, leaves, and team events."
        actions={
          <SegmentedControl
            options={[...viewTabs]}
            value={activeView}
            onChange={(v) => setActiveView(v as ViewTab)}
          />
        }
      />

      {activeView === "Week" && <WeekView />}
      {activeView === "Month" && <MonthView />}

      {activeView === "Agenda" && (
        <>
          {/* Today's date prominent */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5">
              <Video className="w-4 h-4 text-accent" strokeWidth={2} />
              <span className="text-[15px] font-bold text-foreground tracking-tight">
                Tuesday, April 15, 2026
              </span>
            </div>
            <span className="text-[12px] text-foreground-tertiary">
              &middot; 3 events today
            </span>
          </div>

          {/* Two-column layout: agenda + sidebar */}
          <div className="flex gap-5">
            {/* Main agenda */}
            <div className="flex-1 min-w-0">
              {weekEvents.map((day) => (
                <DayGroup key={day.date} day={day} />
              ))}
            </div>

            {/* Right sidebar */}
            <div className="hidden lg:block w-[280px] shrink-0">
              <Sidebar />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
