"use client";

import { useEffect, useRef, useState } from "react";
import { X, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlowCard } from "./GlowCard";

export interface ScanSetupConfig {
  brand: string;
  domain: string;
  prompts: string[];
  competitors: string[];
}

export interface ScanSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (config: ScanSetupConfig) => void;
  defaults?: {
    brand?: string;
    domain?: string;
    prompts?: string[];
    competitors?: string[];
  };
}

export function ScanSetupModal({ open, onClose, onSubmit, defaults }: ScanSetupModalProps) {
  const [brand, setBrand] = useState("");
  const [domain, setDomain] = useState("");
  const [promptsText, setPromptsText] = useState("");
  const [competitorsText, setCompetitorsText] = useState("");
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Reset / hydrate when opened
  useEffect(() => {
    if (!open) return;
    setBrand(defaults?.brand ?? "");
    setDomain(defaults?.domain ?? "");
    setPromptsText((defaults?.prompts ?? []).join("\n"));
    setCompetitorsText((defaults?.competitors ?? []).join(", "));
    // Focus first field after paint
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }, [open, defaults]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit = brand.trim().length > 0 && promptsText.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const prompts = promptsText
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    const competitors = competitorsText
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    onSubmit({ brand: brand.trim(), domain: domain.trim(), prompts, competitors });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-setup-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close scan setup"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <GlowCard glow className="relative w-full max-w-lg">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-foreground-tertiary transition-colors hover:bg-foreground/5 hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <h2 id="scan-setup-title" className="mb-1 text-[18px] font-bold tracking-tight text-foreground">
          Set up AI visibility scan
        </h2>
        <p className="mb-5 text-[12px] text-foreground-tertiary">
          We&apos;ll query 6 AI platforms with your prompts and report mentions, citations and competitor share.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-foreground-tertiary">
              Brand name
            </label>
            <input
              ref={firstFieldRef}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Creative Nexus"
              className="w-full rounded-lg border border-divider bg-background-secondary px-3 py-2 text-[13px] text-foreground placeholder:text-foreground-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-foreground-tertiary">
              Domain
            </label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="creativenexusglobal.com"
              className="w-full rounded-lg border border-divider bg-background-secondary px-3 py-2 text-[13px] text-foreground placeholder:text-foreground-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-foreground-tertiary">
              Prompts (one per line, 5–10 recommended)
            </label>
            <textarea
              value={promptsText}
              onChange={(e) => setPromptsText(e.target.value)}
              rows={5}
              placeholder={"best AI marketing agency in India\ntop creative agencies 2026\nagency for AI search optimization"}
              className="w-full rounded-lg border border-divider bg-background-secondary px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-foreground-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-foreground-tertiary">
              Competitors (comma-separated)
            </label>
            <input
              value={competitorsText}
              onChange={(e) => setCompetitorsText(e.target.value)}
              placeholder="WebFX, Siege Media, Jasper Agency"
              className="w-full rounded-lg border border-divider bg-background-secondary px-3 py-2 text-[13px] text-foreground placeholder:text-foreground-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] text-foreground-tertiary hover:text-foreground"
            >
              Cancel
            </button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-gradient-to-r from-accent to-purple-500 text-white shadow-[0_0_20px_rgba(255,107,90,0.35)] hover:opacity-95 disabled:opacity-50"
              size="sm"
            >
              <Radar className="h-3.5 w-3.5" data-icon="inline-start" />
              Start Scan
            </Button>
          </div>
        </form>
      </GlowCard>
    </div>
  );
}
