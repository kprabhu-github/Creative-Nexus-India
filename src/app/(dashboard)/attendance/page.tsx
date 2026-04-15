"use client";

import { useState } from "react";
import {
  Clock, LogIn, LogOut, Home, Calendar, Plus,
  CheckCircle2, UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types & Data
// ---------------------------------------------------------------------------

type ViewTab = "My Log" | "Team View" | "Leave Requests";

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
  { id: "d1", day: "Monday", date: "Apr 14", checkIn: "09:10 AM", checkOut: "06:40 PM", hours: "9h 30m", status: "Present" },
  { id: "d2", day: "Tuesday", date: "Apr 15", checkIn: "09:15 AM", checkOut: "--", hours: "7h 23m", status: "Present" },
  { id: "d3", day: "Wednesday", date: "Apr 16", checkIn: "--", checkOut: "--", hours: "--", status: "Holiday" },
  { id: "d4", day: "Thursday", date: "Apr 17", checkIn: "--", checkOut: "--", hours: "--", status: "Holiday" },
  { id: "d5", day: "Friday", date: "Apr 18", checkIn: "--", checkOut: "--", hours: "--", status: "Holiday" },
];

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  dept: string;
  checkIn: string;
  hours: string;
  status: "Present" | "WFH" | "Leave";
}

const teamView: TeamMember[] = [
  { id: "tm1", name: "K. Prabhu", initials: "KP", dept: "Ops", checkIn: "09:00 AM", hours: "7h 30m", status: "Present" },
  { id: "tm2", name: "Rishabh Kumar", initials: "RK", dept: "Eng", checkIn: "09:05 AM", hours: "7h 25m", status: "Present" },
  { id: "tm3", name: "Ashish Kumar", initials: "AK", dept: "Design", checkIn: "09:30 AM", hours: "7h 00m", status: "WFH" },
  { id: "tm4", name: "Natraj", initials: "NR", dept: "Mktg", checkIn: "--", hours: "--", status: "Leave" },
  { id: "tm5", name: "Anit Sharma", initials: "AS", dept: "Eng", checkIn: "09:12 AM", hours: "7h 18m", status: "Present" },
  { id: "tm6", name: "Priya Nair", initials: "PN", dept: "Mktg", checkIn: "09:20 AM", hours: "7h 10m", status: "Present" },
  { id: "tm7", name: "Sneha Patel", initials: "SP", dept: "Design", checkIn: "10:00 AM", hours: "6h 30m", status: "WFH" },
  { id: "tm8", name: "Vikram Singh", initials: "VS", dept: "Eng", checkIn: "--", hours: "--", status: "Leave" },
  { id: "tm9", name: "Meera Reddy", initials: "MR", dept: "Ops", checkIn: "09:08 AM", hours: "7h 22m", status: "Present" },
  { id: "tm10", name: "Karan Joshi", initials: "KJ", dept: "Mktg", checkIn: "09:45 AM", hours: "6h 45m", status: "WFH" },
  { id: "tm11", name: "Anjali Gupta", initials: "AG", dept: "Ops", checkIn: "09:15 AM", hours: "7h 15m", status: "Present" },
  { id: "tm12", name: "Dev Patel", initials: "DP", dept: "Eng", checkIn: "09:25 AM", hours: "7h 05m", status: "WFH" },
];

interface LeaveRequest {
  id: string;
  name: string;
  initials: string;
  type: "Casual" | "Sick" | "Earned";
  from: string;
  to: string;
  days: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
}

const leaveRequests: LeaveRequest[] = [
  { id: "lr1", name: "Natraj", initials: "NR", type: "Casual", from: "Apr 18", to: "Apr 20", days: 3, reason: "Personal travel", status: "Pending" },
  { id: "lr2", name: "Vikram Singh", initials: "VS", type: "Sick", from: "Apr 15", to: "Apr 15", days: 1, reason: "Not feeling well", status: "Pending" },
];

