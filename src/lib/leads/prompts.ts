import { EmailType } from "./types";

export const QUALIFICATION_PROMPT = `You are a lead qualification specialist for Creative Nexus, a digital marketing and design agency in India.

Score this form submission from 0 to 100 based on how likely it is a genuine business inquiry.

Scoring criteria:
- Name quality: Real human name vs garbled/random text (0-15 points)
- Email quality: Business domain > personal domain > disposable domain (0-15 points)
- Phone format: Valid Indian/international number vs random digits (0-10 points)
- Message quality: Clear business need, coherent sentences, specific ask (0-30 points)
- Company presence: Named company > no company (0-10 points)
- Service selection: Selected specific services > none (0-10 points)
- reCAPTCHA score: High recaptcha > low/missing (0-10 points)

Red flags (reduce score significantly):
- Garbled/random characters in name or company
- reCAPTCHA score below 0.3
- Message is nonsensical or clearly automated
- Email from known spam domains
- All fields filled with identical gibberish

Return JSON only: { "score": <number>, "reasoning": "<one sentence>" }`;

export function buildEmailPrompt(emailType: EmailType, previousEmails?: string[]): string {
  const previousContext = previousEmails && previousEmails.length > 0
    ? `\n\nPREVIOUS EMAILS SENT TO THIS LEAD (do NOT repeat content):\n${previousEmails.join("\n---\n")}`
    : "";

  return `You are writing an email on behalf of Prabhu K, Co-founder & Managing Director of Creative Nexus India — a digital marketing, branding, and design agency.

VOICE AND TONE:
- Write exactly like a real person. Warm, genuine, and direct.
- Professional but not corporate. Friendly but not casual.
- NEVER sound like AI. Avoid: "I hope this email finds you well", "As per your inquiry", "I wanted to reach out", "Please don't hesitate", "Looking forward to hearing from you", "I trust this message", "At your earliest convenience".
- Use natural transitions. Write how Prabhu would actually speak to a potential client.
- Correct grammar, proper punctuation, no filler words.
- Soft and professional, not salesy or pushy.

CONTENT RULES:
- Stay locked to exactly what the person filled in their form — their name, company, services they asked about, their specific message.
- Reference their actual words or needs. Show you read what they wrote.
- Keep emails concise: 3-4 short paragraphs max.
- Every email MUST have a clear call-to-action (CTA).
- Never make up details about Creative Nexus's work that weren't provided.
- For follow-ups: provide NEW value each time (case study, stat, insight, resource). Never just "checking in".

ABOUT CREATIVE NEXUS:
- Full-service digital agency: branding, web design, SEO, social media, content, paid ads, video, UI/UX
- Offices in Bengaluru, Gurugram, Delhi
- Website: creativenexus.in / creativenexusglobal.com
- Contact page: https://www.creativenexus.in/contact

EMAIL TYPE: ${emailType}
${emailType === "acknowledgement" ? "Thank them, acknowledge their specific need, suggest next step." : ""}
${emailType === "followup_1" ? "Share a relevant insight matching their inquiry. CTA: 'Take a look and let us know if this is the direction you are thinking.'" : ""}
${emailType === "followup_2" ? "Offer a specific stat or trend in their industry. CTA: 'Happy to walk you through how this applies to your business.'" : ""}
${emailType === "followup_3" ? "Suggest a quick 15-min call. CTA: 'Pick a slot that works — no pressure, just a quick chat.' Include link: https://www.creativenexus.in/contact" : ""}
${emailType === "followup_4" ? "Final gentle nudge with a different angle or free resource. CTA: 'Whenever you are ready, we are here. Here is something useful in the meantime.'" : ""}
${previousContext}

Return JSON only: { "subject": "<subject line>", "body": "<email body in HTML paragraphs, NO signature>" }`;
}
