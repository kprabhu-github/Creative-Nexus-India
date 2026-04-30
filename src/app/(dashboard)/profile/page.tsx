"use client";

// User profile page — editable fields stored in core_users.
// Reached via top-right avatar dropdown.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  title: string | null;
  department: string | null;
  bio: string | null;
  location: string | null;
  timezone: string | null;
  slack_handle: string | null;
  linkedin_url: string | null;
  role?: string | null;
}

interface MeResponse {
  id: string;
  email: string;
  provider: string;
  created_at: string;
  last_sign_in_at: string | null;
  profile: Profile | null;
}

const EMPTY: Profile = {
  display_name: "",
  avatar_url: "",
  phone: "",
  title: "",
  department: "",
  bio: "",
  location: "",
  timezone: "Asia/Kolkata",
  slack_handle: "",
  linkedin_url: "",
};

const C = { navy: "#0B1C3D", coral: "#FF6B4A", gray: "#9CA3AF" };

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: MeResponse };
      setMe(json.data);
      setProfile({ ...EMPTY, ...(json.data.profile ?? {}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const json = (await res.json()) as { data?: Profile; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSuccess("Profile saved.");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  function setField<K extends keyof Profile>(k: K, v: Profile[K]) {
    setProfile((p) => ({ ...p, [k]: v }));
  }

  if (loading) {
    return <div style={{ padding: 30, color: C.gray, fontFamily: "system-ui" }}>Loading profile…</div>;
  }
  if (!me) {
    return <div style={{ padding: 30, color: C.gray, fontFamily: "system-ui" }}>Not signed in.</div>;
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 28px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header card */}
      <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, padding: "22px 26px", marginBottom: 16, display: "flex", gap: 18, alignItems: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: C.coral, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, flexShrink: 0 }}>
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={profile.display_name ?? me.email} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            initials(profile.display_name ?? me.email)
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>
            {profile.display_name || me.email}
          </div>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
            {profile.title ? `${profile.title} · ` : ""}{me.email}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {me.profile?.role && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 12, background: "#EEF2FF", color: "#4338CA", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                {me.profile.role.replace(/_/g, " ")}
              </span>
            )}
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 12, background: "#F3F4F6", color: "#374151", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              via {me.provider}
            </span>
            {profile.department && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 12, background: "#FFF1ED", color: C.coral, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                {profile.department}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #FCA5A5", background: "white", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: signingOut ? "default" : "pointer", fontFamily: "inherit" }}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>

      {/* Editable form */}
      <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, padding: "20px 26px", marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: C.navy }}>Profile details</h2>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: C.gray }}>These appear on your dashboard activity, in messages you send from /inbox, and on internal directories.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Display name" value={profile.display_name ?? ""} onChange={(v) => setField("display_name", v)} placeholder="K. Prabhu" />
          <Field label="Title / role at company" value={profile.title ?? ""} onChange={(v) => setField("title", v)} placeholder="Co-founder & MD" />
          <Field label="Phone" value={profile.phone ?? ""} onChange={(v) => setField("phone", v)} placeholder="+91 99992 12010" />
          <Field label="Department" value={profile.department ?? ""} onChange={(v) => setField("department", v)} placeholder="Leadership" />
          <Field label="Location" value={profile.location ?? ""} onChange={(v) => setField("location", v)} placeholder="Bengaluru, India" />
          <Field label="Timezone" value={profile.timezone ?? ""} onChange={(v) => setField("timezone", v)} placeholder="Asia/Kolkata" />
          <Field label="Slack handle" value={profile.slack_handle ?? ""} onChange={(v) => setField("slack_handle", v)} placeholder="@prabhu" />
          <Field label="LinkedIn URL" value={profile.linkedin_url ?? ""} onChange={(v) => setField("linkedin_url", v)} placeholder="https://linkedin.com/in/…" />
          <Field label="Avatar URL (optional)" value={profile.avatar_url ?? ""} onChange={(v) => setField("avatar_url", v)} placeholder="https://…" colSpan={2} />
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Bio</label>
          <textarea
            value={profile.bio ?? ""}
            onChange={(e) => setField("bio", e.target.value)}
            placeholder="A short bio that appears in your /inbox signature and team directory."
            rows={4}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
          />
        </div>

        {success && <div style={{ marginTop: 12, padding: "8px 12px", background: "#DCFCE7", color: "#15803D", borderRadius: 7, fontSize: 12 }}>{success}</div>}
        {error && <div style={{ marginTop: 12, padding: "8px 12px", background: "#FEE2E2", color: "#991B1B", borderRadius: 7, fontSize: 12 }}>{error}</div>}

        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={() => void load()}
            disabled={saving}
            style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #D1D5DB", background: "white", color: "#374151", fontSize: 12, fontWeight: 600, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: saving ? "#F3F4F6" : C.coral, color: saving ? C.gray : "white", fontSize: 12, fontWeight: 700, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>

      {/* Account meta */}
      <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, padding: "20px 26px" }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: C.navy }}>Account</h2>
        <Row label="User ID" value={me.id} mono />
        <Row label="Email" value={me.email} />
        <Row label="Sign-in provider" value={me.provider} />
        <Row label="Joined" value={new Date(me.created_at).toLocaleString("en-IN")} />
        {me.last_sign_in_at && <Row label="Last sign-in" value={new Date(me.last_sign_in_at).toLocaleString("en-IN")} />}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, colSpan }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; colSpan?: number }) {
  return (
    <div style={{ gridColumn: colSpan ? `span ${colSpan}` : undefined }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
      />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F3F4F6", fontSize: 12 }}>
      <span style={{ color: "#6B7280" }}>{label}</span>
      <span style={{ color: "#111827", fontFamily: mono ? "ui-monospace, monospace" : "inherit" }}>{value}</span>
    </div>
  );
}
