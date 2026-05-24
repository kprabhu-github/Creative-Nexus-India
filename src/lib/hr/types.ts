// Shared types for HR (attendance + leaves) module.

export type AttendanceStatus =
  | "present"
  | "wfh"
  | "meeting"
  | "away"
  | "sick"
  | "absent"
  | "leave";

export interface AttendanceLog {
  id: string;
  org_id: string;
  team_member_id: string;
  user_id: string | null;
  log_date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  checked_in_at: string;
  last_status_change_at: string;
  ip_address: string | null;
  user_agent: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "present",
  "wfh",
  "meeting",
  "away",
  "sick",
  "absent",
  "leave",
];

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  wfh: "WFH",
  meeting: "Meeting",
  away: "Away",
  sick: "Sick",
  absent: "Absent",
  leave: "On leave",
};

export type LeaveType =
  | "casual"
  | "sick"
  | "earned"
  | "emergency"
  | "unpaid"
  | "wfh"
  | "other";

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveUrgency = "normal" | "urgent" | "emergency";

export interface LeaveRequest {
  id: string;
  org_id: string;
  team_member_id: string | null;
  employee_id: string | null;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  half_day: boolean;
  half_day_session: "AM" | "PM" | null;
  urgency: LeaveUrgency;
  reason: string | null;
  attachment_url: string | null;
  status: LeaveStatus;
  approved_by: string | null;
  decision_notes: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export const LEAVE_TYPES: LeaveType[] = [
  "casual",
  "sick",
  "earned",
  "emergency",
  "unpaid",
  "wfh",
  "other",
];

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  casual: "Casual",
  sick: "Sick",
  earned: "Earned",
  emergency: "Emergency",
  unpaid: "Unpaid",
  wfh: "WFH",
  other: "Other",
};
