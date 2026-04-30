// ---------------------------------------------------------------------------
// LinkedIn Compliance Guardrails
//
// This module is the *only* place in the codebase that decides whether an
// outreach action is allowed to be logged. It enforces:
//
//   1. Hard daily caps per account per action_key
//   2. Hard weekly caps (esp. connection requests — the riskiest surface)
//   3. Global killswitch (`stop_flag`) — operator can instantly freeze outreach
//   4. Time-based cooldown (`cooldown_until`) — auto-triggered after bad signals
//   5. Auto-cooldown on 3+ rejected/bounced outcomes in 24h
//   6. Profile URL validation — refuse deep-links that aren't linkedin.com/{in,company}
//
// This file must NEVER import Puppeteer, Playwright, Selenium, browser emulators,
// or Apify LinkedIn actors. It reads from the DB and returns decisions.
// See LinkedIn User Agreement §8.2 and Professional Community Policies.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";

// Match https://www.linkedin.com/in/<slug>/ and https://www.linkedin.com/company/<slug>/
// Variants with trailing path, query string, or no trailing slash are allowed.
// The leading www. is optional because LinkedIn canonicalizes with and without.
export const SAFE_PROFILE_URL_RE =
  /^https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|company)\/[A-Za-z0-9-_%.]+\/?(?:[?#].*)?$/i;

export function isSafeLinkedInUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return false;
  } catch {
    return false;
  }
  return SAFE_PROFILE_URL_RE.test(url);
}

// Auto-cooldown threshold: 3 rejects/bounces in 24h → 24h cooldown.
export const AUTO_COOLDOWN_REJECT_THRESHOLD = 3;
export const AUTO_COOLDOWN_HOURS = 24;

export interface AccountHealth {
  id: string;
  slug: string;
  name: string;
  type: "personal" | "company";
  warmup_tier: "new" | "building" | "established";
  hard_caps: Record<string, number>;
  weekly_limits: Record<string, number>;
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

export type ComplianceDecision =
  | { allow: true; remaining_today: number; remaining_week: number | null }
  | {
      allow: false;
      code:
        | "stopped"
        | "cooldown"
        | "daily_cap"
        | "weekly_cap"
        | "unknown_action"
        | "account_not_found"
        | "invalid_url";
      message: string;
    };

/**
 * Server-side check: is this operator allowed to log this action right now?
 * Pure function over DB state. Never blocks on network, never touches LinkedIn.
 */
export async function checkActionAllowed(
  supabase: SupabaseClient,
  accountId: string | null,
  actionKey: string,
  profileUrl?: string | null,
): Promise<ComplianceDecision> {
  // 1. Validate URL first — cheap check that protects the operator from
  //    clicking a deep-link that isn't actually a LinkedIn profile.
  if (profileUrl !== undefined && profileUrl !== null) {
    if (!isSafeLinkedInUrl(profileUrl)) {
      return {
        allow: false,
        code: "invalid_url",
        message:
          "Profile URL failed LinkedIn URL validation — refusing to log an action against an unverified URL.",
      };
    }
  }

  // 2. Some actions (visit, followup notes) may not map to an account
  //    (e.g. operator marking a prospect as skipped). Allow those.
  if (!accountId) {
    return { allow: true, remaining_today: Infinity, remaining_week: null };
  }

  const { data, error } = await supabase
    .from("linkedin_accounts_health")
    .select("*")
    .eq("id", accountId)
    .maybeSingle<AccountHealth>();

  if (error || !data) {
    return {
      allow: false,
      code: "account_not_found",
      message: `Account not found: ${error?.message ?? accountId}`,
    };
  }

  // 3. Operator killswitch — highest priority, blocks everything.
  if (data.stop_flag) {
    return {
      allow: false,
      code: "stopped",
      message: `Outreach is paused for ${data.name}${
        data.stop_flag_reason ? `: ${data.stop_flag_reason}` : ""
      }. Resume from the inbox to continue.`,
    };
  }

  // 4. Active cooldown.
  if (data.cooldown_until) {
    const until = new Date(data.cooldown_until).getTime();
    if (until > Date.now()) {
      return {
        allow: false,
        code: "cooldown",
        message: `Cooldown active until ${new Date(
          until,
        ).toLocaleString()} (${data.cooldown_reason ?? "safety pause"}).`,
      };
    }
  }

  // 5. Daily cap per action_key.
  const dailyCap = data.hard_caps?.[actionKey];
  const usedToday = data.today_usage?.[actionKey] ?? 0;
  if (dailyCap === undefined || dailyCap === null) {
    // Action key not in the cap table — refuse rather than silently allow.
    return {
      allow: false,
      code: "unknown_action",
      message: `No daily cap defined for "${actionKey}" on ${data.name}. Add it to hard_caps first.`,
    };
  }
  if (usedToday >= dailyCap) {
    return {
      allow: false,
      code: "daily_cap",
      message: `Daily cap reached for "${actionKey}" (${usedToday}/${dailyCap}). Resumes at midnight IST.`,
    };
  }

  // 6. Weekly cap (only a few action keys have them).
  const weeklyCap = data.weekly_limits?.[actionKey];
  let remainingWeek: number | null = null;
  if (weeklyCap !== undefined) {
    const usedWeek = data.week_usage?.[actionKey] ?? 0;
    if (usedWeek >= weeklyCap) {
      return {
        allow: false,
        code: "weekly_cap",
        message: `Weekly cap reached for "${actionKey}" (${usedWeek}/${weeklyCap}). Resumes next week.`,
      };
    }
    remainingWeek = weeklyCap - usedWeek - 1;
  }

  return {
    allow: true,
    remaining_today: dailyCap - usedToday - 1,
    remaining_week: remainingWeek,
  };
}

/**
 * Called by the actions endpoint after a rejected/bounced outcome.
 * If an account crosses the auto-cooldown threshold, set cooldown_until.
 */
export async function maybeAutoCooldown(
  supabase: SupabaseClient,
  accountId: string | null,
): Promise<{ triggered: boolean; until: string | null }> {
  if (!accountId) return { triggered: false, until: null };

  const { data } = await supabase
    .from("linkedin_accounts_health")
    .select("rejects_24h, cooldown_until")
    .eq("id", accountId)
    .maybeSingle<{ rejects_24h: number; cooldown_until: string | null }>();

  if (!data) return { triggered: false, until: null };

  // Don't stomp on an existing cooldown.
  if (
    data.cooldown_until &&
    new Date(data.cooldown_until).getTime() > Date.now()
  ) {
    return { triggered: false, until: data.cooldown_until };
  }

  if (data.rejects_24h >= AUTO_COOLDOWN_REJECT_THRESHOLD) {
    const until = new Date(
      Date.now() + AUTO_COOLDOWN_HOURS * 3600_000,
    ).toISOString();
    await supabase
      .from("linkedin_accounts")
      .update({
        cooldown_until: until,
        cooldown_reason: `Auto-cooldown: ${data.rejects_24h} rejects/bounces in 24h`,
      })
      .eq("id", accountId);

    await supabase.from("linkedin_activity_log").insert({
      account_id: accountId,
      message: `Auto-cooldown triggered: ${data.rejects_24h} rejects/bounces in 24h, pausing for ${AUTO_COOLDOWN_HOURS}h`,
      type: "warn",
    });

    return { triggered: true, until };
  }

  return { triggered: false, until: null };
}
