"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Search, MapPin, Building2, Sparkles } from "lucide-react";
import type { TeamListResponse, TeamMember, TeamRoleTag } from "@/lib/people/types";

// Lazy-loaded drawer (shipped by parallel agent C).
const TeamMemberDrawer = dynamic(
  () => import("./_components/TeamMemberDrawer"),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Role chip palette
// ---------------------------------------------------------------------------

const ROLE_CHIP: Record<Exclude<TeamRoleTag, "team" | "alumni">, { label: string; cls: string }> = {
  founder: { label: "Founder", cls: "bg-accent/12 text-accent border-accent/25" },
  mentor: { label: "Mentor", cls: "bg-purple-500/12 text-purple-500 border-purple-500/25" },
  intern: { label: "Intern", cls: "bg-blue-500/12 text-blue-500 border-blue-500/25" },
  extended: { label: "Consultant", cls: "bg-foreground-tertiary/12 text-foreground-tertiary border-foreground-tertiary/25" },
};

function roleChip(role: TeamRoleTag) {
  if (role === "team" || role === "alumni") return null;
  return ROLE_CHIP[role];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PeoplePage() {
  const [data, setData] = useState<TeamListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeDept, setActiveDept] = useState<string>("All");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Read ?dept= from URL on mount (window.location avoids the
  // useSearchParams CSR-bailout build error).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const dept = params.get("dept");
    if (dept) setActiveDept(dept);
  }, []);

  // Initial fetch (status=active by default)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/people", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: TeamListResponse; error?: string };
        if (cancelled) return;
        setData(json.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const members = useMemo(() => data?.members ?? [], [data]);
  const departments = useMemo(() => data?.departments ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const matchDept = activeDept === "All" || m.department === activeDept;
      if (!matchDept) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q)
      );
    });
  }, [members, search, activeDept]);

  const counts = useMemo(() => {
    const c = { founder: 0, team: 0, intern: 0, mentor: 0, extended: 0, alumni: 0 } as Record<TeamRoleTag, number>;
    for (const m of members) c[m.role_tag]++;
    return c;
  }, [members]);

  return (
    <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ---- Background blobs ---- */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full opacity-[0.15] blur-3xl"
          style={{ background: "radial-gradient(closest-side, #FF6B5A, transparent)" }}
        />
        <div
          className="absolute bottom-0 right-0 h-[480px] w-[480px] rounded-full opacity-[0.15] blur-3xl"
          style={{ background: "radial-gradient(closest-side, #6366F1, transparent)" }}
        />
      </div>

      <div className="relative">
        {/* ---- Hero ---- */}
        <section className="pt-2 pb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-tertiary">
            The Team
          </p>
          <h1 className="mt-3 text-[32px] md:text-[44px] font-semibold tracking-tight text-foreground">
            Meet the people behind Creative Nexus
          </h1>
          <p className="mt-3 text-[14px] text-foreground-secondary">
            {loading ? (
              <span className="opacity-50">Loading team…</span>
            ) : (
              <>
                {members.length} people · {departments.length} departments · 50+ years combined experience
              </>
            )}
          </p>

          {/* Stats pills */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <StatPill icon={<Sparkles className="h-3.5 w-3.5" strokeWidth={2} />} label={`${counts.founder} Founders`} />
            <StatPill icon={<Building2 className="h-3.5 w-3.5" strokeWidth={2} />} label={`${counts.team} Team`} />
            <StatPill icon={<Sparkles className="h-3.5 w-3.5" strokeWidth={2} />} label={`${counts.intern} Interns`} />
            <StatPill icon={<MapPin className="h-3.5 w-3.5" strokeWidth={2} />} label="2 Locations · Gurugram · Bengaluru" />
          </div>
        </section>

        {/* ---- Photo collage ---- */}
        {!loading && members.length > 0 && (
          <section className="mb-8 flex justify-center">
            <div className="grid grid-cols-7 gap-1.5 max-w-fit">
              {members.slice(0, 28).map((m) => (
                <div
                  key={`collage-${m.id}`}
                  className="relative h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-foreground-tertiary/10 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                  title={m.name}
                >
                  {m.photo_url ? (
                    <Image
                      src={m.photo_url}
                      alt={m.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-foreground-secondary">
                      {initials(m.name)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- Filter row ---- */}
        <section className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full max-w-[400px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-tertiary"
              strokeWidth={2}
            />
            <input
              type="text"
              placeholder="Search by name or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-[13px] font-medium text-foreground placeholder:text-foreground-tertiary backdrop-blur-md transition-all duration-150 focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/20 dark:bg-white/[0.03]"
            />
          </div>

          <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 md:overflow-x-visible md:pb-0">
            <DeptChip
              label="All"
              count={members.length}
              active={activeDept === "All"}
              onClick={() => setActiveDept("All")}
            />
            {departments.map((d) => (
              <DeptChip
                key={d}
                label={d}
                count={data?.counts.byDept[d] ?? 0}
                active={activeDept === d}
                onClick={() => setActiveDept(d)}
              />
            ))}
          </div>
        </section>

        {/* ---- Card grid ---- */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md dark:bg-white/[0.03]"
              >
                <div className="aspect-square w-full animate-pulse bg-foreground-tertiary/10" />
                <div className="space-y-2 p-3.5">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-foreground-tertiary/10" />
                  <div className="h-2.5 w-2/3 animate-pulse rounded bg-foreground-tertiary/10" />
                  <div className="h-4 w-16 animate-pulse rounded bg-foreground-tertiary/10" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center backdrop-blur-md">
            <p className="text-[13px] font-medium text-destructive">Couldn&apos;t load team — {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/5 px-3 text-[12px] font-medium text-foreground hover:border-accent/30"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-md dark:bg-white/[0.03]">
            <p className="text-[14px] font-medium text-foreground">No team members match</p>
            <p className="mt-1 text-[12px] text-foreground-tertiary">Try a different filter or clear your search.</p>
            {(search || activeDept !== "All") && (
              <button
                onClick={() => {
                  setSearch("");
                  setActiveDept("All");
                }}
                className="mt-4 inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/5 px-3 text-[12px] font-medium text-foreground hover:border-accent/30"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((m) => (
              <PersonCard
                key={m.id}
                member={m}
                onClick={() => setSelectedSlug(m.slug)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---- Drawer ---- */}
      {selectedSlug && (
        <TeamMemberDrawer
          slug={selectedSlug}
          onClose={() => setSelectedSlug(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (kept inline; each <80 lines)
// ---------------------------------------------------------------------------

function StatPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-medium text-foreground-secondary backdrop-blur-md dark:bg-white/[0.03]">
      <span className="text-accent">{icon}</span>
      {label}
    </span>
  );
}

function DeptChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-all duration-150 active:scale-[0.97]",
        active
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-white/10 bg-white/5 text-foreground-secondary hover:border-white/20 hover:bg-foreground-tertiary/5 dark:bg-white/[0.03]",
      ].join(" ")}
    >
      {label}
      <span
        className={[
          "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
          active ? "bg-accent/15 text-accent" : "bg-foreground-tertiary/10 text-foreground-tertiary",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}

function PersonCard({ member, onClick }: { member: TeamMember; onClick: () => void }) {
  const role = roleChip(member.role_tag);
  const href = `/people/${member.slug}`;

  return (
    <a
      href={href}
      onClick={(e) => {
        // Open route on cmd/ctrl/middle click; otherwise drawer
        if (e.metaKey || e.ctrlKey || e.button === 1 || e.shiftKey) return;
        e.preventDefault();
        onClick();
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-[0_0_30px_rgba(255,107,90,0.1)] active:scale-[0.98] dark:bg-white/[0.03]"
    >
      {/* Photo */}
      <div className="relative aspect-square w-full overflow-hidden bg-foreground-tertiary/10">
        {member.photo_url ? (
          <Image
            src={member.photo_url}
            alt={member.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-foreground-tertiary/15 to-foreground-tertiary/5">
            <span className="text-[28px] font-semibold tracking-tight text-foreground-secondary">
              {initials(member.name)}
            </span>
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <div className="text-[14px] font-semibold tracking-tight text-foreground line-clamp-1">
          {member.name}
        </div>
        <div className="text-[12px] text-foreground-tertiary line-clamp-1">
          {member.title}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {member.department && (
            <span className="inline-flex items-center rounded-md border border-white/10 bg-foreground-tertiary/8 px-1.5 py-0.5 text-[10px] font-medium text-foreground-secondary">
              {member.department}
            </span>
          )}
          {role && (
            <span
              className={[
                "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                role.cls,
              ].join(" ")}
            >
              {role.label}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
