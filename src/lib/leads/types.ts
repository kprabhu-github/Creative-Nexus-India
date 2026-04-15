// Shared types for lead qualification, email drafting, and follow-up system

export interface LeadScore {
  id: string;
  lead_id: string;
  score: number;
  reasoning: string;
  qualified: boolean;
  spam: boolean;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
}

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "closed" | "spam";

export type EmailType = "acknowledgement" | "followup_1" | "followup_2" | "followup_3" | "followup_4";

export type EmailStatus = "draft" | "queued" | "sent" | "failed" | "cancelled";

export type FollowupStatus = "pending" | "sent" | "cancelled" | "skipped";

export interface LeadEmail {
  id: string;
  lead_id: string;
  email_type: EmailType;
  to_email: string;
  cc_emails: string[];
  subject: string;
  body_html: string;
  body_text: string;
  status: EmailStatus;
  sent_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadFollowup {
  id: string;
  lead_id: string;
  step: number;
  scheduled_for: string;
  status: FollowupStatus;
  email_id: string | null;
  created_at: string;
}

// Data shape from /api/leads/website
export interface LeadData {
  id: string;
  source: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  services: string[];
  value: number;
  status: string;
  date: string;
  meta: Record<string, unknown>;
}

// Thresholds
export const LEAD_THRESHOLDS = {
  autoSend: 85,
  review: 50,
  spam: 50,
} as const;

// Follow-up intervals in days
export const FOLLOWUP_INTERVALS = [2, 4, 7, 14] as const;

// Default org ID (single-tenant for now)
export const ORG_ID = "a0000000-0000-0000-0000-000000000001";
