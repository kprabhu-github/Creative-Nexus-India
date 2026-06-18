"use client";

// CMS connections panel — list saved connections, add a new WordPress
// connection (v1 target). Creds encrypted server-side via EMAIL_ENCRYPTION_KEY.

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Globe } from "lucide-react";

interface CmsConnection {
  id: string;
  target: string;
  site_url: string;
  label: string;
  last_used_at: string | null;
  last_status: string | null;
  created_at: string;
}

export function FixerConnections() {
  const [conns, setConns] = useState<CmsConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");

  const load = async () => {
    setLoading(true);
    const r = await fetch("/xapi/searchlens/cms-connections");
    const j = (await r.json()) as { data?: { connections: CmsConnection[] } };
    setConns(j.data?.connections ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!siteUrl || !username || !appPassword || !label) {
      setError("All fields required");
      return;
    }
    setSaving(true);
    setError(null);
    const r = await fetch("/xapi/searchlens/cms-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "wordpress",
        site_url: siteUrl,
        label,
        creds: { base_url: siteUrl, username, app_password: appPassword },
      }),
    });
    const j = (await r.json()) as { error?: string };
    setSaving(false);
    if (!r.ok) {
      setError(j.error ?? "Save failed");
      return;
    }
    setShowForm(false);
    setLabel("");
    setSiteUrl("");
    setUsername("");
    setAppPassword("");
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this connection?")) return;
    await fetch(`/xapi/searchlens/cms-connections/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-foreground-tertiary">
          Connect a CMS to deploy artifacts one-click.
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[11.5px] font-medium border border-divider hover:bg-foreground/5"
        >
          <Plus className="w-3 h-3" strokeWidth={2} />
          New
        </button>
      </div>

      {showForm && (
        <div className="space-y-2 p-3 rounded-lg border border-divider bg-background/50">
          <div className="text-[11px] font-semibold text-foreground-secondary uppercase tracking-wider">
            WordPress connection
          </div>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. ACME prod)"
            className="w-full h-9 px-3 rounded-md border border-divider bg-background text-[12.5px] focus:outline-none focus:border-accent"
          />
          <input
            type="url"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://acme.com"
            className="w-full h-9 px-3 rounded-md border border-divider bg-background text-[12.5px] focus:outline-none focus:border-accent"
          />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="WP username (admin role)"
            className="w-full h-9 px-3 rounded-md border border-divider bg-background text-[12.5px] focus:outline-none focus:border-accent"
          />
          <input
            type="password"
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
            placeholder="Application Password (xxxx xxxx xxxx xxxx)"
            className="w-full h-9 px-3 rounded-md border border-divider bg-background text-[12.5px] focus:outline-none focus:border-accent"
          />
          <div className="text-[10.5px] text-foreground-tertiary">
            Generate at WP admin → Users → Profile → Application Passwords.
          </div>
          {error && <div className="text-[11px] text-rose-500">{error}</div>}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-8 px-3 rounded-md text-[11.5px] text-foreground-secondary hover:bg-foreground/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-8 px-3 rounded-md bg-accent text-white text-[11.5px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Save connection
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {loading ? (
          <div className="text-[12px] text-foreground-tertiary py-4 text-center">Loading…</div>
        ) : conns.length === 0 ? (
          <div className="text-[12px] text-foreground-tertiary py-4 text-center">
            No connections yet.
          </div>
        ) : (
          conns.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2 px-3 rounded-md border border-divider bg-background/40">
              <Globe className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={1.8} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-foreground truncate">{c.label}</div>
                <div className="text-[10.5px] text-foreground-tertiary truncate">
                  {c.target} · {c.site_url}
                  {c.last_status ? ` · last: ${c.last_status}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="p-1 text-foreground-tertiary hover:text-rose-500"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
