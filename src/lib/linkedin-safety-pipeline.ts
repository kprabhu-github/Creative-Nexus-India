// ---------------------------------------------------------------------------
// LinkedIn Safety Pipeline — safeAction()
//
// Extends linkedin-compliance with a multi-stage checkpoint pipeline. Every
// operator action (about to be logged) is evaluated against these checkpoints:
//
//   CP1  url_valid        — profile_url matches linkedin.com/{in,company}/
//   CP2  account_exists   — account row is loadable from the health view
//   CP3  killswitch       — stop_flag must be false
//   CP4  cooldown_clear   — cooldown_until must be in the past or null
//   CP5  working_hours    — now is within the account's working_hours window
//   CP6  daily_cap        — today_usage[action_key] < hard_caps[action_key]
//   CP7  weekly_cap       — week_usage[action_key] < weekly_limits[action_key]
//   CP8  pacing           — seconds since last action_key >= min_interval
//   CP9  velocity         — count(action_key) in last 60min < 50% of daily cap
//   CP10 trust_score      — health_score above floor (if enough 24h activity)
//
// Each checkpoint returns { status: pass | warn | fail | skip } and a message.
// `warn` does not block; `fail` blocks. The pipeline always runs every
// checkpoint so the operator sees the full picture.
//
// No external calls. No automation. No scraping. Pure SQL reads + logic.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";
import { isSafeLinkedInUrl } from "@/lib/linkedin-compliance";

export type CheckpointStatus = "pass" | "warn" | "fail" | "skip";
export type PipelineDecision = "allow" | "warn" | "block";

export interface CheckpointResult {
  id: string;
  name: string;
  status: CheckpointStatus;
  message: string;
  hint?: string;
  meta?: Record<string, unknown>;
}

export interface SafetyPipelineResult {
  decision: PipelineDecision;
  blocked_by?: string;
  first_warning?: string;
  checkpoints: CheckpointResult[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failures: number;
    skipped: number;
  };
}

export interface SafetyInput {
  accountId: string | null;
  actionKey: string;
  profileUrl?: string | null;
  now?: Date; // injectable for testing
}

// Minimum seconds between consecutive actions of the same type.
// Chosen to mimic realistic human cadence — not so strict that operators get
// blocked mid-workflow, not so loose that a fast clicker burns through caps.
const PACING_MIN_SECONDS: Record<string, number> = {
  connect: 120,
  message: 60,
  inmail: 180,
  followup: 90,
  visit: 10,
  like: 15,
  follow: 20,
  endorse: 30,
  invite_follow: 30,
  company_message: 60,
  event_invite: 30,
  boost_post: 15,
  employee_advocate: 30,
};
const PACING_DEFAULT_SECONDS = 30;

// Velocity threshold: fraction of daily cap that, if hit in a rolling 60min
// window, is treated as suspicious clustering.
const VELOCITY_HOURLY_FRACTION = 0.5;

// Trust score floor below which we block (only when ≥5 actions in 24h exist).
const TRUST_SCORE_FAIL_FLOOR = 40;
const TRUST_SCORE_WARN_FLOOR = 70;
const TRUST_SCORE_MIN_VOLUME = 5;

interface AccountHealthRow {
  id: string;
  slug: string;
  name: string;
  type: "personal" | "company";
  warmup_tier: "new" | "building" | "established";
  hard_caps: Record<string, number>;
  weekly_limits: Record<string, number>;
  working_hours: { from: string; to: string; days: string[] } | null;
  cooldown_until: string | null;
  cooldown_reason: string | null;
  stop_flag: boolean;
  stop_flag_reason: string | null;
  today_usage: Record<string, number>;
  week_usage: Record<string, number>;
  rejects_24h: number;
  wins_24h: number;
  total_24h: number;
  health_score: number;
  risk_level: "healthy" | "at_risk" | "cooldown" | "stopped";
}

/**
 * Run the full safety pipeline. Safe to call repeatedly — it only reads.
 */
