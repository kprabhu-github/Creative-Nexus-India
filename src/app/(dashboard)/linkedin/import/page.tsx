"use client";

// ---------------------------------------------------------------------------
// Prospect Import — compliant alternative to the removed Apify scrapers.
// Accepts CSV text or URL list. Every row is validated against a
// linkedin.com/{in,company} regex server-side before insert.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface ImportResult {
  ok: boolean;
  imported: number;
  duplicates: number;
  rejected: Array<{ row: Record<string, unknown>; reason: string }>;
  total_submitted: number;
}

export default function ImportPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState<string>("");
  const [mode, setMode] = useState<"csv" | "urls">("urls");
  const [csv, setCsv] = useState("");
  const [urlText, setUrlText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/linkedin/campaigns", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data)) {
          setCampaigns(j.data);
          if (j.data.length > 0 && !campaignId) setCampaignId(j.data[0].id);
        }
      })
      .catch(() => {
        /* non-fatal */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setError(null);
    setResult(null);
    if (!campaignId) {
      setError("Pick a campaign first.");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { campaign_id: campaignId };
      if (mode === "csv") {
        if (!csv.trim()) throw new Error("Paste CSV content first.");
        body.csv = csv;
      } else {
        const urls = urlText
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (urls.length === 0) throw new Error("Paste at least one URL.");
        body.urls = urls;
      }

      const res = await fetch("/api/linkedin/prospects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Import Prospects"
        description="Paste a Sales Navigator CSV export or a list of LinkedIn URLs. No scraping — all rows are validated server-side."
      />

      <ComplianceBanner />

      <div className="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Destination campaign
          </label>
          <Select
            value={campaignId}
            onValueChange={(v) => setCampaignId(v ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant={mode === "urls" ? "default" : "outline"}
            onClick={() => setMode("urls")}
            size="sm"
          >
            Paste URLs
          </Button>
          <Button
            variant={mode === "csv" ? "default" : "outline"}
            onClick={() => setMode("csv")}
            size="sm"
          >
            Paste CSV
          </Button>
        </div>

        {mode === "urls" ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              LinkedIn profile URLs (one per line, or comma/semicolon separated)
            </label>
            <Textarea
              rows={10}
              value={urlText}
              onChange={(e) => setUrlText(e.target.value)}
              placeholder={
                "https://www.linkedin.com/in/...\nhttps://www.linkedin.com/in/..."
              }
            />
            <div className="mt-1 text-xs text-slate-500">
              Only linkedin.com/in/ and linkedin.com/company/ URLs are accepted.
              Anything else will be rejected.
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              CSV text — headers can be any of:{" "}
              <code className="rounded bg-slate-100 px-1">name</code>,{" "}
              <code className="rounded bg-slate-100 px-1">first_name</code>,{" "}
              <code className="rounded bg-slate-100 px-1">company</code>,{" "}
              <code className="rounded bg-slate-100 px-1">headline</code>,{" "}
              <code className="rounded bg-slate-100 px-1">profile_url</code>,{" "}
              <code className="rounded bg-slate-100 px-1">email</code>
            </label>
            <Textarea
              rows={12}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={`first_name,last_name,company,headline,profile_url,email\nAnkit,Bhatia,Zomato,VP Marketing,https://www.linkedin.com/in/ankit-bhatia-seed,a.bhatia@zomato.com`}
              className="font-mono text-xs"
            />
            <div className="mt-1 text-xs text-slate-500">
              Sales Navigator exports and LinkedIn &quot;Get a copy of your data&quot; CSVs are both recognized.
            </div>
          </div>
        )}

        {error ? (
          <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-2 rounded-md bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Imported {result.imported}</Badge>
              <Badge variant="secondary">Duplicates {result.duplicates}</Badge>
              <Badge
                variant={
                  result.rejected.length > 0 ? "destructive" : "outline"
                }
              >
                Rejected {result.rejected.length}
              </Badge>
              <span className="text-xs text-slate-500">
                of {result.total_submitted} submitted
              </span>
            </div>
            {result.rejected.length > 0 ? (
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer font-medium">
                  Show rejected rows
                </summary>
                <ul className="mt-1 space-y-0.5">
                  {result.rejected.slice(0, 50).map((r, i) => (
                    <li key={i}>
                      <span className="text-rose-600">{r.reason}</span>{" "}
                      <code className="text-slate-500">
                        {String(
                          (r.row as { profile_url?: string })?.profile_url ??
                            JSON.stringify(r.row),
                        )}
                      </code>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2 pt-1">
          <Button onClick={submit} disabled={submitting || !campaignId}>
            {submitting ? "Importing…" : "Import prospects"}
          </Button>
          <a
            href="/linkedin/inbox"
            className="text-sm text-blue-600 hover:underline"
          >
            → Go to Prospect Inbox
          </a>
        </div>
      </div>
    </div>
  );
}

function ComplianceBanner() {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <div className="font-semibold">Compliance note</div>
      <p className="mt-0.5">
        Prospect lists must come from sources you&apos;re allowed to use:
        Sales Navigator exports, your LinkedIn data export, event/webinar
        attendee lists, CSV from CRM, or manual paste. Scraping linkedin.com
        profile or search pages (directly or via third-party actors) violates
        LinkedIn&apos;s User Agreement §8.2 and will put your account at risk.
      </p>
    </div>
  );
}
