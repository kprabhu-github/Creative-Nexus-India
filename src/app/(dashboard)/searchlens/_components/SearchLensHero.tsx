"use client";

import { useState, FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

export interface SearchLensHeroProps {
  /** Called with the user-typed domain when CTA submits. Parent should open ScanSetupModal pre-filled. */
  onCheck: (domain: string) => void;
  scanning: boolean;
}

export function SearchLensHero({ onCheck, scanning }: SearchLensHeroProps) {
  const [domain, setDomain] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onCheck(domain.trim());
  }

  return (
    <section className="relative isolate overflow-hidden rounded-[16px] border border-divider bg-background-secondary px-6 py-14 sm:py-20">
      {/* Decorative glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-accent/30 opacity-40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-purple-500/30 opacity-30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-40 w-[60%] -translate-x-1/2 rounded-full bg-pink-400/20 opacity-30 blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          AI Visibility
        </div>

        <h1 className="text-[40px] font-bold leading-[1.05] tracking-tight text-foreground md:text-[56px]">
          Win Every Search
          <br />
          <span className="bg-gradient-to-r from-accent via-pink-500 to-purple-500 bg-clip-text text-transparent">
            From Traditional SEO to AI Discovery
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-[14px] text-foreground-secondary md:text-[16px]">
          Track your brand visibility, fix gaps, and grow across Google and AI search&mdash;all from one trusted platform.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-8 flex max-w-xl items-center gap-1 rounded-full border border-divider bg-background p-1.5 shadow-[0_0_60px_rgba(255,107,90,0.15)]"
        >
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourbrand.com"
            disabled={scanning}
            className="flex-1 bg-transparent px-4 py-2 text-[14px] text-foreground placeholder:text-foreground-tertiary focus:outline-none disabled:opacity-50"
            aria-label="Your domain"
          />
          <button
            type="submit"
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent to-purple-500 px-5 py-2 text-[13px] font-semibold text-white shadow-[0_0_24px_rgba(255,107,90,0.4)] transition-all hover:opacity-95 disabled:opacity-60"
          >
            {scanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
            <span>{scanning ? "Scanning…" : "Check AI Visibility"}</span>
          </button>
        </form>

        <p className="mt-4 text-[11px] text-foreground-tertiary">
          Free scan across ChatGPT, Gemini, Perplexity, AI Overviews, Copilot &amp; Claude
        </p>
      </div>
    </section>
  );
}