export async function safeAction(
  supabase: SupabaseClient,
  input: SafetyInput,
): Promise<SafetyPipelineResult> {
  const checkpoints: CheckpointResult[] = [];
  const now = input.now ?? new Date();

  // ── CP1: url_valid ─────────────────────────────────────────────────────
  checkpoints.push(checkUrl(input.profileUrl));

  // ── CP2: account_exists ────────────────────────────────────────────────
  if (!input.accountId) {
    checkpoints.push({
      id: "account_exists",
      name: "Account",
      status: "skip",
      message: "Action not attributed to an account",
    });
    // Skip all account-scoped checks
    checkpoints.push(skip("killswitch", "Killswitch"));
    checkpoints.push(skip("cooldown_clear", "Cooldown"));
    checkpoints.push(skip("working_hours", "Working hours"));
    checkpoints.push(skip("daily_cap", "Daily cap"));
    checkpoints.push(skip("weekly_cap", "Weekly cap"));
    checkpoints.push(skip("pacing", "Pacing"));
    checkpoints.push(skip("velocity", "Velocity"));
    checkpoints.push(skip("trust_score", "Trust score"));
    return finalize(checkpoints);
  }

  const { data: health, error: healthErr } = await supabase
    .from("linkedin_accounts_health")
    .select("*")
    .eq("id", input.accountId)
    .maybeSingle<AccountHealthRow>();

  if (healthErr || !health) {
    checkpoints.push({
      id: "account_exists",
      name: "Account",
      status: "fail",
      message: `Account not found: ${healthErr?.message ?? input.accountId}`,
    });
    return finalize(checkpoints);
  }

  checkpoints.push({
    id: "account_exists",
    name: "Account",
    status: "pass",
    message: `${health.name} · ${health.warmup_tier}`,
    meta: { slug: health.slug, risk_level: health.risk_level },
  });

  // ── CP3: killswitch ────────────────────────────────────────────────────
  checkpoints.push(checkKillswitch(health));

  // ── CP4: cooldown_clear ────────────────────────────────────────────────
  checkpoints.push(checkCooldown(health, now));

  // ── CP5: working_hours ─────────────────────────────────────────────────
  checkpoints.push(checkWorkingHours(health, now));

  // ── CP6: daily_cap ─────────────────────────────────────────────────────
  checkpoints.push(checkDailyCap(health, input.actionKey));

  // ── CP7: weekly_cap ────────────────────────────────────────────────────
  checkpoints.push(checkWeeklyCap(health, input.actionKey));

  // ── CP8: pacing ────────────────────────────────────────────────────────
  checkpoints.push(
    await checkPacing(supabase, health.id, input.actionKey, now),
  );

  // ── CP9: velocity ──────────────────────────────────────────────────────
  checkpoints.push(
    await checkVelocity(
      supabase,
      health.id,
      input.actionKey,
      now,
      health.hard_caps?.[input.actionKey],
    ),
  );

  // ── CP10: trust_score ──────────────────────────────────────────────────
  checkpoints.push(checkTrustScore(health));

  return finalize(checkpoints);
}

// ─── Checkpoint implementations ─────────────────────────────────────────────

function skip(id: string, name: string): CheckpointResult {
  return { id, name, status: "skip", message: "not applicable" };
}

function checkUrl(url: string | null | undefined): CheckpointResult {
  if (url === undefined || url === null) {
    return {
      id: "url_valid",
      name: "Profile URL",
      status: "skip",
      message: "No URL provided (not required for this action)",
    };
  }
  if (isSafeLinkedInUrl(url)) {
    return {
      id: "url_valid",
      name: "Profile URL",
      status: "pass",
      message: "URL matches linkedin.com/{in,company}/",
    };
  }
  return {
    id: "url_valid",
    name: "Profile URL",
    status: "fail",
    message: "URL doesn't match linkedin.com/{in,company}/ pattern",
    hint: "Fix the prospect's profile_url before logging an action against them.",
    meta: { url },
  };
}

function checkKillswitch(h: AccountHealthRow): CheckpointResult {
  if (h.stop_flag) {
    return {
      id: "killswitch",
      name: "Killswitch",
      status: "fail",
      message: "Outreach is paused for this account",
      hint: h.stop_flag_reason ?? "Resume from the Account Health card in the inbox.",
    };
  }
  return {
    id: "killswitch",
    name: "Killswitch",
    status: "pass",
    message: "Not paused",
  };
}

function checkCooldown(h: AccountHealthRow, now: Date): CheckpointResult {
  if (!h.cooldown_until) {
    return {
      id: "cooldown_clear",
      name: "Cooldown",
      status: "pass",
      message: "No active cooldown",
    };
  }
  const until = new Date(h.cooldown_until).getTime();
  if (until <= now.getTime()) {
    return {
      id: "cooldown_clear",
      name: "Cooldown",
      status: "pass",
      message: "Cooldown expired",
    };
  }
  const hoursLeft = Math.ceil((until - now.getTime()) / 3600_000);
  return {
    id: "cooldown_clear",
    name: "Cooldown",
    status: "fail",
    message: `Cooldown active ~${hoursLeft}h more`,
    hint: h.cooldown_reason ?? "Wait it out or clear it manually from the health card.",
    meta: { until: h.cooldown_until, hours_left: hoursLeft },
  };
}

// Days come in short form like "Mon" "Tue". Normalize to ints (0=Sun..6=Sat).
const DAY_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

function parseHHMM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

