// ---------------------------------------------------------------------------
// Team member types — shared between API routes, seed script, and UI.
// Matches the public.hr_team_members table shape.
// ---------------------------------------------------------------------------

export type TeamRoleTag =
  | "founder"
  | "mentor"
  | "team"
  | "extended"
  | "intern"
  | "alumni";

export type TeamStatus = "active" | "inactive" | "alumni";

export interface TeamMember {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  title: string;
  department: string | null;
  role_tag: TeamRoleTag;
  photo_url: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  location: string | null;
  skills: string[];
  joined_at: string | null;
  display_order: number;
  status: TeamStatus;
  core_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamCounts {
  total: number;
  byDept: Record<string, number>;
}

export interface TeamListResponse {
  members: TeamMember[];
  departments: string[];
  counts: TeamCounts;
}
