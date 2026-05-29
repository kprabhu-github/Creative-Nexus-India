"use client";

// ---------------------------------------------------------------------------
// TeamMemberDrawer — slide-in profile drawer with admin edit mode.
// Fetches /xapi/team/[slug], renders profile + edit form, PATCHes on save.
// Apple-style frosted glass, mounted-flag transitions, esc-to-close.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  X, Mail, Phone, Globe, AtSign, MapPin, Calendar, Briefcase, Pencil, Check,
  type LucideIcon,
} from "lucide-react";
import type { TeamMember } from "@/lib/team/types";

interface Props { slug: string; onClose: () => void }

interface EditState {
  title: string; department: string; bio: string; email: string; phone: string;
  linkedin_url: string; twitter_url: string; location: string; photo_url: string;
  skills: string; status: "active" | "inactive" | "alumni";
}

function tenure(joinedAt: string | null): string {
  if (!joinedAt) return "";
  const start = new Date(joinedAt);
  const now = new Date();
  if (Number.isNaN(start.getTime())) return "";
  const month = start.toLocaleString("en-US", { month: "short", year: "numeric" });
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) { years -= 1; months += 12; }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  const rel = parts.length ? parts.join(" ") : "<1mo";
  return `Joined ${month} · ${rel}`;
}

function memberToEdit(m: TeamMember): EditState {
  return {
    title: m.title ?? "", department: m.department ?? "", bio: m.bio ?? "",
    email: m.email ?? "", phone: m.phone ?? "", linkedin_url: m.linkedin_url ?? "",
    twitter_url: m.twitter_url ?? "", location: m.location ?? "",
    photo_url: m.photo_url ?? "", skills: (m.skills ?? []).join(", "), status: m.status,
  };
}

