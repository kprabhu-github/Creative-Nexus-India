"use client";

// 5 generator forms for the Fixer tab. Each posts to its dedicated route
// under /xapi/searchlens/fix/* and bubbles the resulting artifact up via
// onResult so the parent can render it in the output pane.

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react"; // Loader2 used by <Submit>; Plus + Trash2 used by add/remove row controls.
import type {
  CmsTarget,
  FixArtifact,
} from "@/lib/searchlens/fix-types";
import { CMS_LABEL, CMS_TARGETS, AI_CRAWLERS } from "@/lib/searchlens/fix-types";

interface FormProps {
  onResult: (a: FixArtifact) => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Shared submit helper
// ─────────────────────────────────────────────────────────────────────────

async function submit(
  url: string,
  body: unknown,
): Promise<FixArtifact | { error: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { artifact: FixArtifact };
      error?: string;
    };
    if (!res.ok || !json.data?.artifact) {
      return { error: json.error ?? `HTTP ${res.status}` };
    }
    return json.data.artifact;
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// llms.txt
// ─────────────────────────────────────────────────────────────────────────

export function LlmsTxtForm({ onResult }: FormProps) {
  const [domain, setDomain] = useState("creativenexus.in");
  const [brand, setBrand] = useState("Creative Nexus");
  const [pitch, setPitch] = useState(
    "An AI-native marketing agency that ships brand, content, performance and websites.",
  );
  const [pages, setPages] = useState<
    Array<{ url: string; title: string; summary: string }>
  >([
    { url: "https://creativenexus.in/", title: "Home", summary: "Agency overview + featured work" },
    { url: "https://creativenexus.in/about-us/", title: "About", summary: "Founding team + 27-person org" },
    { url: "https://creativenexus.in/services/", title: "Services", summary: "Branding, content, ads, websites" },
  ]);
  const [cms, setCms] = useState<CmsTarget>("wordpress");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    const res = await submit("/xapi/searchlens/fix/llms-txt", {
      domain,
      brand_name: brand,
      one_line_pitch: pitch,
      key_pages: pages.filter((p) => p.url && p.title),
      cms,
    });
    if ("error" in res) setError(res.error);
    else onResult(res);
    setBusy(false);
  };

  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        void generate();
      }}
    >
      <Field label="Brand domain" required>
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className={input()}
        />
      </Field>
      <Field label="Brand name" required>
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className={input()}
        />
      </Field>
      <Field label="One-line pitch" required>
        <textarea
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          rows={2}
          className={input("resize-y min-h-[52px]")}
        />
      </Field>

      <Field label="Key pages">
        <div className="space-y-1.5">
          {pages.map((p, i) => (
            <div key={i} className="grid grid-cols-[1.4fr_1fr_2fr_auto] gap-1.5">
              <input
                value={p.url}
                onChange={(e) =>
                  setPages((arr) =>
                    arr.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)),
                  )
                }
                placeholder="https://…"
                className={input()}
              />
              <input
                value={p.title}
                onChange={(e) =>
                  setPages((arr) =>
                    arr.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                  )
                }
                placeholder="Title"
                className={input()}
              />
              <input
                value={p.summary}
                onChange={(e) =>
                  setPages((arr) =>
                    arr.map((x, j) => (j === i ? { ...x, summary: e.target.value } : x)),
                  )
                }
                placeholder="One-line summary"
                className={input()}
              />
              <button
                type="button"
                onClick={() => setPages((arr) => arr.filter((_, j) => j !== i))}
                className="w-7 h-9 inline-flex items-center justify-center rounded-md text-foreground-tertiary hover:text-rose-500 hover:bg-rose-500/10"
                aria-label="Remove row"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPages((arr) => [...arr, { url: "", title: "", summary: "" }])}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline"
          >
            <Plus className="w-3 h-3" strokeWidth={2} />
            Add page
          </button>
        </div>
      </Field>

      <CmsPicker value={cms} onChange={setCms} />
      <Submit busy={busy} error={error} label="Generate llms.txt" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// robots.txt
// ─────────────────────────────────────────────────────────────────────────

