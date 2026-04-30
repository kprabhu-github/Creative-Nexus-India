"use client";

// Email integrations page — connect each @creativenexus.in mailbox via app password.
// Lives at /settings/integrations.

import { useCallback, useEffect, useState } from "react";

interface AccountRow {
  id: string;
  email: string;
  display_name: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  status: "connected" | "failed" | "disconnected";
  last_sync_at: string | null;
  last_error: string | null;
}

const C = {
  navy: "#0B1C3D",
  coral: "#FF6B4A",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
  gray: "#9CA3AF",
};

const SEED_MAILBOXES: { email: string; display_name: string }[] = [
  { email: "prabhu@creativenexus.in", display_name: "Prabhu K" },
  { email: "tisha@creativenexus.in", display_name: "Tisha" },
  { email: "rishabh@creativenexus.in", display_name: "Rishabh" },
  { email: "info@creativenexus.in", display_name: "Creative Nexus (info@)" },
];

export default function EmailIntegrationsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [showConnectFor, setShowConnectFor] = useState<string | null>(null);
  const [appPassword, setAppPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/accounts");
      const json = (await res.json()) as { data?: { accounts: AccountRow[] }; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setAccounts(json.data?.accounts ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleConnect(email: string, defaultDisplay: string) {
    if (!appPassword.trim()) {
      alert("Paste the 16-character Workspace app password.");
      return;
    }
    setConnecting(email);
    try {
      const res = await fetch("/api/email/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          display_name: displayName.trim() || defaultDisplay,
          app_password: appPassword.trim(),
        }),
      });
      const json = (await res.json()) as { data?: AccountRow; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setShowConnectFor(null);
      setAppPassword("");
      setDisplayName("");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setConnecting(null);
    }
  }

  async function handleTest(id: string) {
    setTesting(id);
    try {
      const res = await fetch(`/api/email/accounts/${id}/test`, { method: "POST" });
      const json = (await res.json()) as { data?: { ok: boolean }; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      alert("✓ Connection OK");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Test failed");
      await load();
    } finally {
      setTesting(null);
    }
  }

  async function handleDisconnect(id: string, email: string) {
    if (!confirm(`Disconnect ${email}? Stored credentials will be deactivated.`)) return;
    try {
      const res = await fetch(`/api/email/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Disconnect failed");
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 28px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.navy, margin: 0 }}>Email Integrations</h1>
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
          Connect each @creativenexus.in mailbox so the dashboard can send and receive on its behalf.
        </p>
      </div>

      <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 12, color: "#9A3412" }}>
        <strong>Setup:</strong> 1) Enable 2-Step Verification on the Google account &nbsp;·&nbsp; 2) Visit{" "}
        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ color: C.coral, textDecoration: "underline" }}>
          myaccount.google.com/apppasswords
        </a>{" "}
        &nbsp;·&nbsp; 3) Generate a 16-char password labeled &quot;Creative Nexus Dashboard&quot; &nbsp;·&nbsp; 4) Paste it below.
      </div>

      {error && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#991B1B", padding: "10px 14px", borderRadius: 10, fontSize: 12, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 14 }}>
        {SEED_MAILBOXES.map((seed) => {
          const acc = accounts.find((a) => a.email === seed.email);
          const isConnected = acc?.status === "connected";
          const isFailed = acc?.status === "failed";
          const statusBadge =
            isConnected ? { label: "Connected", bg: "#DCFCE7", fg: "#15803D" } :
            isFailed ? { label: "Failed", bg: "#FEE2E2", fg: "#991B1B" } :
            acc?.status === "disconnected" ? { label: "Disconnected", bg: "#F3F4F6", fg: "#6B7280" } :
            { label: "Not connected", bg: "#F3F4F6", fg: "#6B7280" };

          return (
            <div key={seed.email} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{acc?.display_name ?? seed.display_name}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{seed.email}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: statusBadge.bg, color: statusBadge.fg, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  {statusBadge.label}
                </span>
              </div>

              {acc?.last_sync_at && (
                <div style={{ fontSize: 11, color: C.gray, marginBottom: 6 }}>
                  Last sync: {new Date(acc.last_sync_at).toLocaleString("en-IN")}
                </div>
              )}
              {acc?.last_error && isFailed && (
                <div style={{ fontSize: 11, color: C.red, marginBottom: 8, background: "#FEF2F2", padding: "6px 10px", borderRadius: 6 }}>
                  {acc.last_error}
                </div>
              )}

              {showConnectFor === seed.email ? (
                <div style={{ marginTop: 8, paddingTop: 12, borderTop: "1px solid #F3F4F6" }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Display name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={seed.display_name}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12, marginBottom: 10, fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>App password (16 chars)</label>
                  <input
                    type="password"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    autoComplete="new-password"
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12, marginBottom: 10, fontFamily: "monospace", boxSizing: "border-box", letterSpacing: "1px" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleConnect(seed.email, seed.display_name)}
                      disabled={connecting === seed.email}
                      style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: connecting === seed.email ? "#F3F4F6" : C.coral, color: connecting === seed.email ? C.gray : "white", fontSize: 12, fontWeight: 700, cursor: connecting === seed.email ? "default" : "pointer", fontFamily: "inherit" }}
                    >
                      {connecting === seed.email ? "Verifying…" : "Connect & save"}
                    </button>
                    <button
                      onClick={() => { setShowConnectFor(null); setAppPassword(""); setDisplayName(""); }}
                      style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #D1D5DB", background: "white", color: "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  {acc ? (
                    <>
                      <button onClick={() => setShowConnectFor(seed.email)} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid #D1D5DB", background: "white", color: "#374151", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        Re-enter password
                      </button>
                      <button onClick={() => handleTest(acc.id)} disabled={testing === acc.id} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid #D1D5DB", background: "white", color: testing === acc.id ? C.gray : C.navy, fontSize: 11, fontWeight: 600, cursor: testing === acc.id ? "default" : "pointer", fontFamily: "inherit" }}>
                        {testing === acc.id ? "Testing…" : "Test"}
                      </button>
                      <button onClick={() => handleDisconnect(acc.id, acc.email)} style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid #FCA5A5", background: "white", color: C.red, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { setShowConnectFor(seed.email); setDisplayName(seed.display_name); }} style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "none", background: C.coral, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      Connect
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 30, color: C.gray, fontSize: 12 }}>Loading…</div>}
    </div>
  );
}
