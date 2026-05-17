// Per-account Gmail API client. Loads encrypted refresh token,
// transparently refreshes access token, persists the new one.

import { google, type gmail_v1 } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/email/encryption";
import { buildOAuthClient } from "@/lib/email/gmail-oauth";
import type { EmailAccount } from "@/lib/email/index";

export interface GmailClient {
  account: EmailAccount;
  gmail: gmail_v1.Gmail;
}

export async function loadGmailClient(accountId: string): Promise<GmailClient> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (error || !data) throw new Error(`Account ${accountId} not found`);
  const account = data as EmailAccount;

  if (account.provider !== "gmail_oauth") {
    throw new Error(
      `Account ${accountId} is not Gmail OAuth (${account.provider})`,
    );
  }
  if (!account.oauth_refresh_token_encrypted) {
    throw new Error(`Account ${accountId} missing refresh token`);
  }

  const refreshToken = decrypt(account.oauth_refresh_token_encrypted);

  const oauth2Client = buildOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: account.oauth_access_token_encrypted
      ? decrypt(account.oauth_access_token_encrypted)
      : undefined,
    expiry_date: account.oauth_expires_at
      ? new Date(account.oauth_expires_at).getTime()
      : undefined,
  });

  // Persist refreshed access tokens back to DB.
  oauth2Client.on("tokens", (tokens) => {
    void (async () => {
      try {
        const update: Record<string, unknown> = {};
        if (tokens.access_token) {
          update.oauth_access_token_encrypted = encrypt(tokens.access_token);
        }
        if (tokens.expiry_date) {
          update.oauth_expires_at = new Date(tokens.expiry_date).toISOString();
        }
        if (Object.keys(update).length > 0) {
          await admin
            .from("email_accounts")
            .update(update)
            .eq("id", accountId);
        }
      } catch (err) {
        console.error("[gmail-client] failed to persist refreshed token", err);
      }
    })();
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  return { account, gmail };
}