export function RobotsTxtForm({ onResult }: FormProps) {
  const [domain, setDomain] = useState("creativenexus.in");
  const [sitemap, setSitemap] = useState("https://creativenexus.in/sitemap.xml");
  const [cms, setCms] = useState<CmsTarget>("wordpress");
  const [rules, setRules] = useState(
    AI_CRAWLERS.map((c) => ({
      user_agent: c.agent,
      directive: c.default as "allow" | "disallow",
      path: "/",
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    const res = await submit("/xapi/searchlens/fix/robots-txt", {
      domain,
      sitemap_url: sitemap || undefined,
      rules,
      cms,
    });
    if ("error" in res) setError(res.error);
    else onResult(res);
    setBusy(false);
  };

  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        void generate();
      }}
    >
      <Field label="Domain" required>
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className={input()}
        />
      </Field>
      <Field label="Sitemap URL">
        <input
          value={sitemap}
          onChange={(e) => setSitemap(e.target.value)}
          placeholder="https://example.com/sitemap.xml"
          className={input()}
        />
      </Field>

      <Field label="AI crawler rules">
        <div className="space-y-1">
          {rules.map((r, i) => (
            <div key={r.user_agent} className="flex items-center gap-2 text-[12px]">
              <span className="w-44 truncate text-foreground" title={AI_CRAWLERS[i]?.vendor}>
                {r.user_agent}
                <span className="text-foreground-tertiary ml-1.5 text-[10.5px]">
                  ({AI_CRAWLERS[i]?.vendor})
                </span>
              </span>
              <select
                value={r.directive}
                onChange={(e) =>
                  setRules((arr) =>
                    arr.map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            directive: e.target.value as "allow" | "disallow",
                          }
                        : x,
                    ),
                  )
                }
                className={input("h-8 w-28 text-[11.5px]")}
              >
                <option value="allow">Allow</option>
                <option value="disallow">Disallow</option>
              </select>
              <input
                value={r.path}
                onChange={(e) =>
                  setRules((arr) =>
                    arr.map((x, j) => (j === i ? { ...x, path: e.target.value } : x)),
                  )
                }
                className={input("h-8 flex-1 text-[11.5px]")}
              />
            </div>
          ))}
        </div>
      </Field>

      <CmsPicker value={cms} onChange={setCms} />
      <Submit busy={busy} error={error} label="Generate robots.txt" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FAQ Schema
// ─────────────────────────────────────────────────────────────────────────

export function SchemaForm({ onResult }: FormProps) {
  const [pageUrl, setPageUrl] = useState("https://creativenexus.in/about-us/");
  const [pageTitle, setPageTitle] = useState("About Creative Nexus");
  const [faqs, setFaqs] = useState([
    { question: "", answer: "" },
    { question: "", answer: "" },
    { question: "", answer: "" },
  ]);
  const [cms, setCms] = useState<CmsTarget>("wordpress");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    const valid = faqs.filter((f) => f.question.trim() && f.answer.trim());
    if (valid.length === 0) {
      setError("Add at least one Q + A.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await submit("/xapi/searchlens/fix/schema", {
      page_url: pageUrl,
      page_title: pageTitle,
      faqs: valid,
      cms,
    });
    if ("error" in res) setError(res.error);
    else onResult(res);
    setBusy(false);
  };

  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        void generate();
      }}
    >
      <Field label="Page URL" required>
        <input
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          className={input()}
        />
      </Field>
      <Field label="Page title" required>
        <input
          value={pageTitle}
          onChange={(e) => setPageTitle(e.target.value)}
          className={input()}
        />
      </Field>
      <Field label="FAQs">
        <div className="space-y-2">
          {faqs.map((f, i) => (
            <div key={i} className="space-y-1 p-2 rounded-md border border-divider bg-background/40">
              <input
                value={f.question}
                onChange={(e) =>
                  setFaqs((arr) =>
                    arr.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)),
                  )
                }
                placeholder={`Q${i + 1} — question`}
                className={input()}
              />
              <textarea
                value={f.answer}
                onChange={(e) =>
                  setFaqs((arr) =>
                    arr.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)),
                  )
                }
                placeholder="Answer (2–4 sentences, factual)"
                rows={3}
                className={input("resize-y min-h-[72px]")}
              />
              <button
                type="button"
                onClick={() => setFaqs((arr) => arr.filter((_, j) => j !== i))}
                className="text-[10.5px] text-rose-500 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFaqs((arr) => [...arr, { question: "", answer: "" }])}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline"
          >
            <Plus className="w-3 h-3" strokeWidth={2} />
            Add FAQ
          </button>
        </div>
      </Field>
      <CmsPicker value={cms} onChange={setCms} />
      <Submit busy={busy} error={error} label="Generate FAQ schema" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Answer Block
// ─────────────────────────────────────────────────────────────────────────

