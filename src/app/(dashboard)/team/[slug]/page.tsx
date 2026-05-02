// ---------------------------------------------------------------------------
// /team/[slug] — full profile page (SSR for SEO + direct linking).
// Mirrors drawer content in a 2-column layout. Uses generateMetadata for og.
// ---------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  Mail, Phone, Globe, AtSign, MapPin, Calendar, Briefcase,
  type LucideIcon,
} from "lucide-react";
import type { TeamMember } from "@/lib/team/types";

export const dynamic = "force-dynamic";

interface PageProps { params: { slug: string } }

function originFromHeaders(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function fetchMember(slug: string): Promise<TeamMember | null> {
  const origin = originFromHeaders();
  const res = await fetch(`${origin}/api/team/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: { member: TeamMember | null } };
  return json.data?.member ?? null;
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
  return `Joined ${month} · ${parts.length ? parts.join(" ") : "<1mo"}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const m = await fetchMember(params.slug);
  if (!m) return { title: "Member not found · Creative Nexus" };
  const desc = m.bio?.slice(0, 160) ?? `${m.name}, ${m.title} at Creative Nexus.`;
  return {
    title: `${m.name} — ${m.title} · Creative Nexus`,
    description: desc,
    openGraph: {
      title: `${m.name} — Creative Nexus`,
      description: desc,
      images: m.photo_url ? [m.photo_url] : [],
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${m.name} — Creative Nexus`,
      description: desc,
      images: m.photo_url ? [m.photo_url] : undefined,
    },
  };
}

export default async function TeamMemberPage({ params }: PageProps) {
  const member = await fetchMember(params.slug);
  if (!member) notFound();

  const tenureText = tenure(member.joined_at);
  const initials = member.name.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/team" className="inline-flex items-center text-[13px] text-foreground-secondary hover:text-foreground transition-colors mb-6">
        ← Back to team
      </Link>

      <header className="grid md:grid-cols-[280px_1fr] gap-6 mb-10">
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-background-secondary border border-divider">
          {member.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[64px] font-bold text-foreground-tertiary">{initials}</div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/70 to-transparent" />
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-[36px] font-semibold tracking-tight text-foreground leading-tight">{member.name}</h1>
          <p className="text-[16px] text-foreground-secondary mt-1">{member.title}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-4">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent capitalize">{member.role_tag}</span>
            {member.department && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-background-secondary text-foreground-secondary border border-divider">{member.department}</span>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-background-secondary text-foreground-secondary border border-divider capitalize">{member.status}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-5">
            {member.email && <Pill href={`mailto:${member.email}`} icon={Mail} label="Email" />}
            {member.phone && <Pill href={`tel:${member.phone}`} icon={Phone} label="Call" />}
            {member.linkedin_url && <Pill href={member.linkedin_url} icon={Globe} label="LinkedIn" external />}
            {member.twitter_url && <Pill href={member.twitter_url} icon={AtSign} label="Twitter" external />}
          </div>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-8">
        <main className="md:col-span-2 space-y-6">
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground-tertiary mb-2">About</h2>
            {member.bio ? (
              <p className="text-[15px] leading-relaxed text-foreground-secondary whitespace-pre-line">{member.bio}</p>
            ) : (
              <p className="text-[14px] text-foreground-tertiary italic">No bio yet.</p>
            )}
          </section>
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground-tertiary mb-2">Recent activity</h2>
            <div className="rounded-lg border border-divider bg-background-secondary/50 p-5 text-[13px] text-foreground-tertiary">
              Project activity will appear here as we wire integrations.
            </div>
          </section>
        </main>

        <aside className="space-y-6">
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground-tertiary mb-2">At a glance</h2>
            <ul className="space-y-2 text-[13px] text-foreground-secondary">
              {member.location && <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />{member.location}</li>}
              {tenureText && <li className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />{tenureText}</li>}
              {member.department && <li className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />{member.department} · <span className="capitalize">{member.role_tag}</span></li>}
            </ul>
          </section>

          {member.skills.length > 0 && (
            <section>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground-tertiary mb-2">Skills</h2>
              <div className="flex flex-wrap gap-1.5">
                {member.skills.map((s) => (
                  <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-background-secondary text-foreground-secondary border border-divider">{s}</span>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

interface PillProps { href: string; icon: LucideIcon; label: string; external?: boolean; }
function Pill({ href, icon: Icon, label, external }: PillProps) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-background-secondary border border-divider text-[13px] font-medium text-foreground hover:bg-surface-hover transition-colors"
    >
      <Icon className="w-4 h-4 text-foreground-secondary" strokeWidth={2} />
      {label}
    </a>
  );
}
