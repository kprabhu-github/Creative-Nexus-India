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
  app_password_encrypted: string | null;
  status: "connected" | "failed" | "disconnected";
  last_sync_at: string | null;
  last_sync_uid: number | null;
  last_error: string | null;
  org_id: string;
  created_at: string;
  updated_at: string;
  provider: "smtp_imap" | "gmail_oauth";
  oauth_refresh_token_encrypted: string | null;
  oauth_access_token_encrypted: string | null;
  oauth_expires_at: string | null;
  oauth_scopes: string[];
  gmail_history_id: string | null;
  gmail_watch_expiration: string | null;
  is_default: boolean;
  signature_html: string | null;
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
  gmail_thread_id: string | null;
  snippet: string | null;
  starred: boolean;
  archived: boolean;
  trashed_at: string | null;
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
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  body_html: string | null;
  body_text: string | null;
  attachments_json: unknown | null;
  status:
    | "received"
    | "queued"
    | "sending"
    | "delivered"
    | "failed"
    | "bounced";
  failure_reason: string | null;
  retry_count: number;
  sent_by_user_id: string | null;
  sent_by_agent_id: string | null;
  sending_started_at: string | null;
}

export type EmailContextType =
  | "lead"
  | "proposal"
  | "deal"
  | "client"
  | "campaign"
  | "project"
  | "none";

export type EmailLinkSource =
  | "auto_domain"
  | "auto_email"
  | "auto_subject"
  | "auto_thread"
  | "manual"
  | "ai_inferred";

export interface EmailContext {
  id: string;
  message_id: string;
  thread_id: string;
  context_type: EmailContextType;
  context_id: string | null;
  link_source: EmailLinkSource;
  confidence: number;
  org_id: string;
  created_at: string;
}

export interface EmailSendJob {
  id: string;
  message_id: string;
  account_id: string;
  status: "pending" | "locked" | "done" | "failed";
  attempts: number;
  max_attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  run_after: string;
  org_id: string;
  created_at: string;
  updated_at: string;
}
