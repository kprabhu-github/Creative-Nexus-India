"use client";

import { useState } from "react";
import { Clock, LogIn, LogOut, Home, Calendar } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface DayLog {
  id: string;
  day: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  status: "Present" | "WFH" | "Leave" | "Holiday";
}

const weekLog: DayLog[] = [
  { id: "d1", day: "Monday", date: "Apr 7", checkIn: "09:12 AM", checkOut: "06:45 PM", hours: "9h 33m", status: "Present" },
  { id: "d2", day: "Tuesday", date: "Apr 8", checkIn: "09:05 AM", checkOut: "07:10 PM", hours: "10h 5m", status: "Present" },
  { id: "d3", day: "Wednesday", date: "Apr 9", checkIn: "10:00 AM", checkOut: "06:30 PM", hours: "8h 30m", status: "WFH" },
  { id: "d4", day: "Thursday", date: "Apr 10", checkIn: "--", checkOut: "--", hours: "--", status: "Leave" },
  { id: "d5", day: "Friday", date: "Apr 11", checkIn: "09:20 AM", checkOut: "06:55 PM", hours: "9h 35m", status: "Present" },
];

function statusType(status: DayLog["status"]) {
  switch (status) {
    case "Present": return "success" as const;
    case "WFH": return "info" as const;
    case "Leave": return "warning" as const;
    case "Holiday": return "neutral" as const;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AttendancePage() {
  const [isWfh, setIsWfh] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Timesheet"
        description="Daily check-in/out, WFH requests, and monthly attendance reports."
      />

      {/* Today's actions */}
      <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border mb-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Today</div>
            <div className="text-[15px] font-semibold text-foreground mt-0.5">Tuesday, April 15, 2026</div>
            {checkedIn && (
              <div className="text-xs text-foreground-tertiary mt-0.5">
                Checked in at 09:15 AM {isWfh && " (WFH)"}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {/* WFH Toggle */}
            <button
              onClick={() => setIsWfh(!isWfh)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isWfh
                  ? "bg-accent/10 text-accent"
                  : "bg-foreground-tertiary/8 text-foreground-tertiary hover:text-foreground-secondary"
              }`}
            >
              <Home className="w-3.5 h-3.5" strokeWidth={2} />
              WFH
            </button>

            {/* Check-in / Check-out */}
            {!checkedIn ? (
              <Button
                size="sm"
                className="bg-success text-white hover:bg-success/90 border-transparent"
                onClick={() => setCheckedIn(true)}
              >
                <LogIn className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
                Check In
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-transparent"
                onClick={() => setCheckedIn(false)}
              >
                <LogOut className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
                Check Out
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* This Week's Log */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">This Week</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Apr 7 - Apr 11</span>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {/* Header row */}
        <div className="grid grid-cols-6 gap-3 px-3.5 py-2 bg-foreground-tertiary/5">
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider col-span-1">Day</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Check In</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Check Out</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Hours</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider col-span-1">Status</span>
        </div>
        {weekLog.map((log, i) => (
          <div key={log.id}>
            <div className="grid grid-cols-6 gap-3 items-center px-3.5 py-2.5 bg-background dark:bg-background/40">
              <div className="col-span-1">
                <div className="text-[13px] font-medium text-foreground">{log.day}</div>
                <div className="text-[11px] text-foreground-tertiary">{log.date}</div>
              </div>
              <span className="text-[13px] text-foreground-secondary">{log.checkIn}</span>
              <span className="text-[13px] text-foreground-secondary">{log.checkOut}</span>
              <span className="text-[13px] font-medium text-foreground">{log.hours}</span>
              <div className="col-span-1">
                <StatusBadge type={statusType(log.status)}>{log.status}</StatusBadge>
              </div>
            </div>
            {i < weekLog.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-4 gap-3 mt-5">
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Working Days</span>
          </div>
          <div className="text-xl font-bold text-foreground tracking-tight">22</div>
        </div>
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="flex items-center gap-2 mb-1">
            <LogIn className="w-3.5 h-3.5 text-success" strokeWidth={2} />
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Present</span>
          </div>
          <div className="text-xl font-bold text-foreground tracking-tight">
            19 <span className="text-[13px] font-normal text-foreground-tertiary">/ 22</span>
          </div>
        </div>
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-warning" strokeWidth={2} />
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Absent</span>
          </div>
          <div className="text-xl font-bold text-foreground tracking-tight">
            3 <span className="text-[13px] font-normal text-foreground-tertiary">days</span>
          </div>
        </div>
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Avg Hours</span>
          </div>
          <div className="text-xl font-bold text-foreground tracking-tight">
            9.2 <span className="text-[13px] font-normal text-foreground-tertiary">hrs/day</span>
          </div>
        </div>
      </div>
    </div>
  );
}
