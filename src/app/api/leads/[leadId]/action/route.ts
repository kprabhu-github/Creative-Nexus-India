// ---------------------------------------------------------------------------
// POST /api/leads/[leadId]/action -- Perform an action on a lead
// ---------------------------------------------------------------------------
// Supported actions: mark_spam, mark_qualified, mark_replied, close, stop_followups
// Body: { action: LeadAction }
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type LeadAction = "mark_spam" | "mark_qualified" | "mark_replied" | "close" | "stop_followups";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const { action } = (await request.json()) as { action: LeadAction };

  if (!leadId || !action) {
    return NextResponse.json(
      { error: "Missing leadId or action" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  switch (action) {
    case "mark_spam": {
      await supabase
        .from("lead_scores")
        .update({
          spam: true,
          qualified: false,
          status: "spam",
          updated_at: now,
        })
        .eq("lead_id", leadId);
      await supabase
        .from("lead_followups")
        .update({ status: "cancelled" })
        .eq("lead_id", leadId)
        .eq("status", "pending");
      await supabase
        .from("lead_emails")
        .update({ status: "cancelled", updated_at: now })
        .eq("lead_id", leadId)
        .in("status", ["draft", "queued"]);
      break;
    }
    case "mark_qualified": {
      await supabase
        .from("lead_scores")
        .update({
          qualified: true,
          spam: false,
          status: "qualified",
          updated_at: now,
        })
        .eq("lead_id", leadId);
      break;
    }
    case "mark_replied": {
      await supabase
        .from("lead_scores")
        .update({ status: "qualified", updated_at: now })
        .eq("lead_id", leadId);
      // Stop all pending follow-ups — lead has responded
      await supabase
        .from("lead_followups")
        .update({ status: "cancelled" })
        .eq("lead_id", leadId)
        .eq("status", "pending");
      break;
    }
    case "close": {
      await supabase
        .from("lead_scores")
        .update({ status: "closed", updated_at: now })
        .eq("lead_id", leadId);
      await supabase
        .from("lead_followups")
        .update({ status: "cancelled" })
        .eq("lead_id", leadId)
        .eq("status", "pending");
      break;
    }
    case "stop_followups": {
      await supabase
        .from("lead_followups")
        .update({ status: "cancelled" })
        .eq("lead_id", leadId)
        .eq("status", "pending");
      break;
    }
    default:
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 },
      );
  }

  return NextResponse.json({ data: { success: true, action, leadId } });
}
