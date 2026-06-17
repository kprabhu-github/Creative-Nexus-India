"use client";

// Fixer tab — 5 deployment-ready generators for GEO/SEO. Each sub-panel is
// a focused form that POSTs to /xapi/searchlens/fix/<kind> and renders the
// generated artifact in a copy-button code block with CMS deploy notes.

import { useState } from "react";
import {
  FileCode,
  ShieldCheck,
  Tag,
  MessageSquareQuote,
  Type,
  History,
  Copy,
  Check,
  Download,
} from "lucide-react";
import {
  LlmsTxtForm,
  RobotsTxtForm,
  SchemaForm,
  AnswerBlockForm,
  MetaRewriteForm,
} from "./FixerForms";
import { FixerHistory } from "./FixerHistory";
import type { FixArtifact, FixKind } from "@/lib/searchlens/fix-types";

interface SubTab {
  key: FixKind | "history";
  label: string;
  Icon: typeof FileCode;
  hint: string;
}

const SUB_TABS: SubTab[] = [
  { key: "llms_txt", label: "llms.txt", Icon: FileCode, hint: "Help AI engines understand your site map" },
  { key: "robots_txt", label: "robots.txt", Icon: ShieldCheck, hint: "Allow / block AI crawlers explicitly" },
  { key: "schema_jsonld", label: "Schema", Icon: Tag, hint: "FAQPage JSON-LD ready to paste" },
  { key: "answer_block", label: "Answer Block", Icon: MessageSquareQuote, hint: "150-word citable block AI engines quote" },
  { key: "meta_rewrite", label: "Title + Meta", Icon: Type, hint: "3 variants per page for CTR + AI citation" },
  { key: "history", label: "History", Icon: History, hint: "All past artifacts" },
];