interface LeaveBalance {
  type: string;
  used: number;
  total: number;
  color: "accent" | "success" | "warning";
}

const leaveBalances: LeaveBalance[] = [
  { type: "Casual", used: 4, total: 12, color: "accent" },
  { type: "Sick", used: 1, total: 6, color: "warning" },
  { type: "Earned", used: 3, total: 18, color: "success" },
  { type: "Comp Off", used: 0, total: 2, color: "accent" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dayStatusType(status: DayLog["status"]) {
  switch (status) {
    case "Present": return "success" as const;
    case "WFH": return "info" as const;
    case "Leave": return "warning" as const;
    case "Holiday": return "neutral" as const;
  }
}

function teamStatusType(status: TeamMember["status"]) {
  switch (status) {
    case "Present": return "success" as const;
    case "WFH": return "info" as const;
    case "Leave": return "warning" as const;
  }
}

// ---------------------------------------------------------------------------
// Tab Content
// ---------------------------------------------------------------------------

function MyLogTab({ isWfh, setIsWfh, checkedIn, setCheckedIn }: {
  isWfh: boolean;
  setIsWfh: (v: boolean) => void;
  checkedIn: boolean;
  setCheckedIn: (v: boolean) => void;
}) {
  return (
    <div>
      {/* Today Card */}
      <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border mb-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Today</div>
            <div className="text-[15px] font-semibold text-foreground mt-0.5">Tuesday, April 15, 2026</div>
            <div className="flex items-center gap-3 mt-1">
              {checkedIn && (
                <>
                  <span className="text-xs text-foreground-tertiary">Check-in: <span className="font-medium text-foreground">09:15 AM</span></span>
                  <span className="text-xs text-foreground-tertiary">Hours: <span className="font-medium text-foreground">7h 23m</span></span>
                  {isWfh && <StatusBadge type="info">WFH</StatusBadge>}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
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

      {/* Weekly Table */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">This Week</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Apr 14 - Apr 18</span>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border mb-5">
        <div className="grid grid-cols-6 gap-3 px-3.5 py-2 bg-foreground-tertiary/5">
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Day</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Check In</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Check Out</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Hours</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider col-span-2">Status</span>
        </div>
        {weekLog.map((log, i) => (
          <div key={log.id}>
            <div className="grid grid-cols-6 gap-3 items-center px-3.5 py-2.5">
              <div>
                <div className="text-[13px] font-medium text-foreground">{log.day}</div>
                <div className="text-[11px] text-foreground-tertiary">{log.date}</div>
              </div>
              <span className="text-[13px] text-foreground-secondary">{log.checkIn}</span>
              <span className="text-[13px] text-foreground-secondary">{log.checkOut}</span>
              <span className="text-[13px] font-medium text-foreground">{log.hours}</span>
              <div className="col-span-2">
                <StatusBadge type={dayStatusType(log.status)}>{log.status}</StatusBadge>
              </div>
            </div>
            {i < weekLog.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>

      {/* Monthly Summary */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Monthly Summary</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">April 2026</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Working Days</span>
          </div>
          <div className="text-xl font-bold text-foreground tracking-tight">22</div>
        </div>
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" strokeWidth={2} />
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Present</span>
          </div>
          <div className="text-xl font-bold text-foreground tracking-tight">
            19 <span className="text-[13px] font-normal text-foreground-tertiary">/ 22</span>
          </div>
        </div>
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-warning" strokeWidth={2} />
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Leaves</span>
          </div>
          <div className="text-xl font-bold text-foreground tracking-tight">
            2 <span className="text-[13px] font-normal text-foreground-tertiary">days</span>
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

function TeamViewTab() {
  return (
    <div>
      {/* Team Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-3.5 h-3.5 text-success" strokeWidth={2} />
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Present</span>
          </div>
          <div className="text-xl font-bold text-foreground tracking-tight">38</div>
        </div>
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="flex items-center gap-2 mb-1">
            <Home className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">WFH</span>
          </div>
          <div className="text-xl font-bold text-foreground tracking-tight">4</div>
        </div>
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-warning" strokeWidth={2} />
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">On Leave</span>
          </div>
          <div className="text-xl font-bold text-foreground tracking-tight">3</div>
        </div>
      </div>

      {/* Team List */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Today&apos;s Attendance</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          {teamView.length} members
        </span>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        <div className="grid grid-cols-6 gap-3 px-3.5 py-2 bg-foreground-tertiary/5">
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider col-span-2">Employee</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Check In</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Hours</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Dept</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Status</span>
        </div>
        {teamView.map((member, i) => (
          <div key={member.id}>
            <div className="grid grid-cols-6 gap-3 items-center px-3.5 py-2.5">
              <div className="col-span-2 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-semibold text-accent">{member.initials}</span>
                </div>
                <span className="text-[13px] font-medium text-foreground truncate">{member.name}</span>
              </div>
              <span className="text-[13px] text-foreground-secondary">{member.checkIn}</span>
              <span className="text-[13px] font-medium text-foreground">{member.hours}</span>
              <span className="text-[11px] text-foreground-tertiary">{member.dept}</span>
              <StatusBadge type={teamStatusType(member.status)}>{member.status}</StatusBadge>
            </div>
            {i < teamView.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaveRequestsTab() {
  return (
    <div>
      {/* Apply Button + Pending */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground">Leave Requests</span>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-warning/10 text-[11px] font-semibold text-warning">
            {leaveRequests.filter((r) => r.status === "Pending").length}
          </span>
        </div>
        <Button size="sm">
          <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
          Apply Leave
        </Button>
      </div>

      {/* Pending Requests */}
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border mb-5">
        {leaveRequests.map((req, i) => (
          <div key={req.id}>
            <div className="flex items-center gap-3 px-3.5 py-3">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-semibold text-accent">{req.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-foreground">{req.name}</div>
                <div className="text-[12px] text-foreground-tertiary mt-0.5">
                  {req.type} Leave &middot; {req.from} - {req.to} ({req.days} {req.days === 1 ? "day" : "days"})
                </div>
                <div className="text-[11px] text-foreground-tertiary mt-0.5">{req.reason}</div>
              </div>
              <StatusBadge type="warning">{req.status}</StatusBadge>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="xs"
                  className="bg-success/10 text-success hover:bg-success/20 border-transparent"
                >
                  Approve
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                >
                  Reject
                </Button>
              </div>
            </div>
            {i < leaveRequests.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>

      {/* Leave Balance */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Leave Balance</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">FY 2026-27</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {leaveBalances.map((bal) => (
          <div key={bal.type} className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
            <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1">{bal.type}</div>
            <div className="text-xl font-bold text-foreground tracking-tight">
              {bal.total - bal.used} <span className="text-[13px] font-normal text-foreground-tertiary">/ {bal.total}</span>
            </div>
            <ProgressBar value={bal.total - bal.used} max={bal.total} color={bal.color} className="mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState<ViewTab>("My Log");
  const [isWfh, setIsWfh] = useState(false);
  const [checkedIn, setCheckedIn] = useState(true);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Attendance Hub"
        description="Check-in/out, team attendance, and leave management."
        actions={
          <SegmentedControl
            options={["My Log", "Team View", "Leave Requests"]}
            value={activeTab}
            onChange={(v) => setActiveTab(v as ViewTab)}
          />
        }
      />

      {activeTab === "My Log" && (
        <MyLogTab
          isWfh={isWfh}
          setIsWfh={setIsWfh}
          checkedIn={checkedIn}
          setCheckedIn={setCheckedIn}
        />
      )}
      {activeTab === "Team View" && <TeamViewTab />}
      {activeTab === "Leave Requests" && <LeaveRequestsTab />}
    </div>
  );
}