function checkWorkingHours(
  h: AccountHealthRow,
  now: Date,
): CheckpointResult {
  const wh = h.working_hours;
  if (!wh) {
    return {
      id: "working_hours",
      name: "Working hours",
      status: "skip",
      message: "No working hours configured",
    };
  }

  // Use IST since the rest of the system is India-operating.
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const dayIdx = ist.getUTCDay();
  const hour = ist.getUTCHours();
  const mins = ist.getUTCMinutes();
  const nowMinutes = hour * 60 + mins;

  const allowedDays = (wh.days ?? [])
    .map((d) => DAY_MAP[d.toLowerCase().slice(0, 3)])
    .filter((n): n is number => n !== undefined);

  if (allowedDays.length > 0 && !allowedDays.includes(dayIdx)) {
    return {
      id: "working_hours",
      name: "Working hours",
      status: "warn",
      message: `Outside working days (today is day ${dayIdx})`,
      hint: "Action will be logged but flagged for review. Working on weekends increases detection risk.",
    };
  }

  const from = parseHHMM(wh.from ?? "09:00");
  const to = parseHHMM(wh.to ?? "18:00");
  if (!from || !to) {
    return {
      id: "working_hours",
      name: "Working hours",
      status: "skip",
      message: "Working hours misconfigured",
    };
  }
  const fromMinutes = from.h * 60 + from.m;
  const toMinutes = to.h * 60 + to.m;

  if (nowMinutes < fromMinutes || nowMinutes > toMinutes) {
    const currentTime = `${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    return {
      id: "working_hours",
      name: "Working hours",
      status: "warn",
      message: `Outside working hours (now ${currentTime} IST, window ${wh.from}-${wh.to})`,
      hint: "Off-hours outreach is a weak detection signal on its own, but clustering off-hours increases risk.",
      meta: { now_ist: currentTime, from: wh.from, to: wh.to },
    };
  }

  return {
    id: "working_hours",
    name: "Working hours",
    status: "pass",
    message: `${wh.from}-${wh.to} IST · currently in window`,
  };
}

function checkDailyCap(
  h: AccountHealthRow,
  actionKey: string,
): CheckpointResult {
  const cap = h.hard_caps?.[actionKey];
  const used = h.today_usage?.[actionKey] ?? 0;

  if (cap === undefined || cap === null) {
    return {
      id: "daily_cap",
      name: "Daily cap",
      status: "fail",
      message: `No daily cap configured for "${actionKey}"`,
      hint: "Add this action_key to the account's hard_caps JSON.",
    };
  }
  if (used >= cap) {
    return {
      id: "daily_cap",
      name: "Daily cap",
      status: "fail",
      message: `${used}/${cap} today — cap reached`,
      hint: "Resets at midnight IST.",
      meta: { used, cap, remaining: 0 },
    };
  }
  const pct = Math.round((used / cap) * 100);
  return {
    id: "daily_cap",
    name: "Daily cap",
    status: pct >= 80 ? "warn" : "pass",
    message: `${used}/${cap} today${pct >= 80 ? " — near limit" : ""}`,
    meta: { used, cap, remaining: cap - used, pct },
  };
}

function checkWeeklyCap(
  h: AccountHealthRow,
  actionKey: string,
): CheckpointResult {
  const cap = h.weekly_limits?.[actionKey];
  const used = h.week_usage?.[actionKey] ?? 0;

  if (cap === undefined || cap === null) {
    return {
      id: "weekly_cap",
      name: "Weekly cap",
      status: "skip",
      message: "No weekly cap for this action",
    };
  }
  if (used >= cap) {
    return {
      id: "weekly_cap",
      name: "Weekly cap",
      status: "fail",
      message: `${used}/${cap} this week — cap reached`,
      hint: "Resets at midnight IST on Monday.",
      meta: { used, cap, remaining: 0 },
    };
  }
  const pct = Math.round((used / cap) * 100);
  return {
    id: "weekly_cap",
    name: "Weekly cap",
    status: pct >= 80 ? "warn" : "pass",
    message: `${used}/${cap} this week${pct >= 80 ? " — near limit" : ""}`,
    meta: { used, cap, remaining: cap - used, pct },
  };
}

async function checkPacing(
  supabase: SupabaseClient,
  accountId: string,
  actionKey: string,
  now: Date,
): Promise<CheckpointResult> {
  const minSeconds = PACING_MIN_SECONDS[actionKey] ?? PACING_DEFAULT_SECONDS;

  const { data } = await supabase
    .from("linkedin_prospect_actions")
    .select("created_at")
    .eq("account_id", accountId)
    .eq("action_key", actionKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();

  if (!data) {
    return {
      id: "pacing",
      name: "Pacing",
      status: "pass",
      message: `First "${actionKey}" of the session`,
      meta: { min_seconds: minSeconds },
    };
  }

  const elapsed = (now.getTime() - new Date(data.created_at).getTime()) / 1000;
  if (elapsed < minSeconds) {
    const waitSeconds = Math.ceil(minSeconds - elapsed);
    return {
      id: "pacing",
      name: "Pacing",
      status: "fail",
      message: `Last "${actionKey}" was ${Math.round(elapsed)}s ago (min ${minSeconds}s)`,
      hint: `Wait ~${waitSeconds}s to avoid rapid-fire pattern detection.`,
      meta: { elapsed_s: Math.round(elapsed), min_s: minSeconds, wait_s: waitSeconds },
    };
  }
  return {
    id: "pacing",
    name: "Pacing",
    status: "pass",
    message: `${Math.round(elapsed)}s since last "${actionKey}"`,
    meta: { elapsed_s: Math.round(elapsed), min_s: minSeconds },
  };
}

async function checkVelocity(
  supabase: SupabaseClient,
  accountId: string,
  actionKey: string,
  now: Date,
  dailyCap: number | undefined,
): Promise<CheckpointResult> {
  if (!dailyCap || dailyCap <= 0) {
    return {
      id: "velocity",
      name: "Velocity",
      status: "skip",
      message: "No daily cap to compare against",
    };
  }
  const hourAgo = new Date(now.getTime() - 3600_000).toISOString();
  const { count } = await supabase
    .from("linkedin_prospect_actions")
    .select("*", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("action_key", actionKey)
    .gte("created_at", hourAgo);

  const countLastHour = count ?? 0;
  const threshold = Math.max(1, Math.ceil(dailyCap * VELOCITY_HOURLY_FRACTION));

  if (countLastHour >= threshold) {
    return {
      id: "velocity",
      name: "Velocity",
      status: "warn",
      message: `${countLastHour} "${actionKey}" in the last hour (threshold ${threshold})`,
      hint: "Clustered activity is a detection signal. Spread actions through working hours.",
      meta: { count_last_hour: countLastHour, threshold, daily_cap: dailyCap },
    };
  }
  return {
    id: "velocity",
    name: "Velocity",
    status: "pass",
    message: `${countLastHour} "${actionKey}" in the last hour (ok)`,
    meta: { count_last_hour: countLastHour, threshold },
  };
}

function checkTrustScore(h: AccountHealthRow): CheckpointResult {
  if (h.total_24h < TRUST_SCORE_MIN_VOLUME) {
    return {
      id: "trust_score",
      name: "Trust score",
      status: "skip",
      message: `Not enough 24h activity to compute (${h.total_24h}/${TRUST_SCORE_MIN_VOLUME})`,
      meta: { score: h.health_score, total_24h: h.total_24h },
    };
  }
  if (h.health_score < TRUST_SCORE_FAIL_FLOOR) {
    return {
      id: "trust_score",
      name: "Trust score",
      status: "fail",
      message: `Health score ${h.health_score}/100 — too many rejections (${h.rejects_24h}/${h.total_24h})`,
      hint: "Pause the account and review your last few messages/prospects.",
      meta: { score: h.health_score, rejects: h.rejects_24h, total: h.total_24h },
    };
  }
  if (h.health_score < TRUST_SCORE_WARN_FLOOR) {
    return {
      id: "trust_score",
      name: "Trust score",
      status: "warn",
      message: `Health score ${h.health_score}/100 — elevated rejection rate`,
      hint: "Slow down. High rejections trigger LinkedIn's ML.",
      meta: { score: h.health_score, rejects: h.rejects_24h, total: h.total_24h },
    };
  }
  return {
    id: "trust_score",
    name: "Trust score",
    status: "pass",
    message: `Health score ${h.health_score}/100 (${h.rejects_24h} rejects / ${h.total_24h} actions)`,
    meta: { score: h.health_score },
  };
}

// ─── Finalizer ─────────────────────────────────────────────────────────────

function finalize(checkpoints: CheckpointResult[]): SafetyPipelineResult {
  const failures = checkpoints.filter((c) => c.status === "fail");
  const warnings = checkpoints.filter((c) => c.status === "warn");
  const passed = checkpoints.filter((c) => c.status === "pass").length;
  const skipped = checkpoints.filter((c) => c.status === "skip").length;

  let decision: PipelineDecision = "allow";
  if (failures.length > 0) decision = "block";
  else if (warnings.length > 0) decision = "warn";

  return {
    decision,
    blocked_by: failures[0]?.id,
    first_warning: warnings[0]?.id,
    checkpoints,
    summary: {
      total: checkpoints.length,
      passed,
      warnings: warnings.length,
      failures: failures.length,
      skipped,
    },
  };
}
