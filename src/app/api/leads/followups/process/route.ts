import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { sendEmail, getDefaultCc } from "@/lib/email";
import { sanitizeEmailHtml } from "@/lib/email/sanitize";
import { createNotification } from "@/lib/notifications";
import { PRABHU_SIGNATURE_HTML } from "@/lib/email-signature";
import { buildEmailPrompt } from "@/lib/leads/prompts";
import { EmailType, ORG_ID } from "@/lib/leads/types";

export async function POST() {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const cc = getDefaultCc();

  const { data: dueFollowups, error: fetchError } = await supabase
    .from("lead_followups")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(20);

  if (fetchError || !dueFollowups || dueFollowups.length === 0) {
    return NextResponse.json({ data: { processed: 0, sent: 0, cancelled: 0, failed: 0 } });
  }

  let sent = 0;
  let cancelled = 0;
  let failed = 0;

  for (const followup of dueFollowups) {
    try {
      const { data: scoreRow } = await supabase
        .from("lead_scores")
        .select("status, spam")
        .eq("lead_id", followup.lead_id)
        .single();

      if (!scoreRow || scoreRow.spam || scoreRow.status === "closed" || scoreRow.status === "spam") {
        await supabase
          .from("lead_followups")
          .update({ status: "cancelled" })
          .eq("lead_id", followup.lead_id)
          .eq("status", "pending");
        cancelled++;
        continue;
      }

      const { data: previousEmails } = await supabase
        .from("lead_emails")
        .select("subject, body_text")
        .eq("lead_id", followup.lead_id)
        .eq("status", "sent")
        .order("created_at", { ascending: true });

      const previousTexts = (previousEmails || []).map(
        (e) => `Subject: ${e.subject}\n${e.body_text.slice(0, 300)}`,
      );

      const { data: ackEmail } = await supabase
        .from("lead_emails")
        .select("to_email, body_text, subject")
        .eq("lead_id", followup.lead_id)
        .eq("email_type", "acknowledgement")
        .single();

      if (!ackEmail) {
        await supabase.from("lead_followups").update({ status: "skipped" }).eq("id", followup.id);
        continue;
      }

      const emailType = `followup_${followup.step}` as EmailType;
      const systemPrompt = buildEmailPrompt(emailType, previousTexts);

      const userMessage = `Draft follow-up ${followup.step} for this lead:

Email: ${ackEmail.to_email}
Previous acknowledgement subject: ${ackEmail.subject}
Previous email content summary: ${ackEmail.body_text.slice(0, 500)}

This is follow-up ${followup.step} of 4. Make it feel natural and provide new value.`;

      const { text } = await callClaude({
        tier: "execution",
        systemPrompt,
        userMessage,
        maxTokens: 1024,
        temperature: 0.6,
      });

      const parsed = parseClaudeJson(text) as { subject: string; body: string };

      if (!parsed.subject || !parsed.body) {
        failed++;
        continue;
      }

      const fullBodyHtml = sanitizeEmailHtml(
        parsed.body + PRABHU_SIGNATURE_HTML,
      );

      const { data: emailRow } = await supabase
        .from("lead_emails")
        .insert({
          lead_id: followup.lead_id,
          email_type: emailType,
          to_email: ackEmail.to_email,
          cc_emails: cc,
          subject: parsed.subject,
          body_html: fullBodyHtml,
          body_text: fullBodyHtml.replace(/<[^>]*>/g, ""),
          status: "queued",
          org_id: ORG_ID,
        })
        .select("id")
        .single();

      if (!emailRow) {
        failed++;
        continue;
      }

      const result = await sendEmail({
        to: ackEmail.to_email,
        cc,
        subject: parsed.subject,
        html: fullBodyHtml,
      });

      if (result.success) {
        await supabase.from("lead_emails").update({ status: "sent", sent_at: now, updated_at: now }).eq("id", emailRow.id);
        await supabase.from("lead_followups").update({ status: "sent", email_id: emailRow.id }).eq("id", followup.id);
        sent++;
      } else {
        await supabase.from("lead_emails").update({ status: "failed", error: result.error, updated_at: now }).eq("id", emailRow.id);
        failed++;
      }
    } catch (err) {
      console.error(`[followup] Error processing ${followup.id}:`, err);
      failed++;
    }
  }

  if (sent > 0) {
    await createNotification({
      title: `${sent} follow-up email${sent > 1 ? "s" : ""} sent`,
      message: `Processed ${dueFollowups.length} due follow-ups`,
      category: "leads",
      priority: "medium",
      sourceModule: "leads",
      sourceUrl: "/leads",
    });
  }

  return NextResponse.json({ data: { processed: dueFollowups.length, sent, cancelled, failed } });
}
