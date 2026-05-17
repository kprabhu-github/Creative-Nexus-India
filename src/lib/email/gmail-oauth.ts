// Google OAuth2 client factory + scope constants for Gmail Core.
// Uses the Web flow with offline access so we get a refresh_token on first consent.

import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

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

// ── State binding ────────────────────────────────────────────────────────
// Prevents OAuth login-CSRF and victim-session token theft. State sent to
// Google is `userId.timestamp.nonce.hmac`. Cookie stores only the nonce; HMAC
// is computed server-side over userId+timestamp+nonce with the encryption key
// as the HMAC secret. Callback re-derives the HMAC, verifies in constant time,
// confirms the cookie nonce matches the state nonce, and confirms the
// currently-signed-in user matches the state's userId. State expires after
// STATE_TTL_MS (10 min).

const STATE_TTL_MS = 10 * 60 * 1000;

function hmacKey(): Buffer {
  const hex = process.env.EMAIL_ENCRYPTION_KEY;
  if (!hex) throw new Error("EMAIL_ENCRYPTION_KEY required for OAuth state");
  return Buffer.from(hex, "hex");
}

function computeStateHmac(payload: string): string {
  return createHmac("sha256", hmacKey()).update(payload).digest("hex");
}

export interface IssuedState {
  state: string; // value sent to Google
  nonce: string; // value stored in the cookie
}

export function issueOAuthState(userId: string): IssuedState {
  const nonce = randomBytes(16).toString("hex");
  const ts = Date.now();
  const payload = `${userId}.${ts}.${nonce}`;
  const hmac = computeStateHmac(payload);
  return { state: `${payload}.${hmac}`, nonce };
}

export interface VerifiedState {
  userId: string;
  issuedAt: number;
  nonce: string;
}

export function verifyOAuthState(
  state: string | null | undefined,
  cookieNonce: string | null | undefined,
): VerifiedState | { error: string } {
  if (!state || !cookieNonce) return { error: "missing_state_or_cookie" };
  const parts = state.split(".");
  if (parts.length !== 4) return { error: "bad_state_shape" };
  const [userId, tsStr, nonce, hmac] = parts;
  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return { error: "bad_state_timestamp" };
  if (Date.now() - ts > STATE_TTL_MS) return { error: "state_expired" };

  const expected = computeStateHmac(`${userId}.${tsStr}.${nonce}`);
  const aHmac = Buffer.from(hmac, "hex");
  const bHmac = Buffer.from(expected, "hex");
  if (aHmac.length !== bHmac.length || !timingSafeEqual(aHmac, bHmac)) {
    return { error: "bad_state_signature" };
  }

  const aNonce = Buffer.from(nonce, "hex");
  const bNonce = Buffer.from(cookieNonce, "hex");
  if (aNonce.length !== bNonce.length || !timingSafeEqual(aNonce, bNonce)) {
    return { error: "nonce_mismatch" };
  }

  return { userId, issuedAt: ts, nonce };
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
