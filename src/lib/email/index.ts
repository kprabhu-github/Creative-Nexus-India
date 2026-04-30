// Shared constants + helpers for the email integration module.

export const ORG_ID = "a0000000-0000-0000-0000-000000000001";

export interface EmailAccount {
  id: string;
  user_id: string | null;
  email: string;
  display_name: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  app_password_encrypted: string;
  status: "connected" | "failed" | "disconnected";
  last_sync_at: string | null;
  last_sync_uid: number | null;
  last_error: string | null;
  org_id: string;
  created_at: string;
  updated_at: string;
}

export interface EmailThread {
  id: string;
  account_id: string;
  subject: string | null;
  participants: string[];
  last_message_at: string | null;
  message_count: number;
  unread_count: number;
  lead_id: string | null;
  org_id: string;
  created_at: string;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  account_id: string;
  imap_uid: number | null;
  message_id: string | null;
  in_reply_to: string | null;
  references_chain: string[];
  from_email: string | null;
  to_emails: string[];
  cc_emails: string[];
  subject: string | null;
  snippet: string | null;
  direction: "inbound" | "outbound";
  is_read: boolean;
  sent_at: string | null;
  org_id: string;
  created_at: string;
}
