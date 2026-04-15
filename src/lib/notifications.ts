// ---------------------------------------------------------------------------
// Server-side notification helper — pushes to core_action_notifications
// ---------------------------------------------------------------------------
// Call from any API route to create an actionable notification that appears
// in the header bell dropdown.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001";

export interface NotificationAction {
  label: string;
  url?: string;
  api?: string;
}

export interface CreateNotificationParams {
  title: string;
  message?: string;
  category: string;
  priority?: "critical" | "high" | "medium" | "low";
  sourceModule?: string;
  sourceUrl?: string;
  actions?: NotificationAction[];
  userId?: string;
  orgId?: string;
}

/**
 * Create a notification in core_action_notifications.
 *
 * Safe to call fire-and-forget — errors are logged but never thrown so
 * callers do not need to handle notification failures.
 */
export async function createNotification(
  params: CreateNotificationParams,
): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("core_action_notifications")
      .insert({
        org_id: params.orgId ?? DEFAULT_ORG_ID,
        user_id: params.userId ?? null,
        title: params.title,
        message: params.message ?? null,
        category: params.category,
        priority: params.priority ?? "medium",
        source_module: params.sourceModule ?? null,
        source_url: params.sourceUrl ?? null,
        actions: params.actions ?? [],
        is_read: false,
        is_dismissed: false,
        is_actioned: false,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create notification:", error.message);
      return null;
    }

    return (data?.id as string) ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("createNotification error:", message);
    return null;
  }
}