export default function TeamMemberDrawer({ slug, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [member, setMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EditState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const aborter = useRef<AbortController | null>(null);

  // Animate in on mount
  useEffect(() => { const t = setTimeout(() => setMounted(true), 10); return () => clearTimeout(t); }, []);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch
  useEffect(() => {
    aborter.current?.abort();
    const ctrl = new AbortController();
    aborter.current = ctrl;
    setLoading(true);
    setError(null);
    setEditing(false);
    fetch(`/xapi/team/${slug}`, { signal: ctrl.signal, cache: "no-store" })
      .then(async (res) => {
        if (res.status === 404) { setMember(null); setError("Member not found"); return; }
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const json = (await res.json()) as { data?: { member: TeamMember | null } };
        setMember(json.data?.member ?? null);
        if (!json.data?.member) setError("Member not found");
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [slug]);

  const handleClose = useCallback(() => { setMounted(false); setTimeout(onClose, 240); }, [onClose]);

  const startEdit = () => { if (member) { setDraft(memberToEdit(member)); setEditing(true); } };
  const cancelEdit = () => { setDraft(null); setEditing(false); };

  const saveEdit = async () => {
    if (!member || !draft) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: draft.title.trim(),
        department: draft.department.trim() || null,
        bio: draft.bio.trim() || null,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        linkedin_url: draft.linkedin_url.trim() || null,
        twitter_url: draft.twitter_url.trim() || null,
        location: draft.location.trim() || null,
        photo_url: draft.photo_url.trim() || null,
        skills: draft.skills.split(",").map((s) => s.trim()).filter(Boolean),
        status: draft.status,
      };
      const res = await fetch(`/xapi/team/${member.slug}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Save failed: ${res.status}`);
      }
      const j = (await res.json()) as { data?: { member: TeamMember } };
      if (j.data?.member) setMember(j.data.member);
      setEditing(false);
      setDraft(null);
      setToast("Profile updated");
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
      setTimeout(() => setToast(null), 3500);
    } finally { setSaving(false); }
  };

  const tenureText = useMemo(() => (member ? tenure(member.joined_at) : ""), [member]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Team member profile">
      <button
        type="button" aria-label="Close"
        onClick={handleClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-200 ${mounted ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        className={`fixed right-0 top-0 h-full w-full md:w-[480px] bg-background border-l border-white/10 backdrop-blur-2xl overflow-y-auto transition-transform duration-[250ms] ease-out ${mounted ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 h-12 bg-background/85 backdrop-blur-xl border-b border-divider">
          <button type="button" onClick={handleClose} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-surface-hover transition-colors" aria-label="Close drawer">
            <X className="w-4 h-4 text-foreground-secondary" strokeWidth={2} />
          </button>
          <span className="text-[12px] font-semibold uppercase tracking-wider text-foreground-tertiary">Profile</span>
          <div className="flex items-center gap-1.5">
            {member && !editing && (
              <button type="button" onClick={startEdit} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-surface-hover transition-colors" aria-label="Edit profile">
                <Pencil className="w-4 h-4 text-foreground-secondary" strokeWidth={2} />
              </button>
            )}
            {member && (
              <Link href={`/team/${member.slug}`} className="text-[12px] font-medium text-accent hover:underline px-2">View page</Link>
            )}
          </div>
        </div>

        {loading && (
          <div className="p-5 space-y-4">
            <div className="aspect-square w-full rounded-lg bg-background-secondary animate-pulse" />
            <div className="h-6 w-2/3 rounded bg-background-secondary animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-background-secondary animate-pulse" />
            <div className="h-24 w-full rounded bg-background-secondary animate-pulse" />
          </div>
        )}

        {!loading && (error || !member) && (
          <div className="p-8 text-center">
            <p className="text-[14px] text-foreground-secondary">{error ?? "Member not found"}</p>
            <button type="button" onClick={handleClose} className="mt-4 px-4 h-8 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity">Close</button>
          </div>
        )}

        {!loading && member && !editing && (
          <>
            <div className="relative aspect-square w-full bg-background-secondary">
              {member.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[64px] font-bold text-foreground-tertiary">
                  {member.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/90 to-transparent" />
            </div>
            <div className="p-5">
              <h2 className="text-[24px] font-semibold tracking-tight text-foreground">{member.name}</h2>
              <p className="text-[14px] text-foreground-secondary mt-0.5">{member.title}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent capitalize">{member.role_tag}</span>
                {member.department && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-background-secondary text-foreground-secondary border border-divider">{member.department}</span>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-background-secondary text-foreground-secondary border border-divider capitalize">{member.status}</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-4">
                {member.email && <ActionPill href={`mailto:${member.email}`} icon={Mail} label="Email" />}
                {member.phone && <ActionPill href={`tel:${member.phone}`} icon={Phone} label="Call" />}
                {member.linkedin_url && <ActionPill href={member.linkedin_url} icon={Globe} label="LinkedIn" external />}
                {member.twitter_url && <ActionPill href={member.twitter_url} icon={AtSign} label="Twitter" external />}
              </div>

              {member.bio && (
                <Section title="About">
                  <p className="text-[13px] leading-relaxed text-foreground-secondary whitespace-pre-line">{member.bio}</p>
                </Section>
              )}

              {member.skills.length > 0 && (
                <Section title="Skills">
                  <div className="flex flex-wrap gap-1.5">
                    {member.skills.map((s) => (
                      <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-background-secondary text-foreground-secondary border border-divider">{s}</span>
                    ))}
                  </div>
                </Section>
              )}

              <Section title="At a glance">
                <ul className="space-y-2 text-[13px] text-foreground-secondary">
                  {member.location && <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />{member.location}</li>}
                  {tenureText && <li className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />{tenureText}</li>}
                  {member.department && <li className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />{member.department} · <span className="capitalize">{member.role_tag}</span></li>}
                </ul>
              </Section>

              <Section title="Recent activity">
                <div className="rounded-lg border border-divider bg-background-secondary/50 p-4 text-[12px] text-foreground-tertiary">Project activity will appear here as we wire integrations.</div>
              </Section>
            </div>
          </>
        )}

        {!loading && member && editing && draft && (
          <form className="p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); void saveEdit(); }}>
            <TextField label="Title" value={draft.title} required onChange={(v) => setDraft({ ...draft, title: v })} />
            <TextField label="Department" value={draft.department} onChange={(v) => setDraft({ ...draft, department: v })} />
            <TextField label="Photo URL" value={draft.photo_url} placeholder="https://..." onChange={(v) => setDraft({ ...draft, photo_url: v })} />
            <Field label="Bio"><textarea rows={5} className={`${inputCls} resize-y`} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} /></Field>
            <TextField label="Email" type="email" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} />
            <TextField label="Phone" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
            <TextField label="LinkedIn URL" value={draft.linkedin_url} placeholder="https://linkedin.com/in/..." onChange={(v) => setDraft({ ...draft, linkedin_url: v })} />
            <TextField label="Twitter URL" value={draft.twitter_url} placeholder="https://twitter.com/..." onChange={(v) => setDraft({ ...draft, twitter_url: v })} />
            <TextField label="Location" value={draft.location} onChange={(v) => setDraft({ ...draft, location: v })} />
            <TextField label="Skills (comma separated)" value={draft.skills} placeholder="React, TypeScript" onChange={(v) => setDraft({ ...draft, skills: v })} />
            <Field label="Status">
              <select className={inputCls} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as EditState["status"] })}>
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="alumni">Alumni</option>
              </select>
            </Field>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-divider">
              <button type="button" onClick={cancelEdit} disabled={saving} className="h-8 px-3 rounded-md text-[13px] font-medium text-foreground-secondary hover:bg-surface-hover transition-colors flex items-center gap-1.5"><X className="w-3.5 h-3.5" strokeWidth={2} />Cancel</button>
              <button type="submit" disabled={saving} className="h-8 px-3 rounded-md text-[13px] font-medium bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"><Check className="w-3.5 h-3.5" strokeWidth={2} />{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        )}

        {toast && (
          <div className="fixed bottom-4 right-4 px-3 py-2 rounded-lg bg-foreground text-background text-[12px] font-medium shadow-lg" role="status">{toast}</div>
        )}
      </aside>
    </div>
  );
}

const inputCls = "w-full h-9 px-3 rounded-md border border-border bg-background text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-foreground-tertiary mb-1">{label}</span>
      {children}
    </label>
  );
}

interface TextFieldProps { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; }
function TextField({ label, value, onChange, type = "text", placeholder, required }: TextFieldProps) {
  return <Field label={label}><input type={type} className={inputCls} value={value} placeholder={placeholder} required={required} onChange={(e) => onChange(e.target.value)} /></Field>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground-tertiary mb-2">{title}</h3>
      {children}
    </section>
  );
}

interface ActionPillProps { href: string; icon: LucideIcon; label: string; external?: boolean; }
function ActionPill({ href, icon: Icon, label, external }: ActionPillProps) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-secondary border border-divider text-[12px] font-medium text-foreground hover:bg-surface-hover transition-colors"
    >
      <Icon className="w-3.5 h-3.5 text-foreground-secondary" strokeWidth={2} />
      {label}
    </a>
  );
}
