import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRABHU_SIGNATURE_HTML } from "@/lib/email-signature";
import { buildEmailPrompt } from "@/lib/leads/prompts";
import { EmailType, EmailStatus, LeadData, ORG_ID } from "@/lib/leads/types";
import { getDefaultCc } from "@/lib/email";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    lead_id: string;
    lead_data: LeadData;
    email_type: EmailType;
    previous_emails?: string[];
    auto_send?: boolean;
  };

  const { lead_id, lead_data, email_type, previous_emails } = body;

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
      maxTokens: 1024,
      temperature: 0.6,
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

    const fullBodyHtml = parsed.body + PRABHU_SIGNATURE_HTML;
    const fullBodyText = fullBodyHtml.replace(/<[^>]*>/g, "");

    let status: EmailStatus = "draft";
    if (body.auto_send && email_type === "acknowledgement") {
      status = "queued";
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