export function FixerTab() {
  const [active, setActive] = useState<SubTab["key"]>("llms_txt");
  const [lastArtifact, setLastArtifact] = useState<FixArtifact | null>(null);

  return (
    <div className="space-y-4">
      {/* Sub-tab strip */}
      <div
        role="tablist"
        className="flex items-center gap-1 border-b border-divider overflow-x-auto"
      >
        {SUB_TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActive(t.key);
                setLastArtifact(null);
              }}
              className={[
                "relative px-3 py-2 text-[12px] font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-foreground-tertiary hover:text-foreground-secondary",
              ].join(" ")}
            >
              <t.Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
              {t.label}
              {isActive && (
                <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-divider bg-background-secondary/40 p-4">
          <header className="mb-3">
            <h3 className="text-[13px] font-semibold text-foreground">
              {SUB_TABS.find((t) => t.key === active)?.label}
            </h3>
            <p className="text-[11px] text-foreground-tertiary">
              {SUB_TABS.find((t) => t.key === active)?.hint}
            </p>
          </header>
          {active === "llms_txt" && <LlmsTxtForm onResult={setLastArtifact} />}
          {active === "robots_txt" && <RobotsTxtForm onResult={setLastArtifact} />}
          {active === "schema_jsonld" && <SchemaForm onResult={setLastArtifact} />}
          {active === "answer_block" && <AnswerBlockForm onResult={setLastArtifact} />}
          {active === "meta_rewrite" && <MetaRewriteForm onResult={setLastArtifact} />}
          {active === "history" && <FixerHistory onPick={setLastArtifact} />}
        </section>

        <section className="rounded-xl border border-divider bg-background-secondary/40 p-4 min-h-[400px]">
          <header className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-foreground">
              Output
            </h3>
            {lastArtifact && (
              <div className="flex items-center gap-1.5">
                <CopyButton text={lastArtifact.output_text} />
                <DownloadButton artifact={lastArtifact} />
              </div>
            )}
          </header>
          {!lastArtifact ? (
            <div className="flex items-center justify-center h-[340px] text-[12px] text-foreground-tertiary">
              Fill the form on the left, click Generate. Result lands here.
            </div>
          ) : (
            <pre className="text-[11.5px] font-mono text-foreground-secondary whitespace-pre-wrap break-words leading-relaxed bg-background rounded-lg p-3 overflow-x-auto max-h-[480px]">
              {lastArtifact.output_text}
            </pre>
          )}
          {lastArtifact?.deployment_target && (
            <DeploymentNote target={lastArtifact.deployment_target} kind={lastArtifact.kind} />
          )}
        </section>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={doCopy}
      className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-foreground-secondary border border-divider hover:bg-foreground/5 transition-colors"
    >
      {copied ? (
        <Check className="w-3 h-3 text-emerald-500" strokeWidth={2} />
      ) : (
        <Copy className="w-3 h-3" strokeWidth={2} />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function DownloadButton({ artifact }: { artifact: FixArtifact }) {
  const onDownload = () => {
    const ext =
      artifact.kind === "llms_txt"
        ? "txt"
        : artifact.kind === "robots_txt"
          ? "txt"
          : artifact.kind === "schema_jsonld"
            ? "html"
            : artifact.kind === "answer_block"
              ? "html"
              : "json";
    const blob = new Blob([artifact.output_text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.kind}-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      type="button"
      onClick={onDownload}
      className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-foreground-secondary border border-divider hover:bg-foreground/5 transition-colors"
    >
      <Download className="w-3 h-3" strokeWidth={2} />
      Download
    </button>
  );
}

const DEPLOY_NOTES: Record<string, Record<FixKind, string>> = {
  wordpress: {
    llms_txt: "Upload as /llms.txt at site root via Hosting → File Manager, OR install 'Insert Headers and Footers' plugin and create a static route.",
    robots_txt: "Yoast SEO → Tools → File editor → robots.txt; OR Rank Math → General Settings → Edit robots.txt.",
    schema_jsonld: "Yoast SEO Free does NOT support custom JSON-LD; use Rank Math → Schema Generator, or paste into Customizer → Additional CSS/Header section.",
    answer_block: "Paste as Custom HTML block inside the post body, just below your H1.",
    meta_rewrite: "Yoast or Rank Math → page settings → SEO title + Meta description.",
  },
  shopify: {
    llms_txt: "Shopify doesn't allow custom root files. Add via theme.liquid + redirect rule, or use the Shopify Files Pro app.",
    robots_txt: "Online Store → Themes → Edit code → robots.txt.liquid (Shopify 2.0+).",
    schema_jsonld: "theme.liquid → before </head> → paste the <script> tag.",
    answer_block: "Product/page description rich editor → 'Show HTML' → paste.",
    meta_rewrite: "Page Edit → Search engine listing preview → Edit website SEO.",
  },
  webflow: {
    llms_txt: "Project Settings → Hosting → Custom code → Footer (renders to /llms.txt via redirect rule).",
    robots_txt: "Project Settings → SEO → robots.txt → paste content.",
    schema_jsonld: "Page Settings → Inside <head> tag → paste the <script>.",
    answer_block: "Designer → add HTML Embed block → paste.",
    meta_rewrite: "Page Settings → SEO settings → Title + Meta description.",
  },
  framer: {
    llms_txt: "Site Settings → Custom code → Body End → paste (Framer renders to /llms.txt with a redirect).",
    robots_txt: "Site Settings → SEO → robots.txt editor.",
    schema_jsonld: "Site Settings → Custom code → Head → paste the <script>.",
    answer_block: "Insert → Embed → Code → paste.",
    meta_rewrite: "Page → SEO → Title + Description.",
  },
  wix: {
    llms_txt: "Wix doesn't allow root-level file uploads natively. Use Velo / Wix Studio dynamic page returning text/plain.",
    robots_txt: "Wix Editor → Site → SEO Tools → Robots.txt → edit.",
    schema_jsonld: "Settings → Tracking & Analytics → Custom code → Head → paste.",
    answer_block: "Add → Embed → HTML iframe → paste.",
    meta_rewrite: "Page SEO Basics → Title tag + Description.",
  },
  squarespace: {
    llms_txt: "Squarespace doesn't allow root-level uploads. Use a custom page with a slug-based redirect, OR contact support.",
    robots_txt: "Squarespace generates robots.txt automatically — limited control. Use Settings → Crawlers.",
    schema_jsonld: "Settings → Advanced → Code Injection → Header → paste.",
    answer_block: "Code block on the page → paste.",
    meta_rewrite: "Page settings → SEO → SEO Title + Description.",
  },
  custom: {
    llms_txt: "Serve from your web root as /llms.txt with Content-Type: text/plain; charset=utf-8.",
    robots_txt: "Serve from /robots.txt with Content-Type: text/plain.",
    schema_jsonld: "Paste the <script> tag inside <head> of the target page's HTML.",
    answer_block: "Paste inside the page body, ideally near the top so AI crawlers see it early.",
    meta_rewrite: "Update <title> and <meta name=\"description\"> in the page <head>.",
  },
};

function DeploymentNote({ target, kind }: { target: string; kind: FixKind }) {
  const note = DEPLOY_NOTES[target]?.[kind];
  if (!note) return null;
  return (
    <div className="mt-3 p-3 rounded-lg border border-divider bg-background/50 text-[11.5px] text-foreground-secondary leading-relaxed">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-tertiary mr-2">
        Deploy on {target}:
      </span>
      {note}
    </div>
  );
}
