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
  const [mounted, setMounted] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Reset / hydrate when opened + trigger enter animation
  useEffect(() => {
    if (!open) { setMounted(false); return; }
    setBrand(defaults?.brand ?? "");
    setDomain(defaults?.domain ?? "");
    setPromptsText((defaults?.prompts ?? []).join("\n"));
    setCompetitorsText((defaults?.competitors ?? []).join(", "));
    requestAnimationFrame(() => {
      setMounted(true);
      firstFieldRef.current?.focus();
    });
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

  const fieldClass =
    "w-full rounded-lg border border-white/[0.08] bg-background-secondary/60 px-3.5 h-11 text-[13px] text-foreground placeholder:text-foreground-tertiary/70 transition-[border-color,box-shadow] duration-150 ease-out focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30";
  const labelClass =
    "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-foreground-tertiary";

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
        className={`absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-200 ease-out ${mounted ? "opacity-100" : "opacity-0"}`}
      />

      <div
        className={`relative w-full max-w-lg transition-[opacity,transform] duration-200 ease-out ${
          mounted ? "opacity-100 scale-100" : "opacity-0 scale-[0.96]"
        }`}
      >
        <GlowCard glow className="relative rounded-[14px] border-white/[0.08] p-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-md p-1.5 text-foreground-tertiary transition-colors duration-150 ease-out hover:bg-foreground/8 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>

          <h2 id="scan-setup-title" className="mb-1.5 text-[20px] font-semibold tracking-tight text-foreground">
            Set up AI visibility scan
          </h2>
          <p className="mb-6 text-[13px] leading-relaxed text-foreground-tertiary">
            We&apos;ll query 6 AI platforms with your prompts and report mentions, citations and competitor share.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Brand name</label>
              <input
                ref={firstFieldRef}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Creative Nexus"
                className={fieldClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Domain</label>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="creativenexusglobal.com"
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass}>Prompts (one per line, 5–10 recommended)</label>
              <textarea
                value={promptsText}
                onChange={(e) => setPromptsText(e.target.value)}
                rows={6}
                placeholder={"best AI marketing agency in India\ntop creative agencies 2026\nagency for AI search optimization"}
                className="w-full rounded-lg border border-white/[0.08] bg-background-secondary/60 px-3.5 py-2.5 font-mono text-[12.5px] leading-relaxed text-foreground placeholder:text-foreground-tertiary/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)] transition-[border-color,box-shadow] duration-150 ease-out focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30"
                required
              />
            </div>

            <div>
              <label className={labelClass}>Competitors (comma-separated)</label>
              <input
                value={competitorsText}
                onChange={(e) => setCompetitorsText(e.target.value)}
                placeholder="WebFX, Siege Media, Jasper Agency"
                className={fieldClass}
              />
            </div>

            <div className="flex items-center justify-end gap-1 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-2 text-[13px] tracking-tight text-foreground-tertiary transition-colors duration-150 ease-out hover:bg-foreground/5 hover:text-foreground"
              >
                Cancel
              </button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="bg-gradient-to-r from-accent to-purple-500 text-white shadow-[0_0_20px_rgba(255,107,90,0.35)] transition-opacity duration-150 hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                size="sm"
              >
                <Radar className="h-3.5 w-3.5" strokeWidth={1.5} data-icon="inline-start" />
                Start Scan
              </Button>
            </div>
          </form>
        </GlowCard>
      </div>
    </div>
  );
}
