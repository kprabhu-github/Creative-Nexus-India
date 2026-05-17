// Google OAuth2 client factory + scope constants for Gmail Core.
// Uses the Web flow with offline access so we get a refresh_token on first consent.

import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
] as const;

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

export function buildOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_OAUTH_REDIRECT_URI"),
  );
}

export function buildConsentUrl(state: string): string {
  const client = buildOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GMAIL_SCOPES],
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = buildOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh_token. Remove app access at " +
        "https://myaccount.google.com/permissions and re-consent.",
    );
  }
  return tokens;
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const client = buildOAuthClient();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  if (!data.email) throw new Error("Google userinfo missing email");
  return {
    email: data.email,
    name: data.name ?? data.email,
    picture: data.picture ?? null,
  };
}
