import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { FOLLOWUP_INTERVALS, ORG_ID } from "@/lib/leads/types";

export async function POST(request: NextRequest) {
  const { email_id } = (await request.json()) as { email_id: string };

  if (!email_id) {
    return NextResponse.json({ error: "Missing email_id" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: emailRow, error: fetchError } = await supabase
    .from("lead_emails")
    .select("*")
    .eq("id", email_id)
    .single();

  if (fetchError || !emailRow) {
    return NextResponse.json({ error: `Email not found: ${fetchError?.message || "no record"}` }, { status: 404 });
  }

  if (emailRow.status === "sent") {
    return NextResponse.json({ error: "Email already sent" }, { status: 400 });
  }

  const result = await sendEmail({
    to: emailRow.to_email,
    cc: emailRow.cc_emails,
    subject: emailRow.subject,
    html: emailRow.body_html,
    text: emailRow.body_text,
  });

  if (!result.success) {
    await supabase
      .from("lead_emails")
      .update({ status: "failed", error: result.error, updated_at: new Date().toISOString() })
      .eq("id", email_id);

    await createNotification({
      title: `Email to ${emailRow.to_email} failed`,
      message: result.error || "SMTP error",
      category: "leads",
      priority: "high",
      sourceModule: "leads",
      sourceUrl: "/leads",
    });

    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const now = new Date().toISOString();
  await supabase
    .from("lead_emails")
    .update({ status: "sent", sent_at: now, updated_at: now })
    .eq("id", email_id);

  await supabase
    .from("lead_scores")
    .update({ status: "contacted", updated_at: now })
    .eq("lead_id", emailRow.lead_id);

  if (emailRow.email_type === "acknowledgement") {
    const baseDate = new Date();
    const followupRows = FOLLOWUP_INTERVALS.map((days, i) => ({
      lead_id: emailRow.lead_id,
      step: i + 1,
      scheduled_for: new Date(baseDate.getTime() + days * 86400000).toISOString(),
      status: "pending" as const,
      org_id: ORG_ID,
    }));
    await supabase.from("lead_followups").insert(followupRows);
  }

  const isFollowup = emailRow.email_type.startsWith("followup_");
  await createNotification({
    title: isFollowup
      ? `Follow-up ${emailRow.email_type.replace("followup_", "")} sent to ${emailRow.to_email}`
      : `Email sent to ${emailRow.to_email}`,
    message: `Subject: ${emailRow.subject}`,
    category: "leads",
    priority: "medium",
    sourceModule: "leads",
    sourceUrl: "/leads",
  });

  return NextResponse.json({ data: { success: true, messageId: result.messageId } });
}