export function AnswerBlockForm({ onResult }: FormProps) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("Creative Nexus");
  const [pageUrl, setPageUrl] = useState("https://creativenexus.in/");
  const [facts, setFacts] = useState<string[]>([""]);
  const [tone, setTone] = useState<"neutral" | "expert" | "confident" | "warm">("expert");
  const [target, setTarget] = useState(150);
  const [cms, setCms] = useState<CmsTarget>("wordpress");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!query.trim()) {
      setError("Query required");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await submit("/xapi/searchlens/fix/answer-block", {
      query,
      brand_name: brand,
      page_url: pageUrl,
      facts: facts.map((f) => f.trim()).filter(Boolean),
      tone,
      target_words: target,
      cms,
    });
    if ("error" in res) setError(res.error);
    else onResult(res);
    setBusy(false);
  };

  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        void generate();
      }}
    >
      <Field label="Query users will ask" required>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='e.g. "best AI marketing agency in India"'
          className={input()}
        />
      </Field>
      <Field label="Brand name" required>
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className={input()}
        />
      </Field>
      <Field label="Target page URL" required>
        <input
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          className={input()}
        />
      </Field>

      <Field label="Facts to ground the answer">
        <div className="space-y-1">
          {facts.map((f, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                value={f}
                onChange={(e) =>
                  setFacts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))
                }
                placeholder="One fact per row"
                className={input()}
              />
              <button
                type="button"
                onClick={() => setFacts((arr) => arr.filter((_, j) => j !== i))}
                className="w-7 h-9 inline-flex items-center justify-center text-foreground-tertiary hover:text-rose-500"
                aria-label="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFacts((arr) => [...arr, ""])}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline"
          >
            <Plus className="w-3 h-3" strokeWidth={2} />
            Add fact
          </button>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Tone">
          <select
            value={tone}
            onChange={(e) =>
              setTone(e.target.value as "neutral" | "expert" | "confident" | "warm")
            }
            className={input()}
          >
            <option value="neutral">Neutral</option>
            <option value="expert">Expert</option>
            <option value="confident">Confident</option>
            <option value="warm">Warm</option>
          </select>
        </Field>
        <Field label="Target word count">
          <input
            type="number"
            min={80}
            max={300}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value) || 150)}
            className={input()}
          />
        </Field>
      </div>

      <CmsPicker value={cms} onChange={setCms} />
      <Submit busy={busy} error={error} label="Generate answer block" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Title + Meta rewriter
// ─────────────────────────────────────────────────────────────────────────

export function MetaRewriteForm({ onResult }: FormProps) {
  const [pageUrl, setPageUrl] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentMeta, setCurrentMeta] = useState("");
  const [primary, setPrimary] = useState("");
  const [brand, setBrand] = useState("Creative Nexus");
  const [audience, setAudience] = useState("");
  const [cms, setCms] = useState<CmsTarget>("wordpress");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    const res = await submit("/xapi/searchlens/fix/meta-rewrite", {
      page_url: pageUrl,
      current_title: currentTitle || undefined,
      current_meta: currentMeta || undefined,
      primary_keyword: primary,
      brand_name: brand,
      audience: audience || undefined,
      cms,
    });
    if ("error" in res) setError(res.error);
    else onResult(res);
    setBusy(false);
  };

  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        void generate();
      }}
    >
      <Field label="Page URL" required>
        <input
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          className={input()}
        />
      </Field>
      <Field label="Primary keyword" required>
        <input
          value={primary}
          onChange={(e) => setPrimary(e.target.value)}
          placeholder='e.g. "AI marketing agency"'
          className={input()}
        />
      </Field>
      <Field label="Brand name" required>
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className={input()}
        />
      </Field>
      <Field label="Audience">
        <input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder='e.g. "B2B founders, Series A SaaS"'
          className={input()}
        />
      </Field>
      <Field label="Current title (optional, for context)">
        <input
          value={currentTitle}
          onChange={(e) => setCurrentTitle(e.target.value)}
          className={input()}
        />
      </Field>
      <Field label="Current meta (optional)">
        <textarea
          value={currentMeta}
          onChange={(e) => setCurrentMeta(e.target.value)}
          rows={2}
          className={input("resize-y min-h-[52px]")}
        />
      </Field>

      <CmsPicker value={cms} onChange={setCms} />
      <Submit busy={busy} error={error} label="Generate 3 variants" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-foreground-tertiary mb-1">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function input(extra = ""): string {
  return [
    "w-full h-9 px-2.5 rounded-md border border-input bg-background text-foreground text-[12.5px]",
    "placeholder:text-foreground-tertiary outline-none transition-all",
    "focus:border-accent/40 focus:ring-2 focus:ring-accent/15",
    "disabled:opacity-50 dark:bg-card",
    extra,
  ].join(" ");
}

function CmsPicker({
  value,
  onChange,
}: {
  value: CmsTarget;
  onChange: (v: CmsTarget) => void;
}) {
  return (
    <Field label="Deploy target (for instructions)">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CmsTarget)}
        className={input()}
      >
        {CMS_TARGETS.map((t) => (
          <option key={t} value={t}>
            {CMS_LABEL[t]}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Submit({
  busy,
  error,
  label,
}: {
  busy: boolean;
  error: string | null;
  label: string;
}) {
  return (
    <div className="pt-2 border-t border-divider space-y-1.5">
      {error && (
        <p className="text-[11.5px] text-rose-500" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-md bg-accent text-white text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {busy && <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />}
        {busy ? "Generating…" : label}
      </button>
    </div>
  );
}
