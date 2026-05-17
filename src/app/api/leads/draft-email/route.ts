import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRABHU_SIGNATURE_HTML } from "@/lib/email-signature";
import { buildEmailPrompt } from "@/lib/leads/prompts";
import { EmailType, EmailStatus, LeadData, ORG_ID } from "@/lib/leads/types";
import { getDefaultCc } from "@/lib/email";
import { sanitizeEmailHtml } from "@/lib/email/sanitize";
import { plainTextToHtml } from "@/lib/email/format";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    lead_id: string;
    lead_data: LeadData;
    email_type: EmailType;
    previous_emails?: string[];
    auto_send?: boolean;
    replace_email_id?: string;
  };

  const { lead_id, lead_data, email_type, previous_emails, replace_email_id } = body;

  if (!lead_id || !lead_data || !email_type) {
    return NextResponse.json(
      { error: "Missing lead_id, lead_data, or email_type" },
      { status: 400 },
    );
  }

  if (!lead_data.email) {
    return NextResponse.json(
      { error: "Lead has no email address" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const cc = getDefaultCc();

  const formTitle = (lead_data.meta.form_title as string) || "contact form";
  const sourceUrl = (lead_data.meta.source_url as string) || "website";

  const userMessage = `Draft an email for this lead:

Name: ${lead_data.name}
Email: ${lead_data.email}
Company: ${lead_data.company || "not provided"}
Phone: ${lead_data.phone || "not provided"}
Message they sent: ${lead_data.message || "no message"}
Services interested in: ${lead_data.services.join(", ") || "not specified"}
Form they used: ${formTitle}
Source page: ${sourceUrl}`;

  try {
    const systemPrompt = buildEmailPrompt(email_type, previous_emails);

    const { text } = await callClaude({
      tier: "execution",
      systemPrompt,
      userMessage,
      maxTokens: 512,
      temperature: 0.4,
    });

    const parsed = parseClaudeJson(text) as {
      subject: string;
      body: string;
    };

    if (!parsed.subject || !parsed.body) {
      return NextResponse.json(
        { error: "AI failed to generate valid email content" },
        { status: 500 },
      );
    }

    // AI returns plain text; convert to HTML for email clients.
    const bodyHtml = plainTextToHtml(parsed.body);
    const fullBodyHtml = sanitizeEmailHtml(bodyHtml + PRABHU_SIGNATURE_HTML);
    const fullBodyText = parsed.body;

    let status: EmailStatus = "draft";
    if (body.auto_send && email_type === "acknowledgement") {
      status = "queued";
    }

    // If regenerating, delete the old draft/queued row before inserting a fresh one.
    if (replace_email_id) {
      await supabase
        .from("lead_emails")
        .delete()
        .eq("id", replace_email_id)
        .in("status", ["draft", "queued"]);
    }

    const { data: emailRow, error: insertError } = await supabase
      .from("lead_emails")
      .insert({
        lead_id,
        email_type,
        to_email: lead_data.email,
        cc_emails: cc,
        subject: parsed.subject,
        body_html: fullBodyHtml,
        body_text: fullBodyText,
        status,
        org_id: ORG_ID,
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to store email: ${insertError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: {
        email_id: emailRow.id,
        subject: parsed.subject,
        body_html: fullBodyHtml,
        body_text: fullBodyText,
        status,
        auto_send: status === "queued",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Email draft failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Save manual edits to a draft email (subject and/or body).
export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as {
    email_id: string;
    subject?: string;
    body_text?: string;
  };

  const { email_id, subject, body_text } = body;

  if (!email_id) {
    return NextResponse.json({ error: "Missing email_id" }, { status: 400 });
  }

  if (subject === undefined && body_text === undefined) {
    return NextResponse.json(
      { error: "Nothing to update — provide subject and/or body_text" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("lead_emails")
    .select("status")
    .eq("id", email_id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: `Email not found: ${fetchError?.message || "no record"}` },
      { status: 404 },
    );
  }

  if (existing.status === "sent") {
    return NextResponse.json(
      { error: "Cannot edit a sent email" },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (subject !== undefined) {
    updates.subject = subject;
  }
  if (body_text !== undefined) {
    updates.body_text = body_text;
    updates.body_html = sanitizeEmailHtml(
      plainTextToHtml(body_text) + PRABHU_SIGNATURE_HTML,
    );
  }

  const { error: updateError } = await supabase
    .from("lead_emails")
    .update(updates)
    .eq("id", email_id);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update email: ${updateError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { email_id, ...updates } });
}
