// Shared types + brand palette for the LinkedIn module.
// Used by page.tsx and the lazy-loaded sub-components in _components/.

export const C = {
  navy: "#0B1C3D",
  navyLt: "#1A3260",
  coral: "#FF6B4A",
  green: "#22C55E",
  amber: "#F97316",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  gray: "#9CA3AF",
  bg: "#F0F2F5",
};

export interface WorkingHours {
  from: string;
  to: string;
  days: string[];
}

export type DailyLimits = Record<string, number>;

export interface Account {
  id: string;
  slug: string;
  type: "personal" | "company";
  url: string;
  name: string;
  headline: string;
  subline: string;
  location: string;
  connections: number | null;
  followers: number | null;
  recommendations?: number | null;
  experience?: number | null;
  employee_count?: number | null;
  founded?: number | null;
  company_size?: string | null;
  pic: string | null;
  bg?: string | null;
  verified?: boolean;
  premium?: boolean;
  skills?: string[];
  prev_companies?: string[];
  specialties?: string[];
  education?: string | null;
  allowed_actions: string[];
  daily_limits: DailyLimits;
  working_hours: WorkingHours;
  status: "ready" | "active" | "paused";
  role: string;
  scraped_at: string;
  created_at: string;
}

export type ProspectStatus = "pending" | "in_sequence" | "replied" | "meeting" | "opted_out";

export interface Prospect {
  id: string;
  name: string;
  firstName: string;
  headline: string;
  company: string;
  industry: string;
  location: string;
  email: string | null;
  score: number;
  step: number;
  status: ProspectStatus;
  replyReceived: boolean;
  lastAction: string | null;
  campaignId: string;
}

export type CampaignStatus = "draft" | "active" | "paused" | "complete";

export interface FunnelStep {
  id: string;
  actionId: string;
  delay: number;
  dailyLimit: number;
  template: string;
  replyDetect: boolean;
  aiPersonalise: boolean;
  spintax: boolean;
  attachImage: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  accountId: string;
  source: string;
  sourceUrl: string;
  status: CampaignStatus;
  prospects: number;
  inSequence: number;
  replied: number;
  meetings: number;
  createdAt: string;
  steps: number;
  funnelSteps: FunnelStep[];
}
