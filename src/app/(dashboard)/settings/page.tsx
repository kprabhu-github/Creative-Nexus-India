"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings2,
  Plug,
  Globe,
  Target,
  Eye,
  Mail,
  Bell,
  Loader2,
  CheckCircle2,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgencyConfig {
  org_id?: string;
  agency_name?: string;
  domain?: string;
  brand_color?: string;
  social_instagram?: string;
  social_twitter?: string;
  social_linkedin?: string;
  social_tiktok?: string;
  social_youtube?: string;
  product_description?: string;
  target_market?: string;
  target_audience?: string;
  ideal_buyer?: string;
  default_competitors?: string[];
  searchlens_brand_name?: string;
  searchlens_prompts?: string[];
  searchlens_competitors?: string[];
  outreach_sender_name?: string;
  outreach_sender_title?: string;
  outreach_company_value?: string;
  outreach_default_tone?: string;
  api_status?: Record<string, boolean>;
  notification_email?: boolean;
  notification_browser?: boolean;
  notification_slack?: boolean;
  notification_frequency?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Section Card
// ---------------------------------------------------------------------------

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-[7px] bg-foreground-tertiary/8 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
        </div>
        <span className="text-[15px] font-semibold text-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save Button with inline status
// ---------------------------------------------------------------------------

function SaveButton({
  saving,
  saved,
  error,
  onClick,
}: {
  saving: boolean;
  saved: boolean;
  error: string | null;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2 mt-3">
      <Button
        className="bg-accent text-white hover:bg-accent/90 border-transparent"
        disabled={saving}
        onClick={onClick}
      >
        {saving ? (
          <>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" strokeWidth={2} />
            Saving...
          </>
        ) : (
          "Save"
        )}
      </Button>
      {saved && (
        <span className="text-[12px] text-success flex items-center gap-1 animate-in fade-in duration-300">
          <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
          Saved
        </span>
      )}
      {error && (
        <span className="text-[12px] text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" strokeWidth={2} />
          {error}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Status Badge Data
// ---------------------------------------------------------------------------

const apiIntegrations = [
  { id: "supabase", name: "Supabase", description: "Database and authentication", envKey: "NEXT_PUBLIC_SUPABASE_URL" },
  { id: "anthropic", name: "Anthropic Claude", description: "AI strategy and content", envKey: "ANTHROPIC_API_KEY" },
  { id: "apify", name: "Apify", description: "Web scraping and automation", envKey: "APIFY_API_TOKEN" },
  { id: "nvidia", name: "NVIDIA NIM", description: "PII scanning and safety", envKey: "NVIDIA_API_KEY" },
  { id: "openai", name: "OpenAI", description: "Embeddings and fallback", envKey: "OPENAI_API_KEY" },
  { id: "semrush", name: "Semrush", description: "SEO and keyword research", envKey: "SEMRUSH_API_KEY" },
  { id: "razorpay", name: "Razorpay", description: "Payment processing", envKey: "RAZORPAY_KEY_ID" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  // ---------------------------------------------------------------------------
  // Global state
  // ---------------------------------------------------------------------------
  const [config, setConfig] = useState<AgencyConfig>({});
  const [pageLoading, setPageLoading] = useState(true);

  // Per-section save state
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load config
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const json = (await res.json()) as { data: AgencyConfig };
          setConfig(json.data ?? {});
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setPageLoading(false);
      }
    }
    void loadConfig();
  }, []);

  // ---------------------------------------------------------------------------
  // Save helpers
  // ---------------------------------------------------------------------------
  const saveSection = useCallback(
    async (sectionName: string, fields: Record<string, unknown>) => {
      setSavingSection(sectionName);
      setSavedSection(null);
      setSectionError(null);

      try {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(errBody?.error ?? "Save failed");
        }

        const json = (await res.json()) as { data: AgencyConfig };
        setConfig(json.data ?? config);
        setSavedSection(sectionName);

        // Clear saved indicator after 3 seconds
        setTimeout(() => setSavedSection(null), 3000);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        setSectionError(message);
      } finally {
        setSavingSection(null);
      }
    },
    [config],
  );

  // ---------------------------------------------------------------------------
  // Field updater
  // ---------------------------------------------------------------------------
  const updateField = useCallback((field: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Settings"
        description="Agency configuration and notification preferences"
      />

      <div className="grid gap-4 max-w-2xl">
        {/* ---------------------------------------------------------------- */}
        {/* Section 1: Agency Identity                                       */}
        {/* ---------------------------------------------------------------- */}
        <SectionCard icon={Settings2} title="Agency Identity">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="agencyName" className="text-[13px] text-foreground-secondary">
                Agency Name
              </Label>
              <Input
                id="agencyName"
                value={(config.agency_name as string) ?? ""}
                onChange={(e) => updateField("agency_name", e.target.value)}
                placeholder="Creative Nexus Global"
                className="bg-background dark:bg-background/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="domain" className="text-[13px] text-foreground-secondary">
                Domain
              </Label>
              <Input
                id="domain"
                value={(config.domain as string) ?? ""}
                onChange={(e) => updateField("domain", e.target.value)}
                placeholder="creativenexusglobal.com"
                className="bg-background dark:bg-background/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brandColor" className="text-[13px] text-foreground-secondary">
                Brand Color
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="brandColor"
                  value={(config.brand_color as string) ?? "#FF6B5A"}
                  onChange={(e) => updateField("brand_color", e.target.value)}
                  placeholder="#FF6B5A"
                  className="bg-background dark:bg-background/40 flex-1"
                />
                <div
                  className="w-8 h-8 rounded-lg border border-border shrink-0"
                  style={{ backgroundColor: (config.brand_color as string) ?? "#FF6B5A" }}
                />
              </div>
            </div>
            <SaveButton
              saving={savingSection === "identity"}
              saved={savedSection === "identity"}
              error={savingSection === "identity" ? sectionError : null}
              onClick={() =>
                void saveSection("identity", {
                  agency_name: config.agency_name,
                  domain: config.domain,
                  brand_color: config.brand_color,
                })
              }
            />
          </div>
        </SectionCard>

        {/* ---------------------------------------------------------------- */}
        {/* Section 2: Social Accounts                                       */}
        {/* ---------------------------------------------------------------- */}
        <SectionCard icon={Globe} title="Social Accounts">
          <div className="space-y-3">
            {[
              { id: "social_instagram", label: "Instagram", placeholder: "@creativenexusglobal" },
              { id: "social_twitter", label: "Twitter / X", placeholder: "@creativenexus" },
              { id: "social_linkedin", label: "LinkedIn", placeholder: "creativenexusglobal" },
              { id: "social_tiktok", label: "TikTok", placeholder: "@creativenexus" },
              { id: "social_youtube", label: "YouTube", placeholder: "@CreativeNexusGlobal" },
            ].map(({ id, label, placeholder }) => (
              <div key={id} className="space-y-1.5">
                <Label htmlFor={id} className="text-[13px] text-foreground-secondary">
                  {label}
                </Label>
                <Input
                  id={id}
                  value={(config[id] as string) ?? ""}
                  onChange={(e) => updateField(id, e.target.value)}
                  placeholder={placeholder}
                  className="bg-background dark:bg-background/40"
                />
              </div>
            ))}
            <SaveButton
              saving={savingSection === "social"}
              saved={savedSection === "social"}
              error={savingSection === "social" ? sectionError : null}
              onClick={() =>
                void saveSection("social", {
                  social_instagram: config.social_instagram,
                  social_twitter: config.social_twitter,
                  social_linkedin: config.social_linkedin,
                  social_tiktok: config.social_tiktok,
                  social_youtube: config.social_youtube,
                })
              }
            />
          </div>
        </SectionCard>

        {/* ---------------------------------------------------------------- */}
        {/* Section 3: Target Defaults                                       */}
        {/* ---------------------------------------------------------------- */}
        <SectionCard icon={Target} title="Target Defaults">
          <p className="text-[12px] text-foreground-tertiary mb-3">
            These defaults are used by all AI modules. No more pop-up prompts.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="productDescription" className="text-[13px] text-foreground-secondary">
                Product Description
              </Label>
              <Textarea
                id="productDescription"
                value={(config.product_description as string) ?? ""}
                onChange={(e) => updateField("product_description", e.target.value)}
                placeholder="Describe your product or service..."
                className="bg-background dark:bg-background/40"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targetMarket" className="text-[13px] text-foreground-secondary">
                Target Market
              </Label>
              <Textarea
                id="targetMarket"
                value={(config.target_market as string) ?? ""}
                onChange={(e) => updateField("target_market", e.target.value)}
                placeholder="e.g. B2B SaaS companies in India, Series A-C funded..."
                className="bg-background dark:bg-background/40"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targetAudience" className="text-[13px] text-foreground-secondary">
                Target Audience
              </Label>
              <Textarea
                id="targetAudience"
                value={(config.target_audience as string) ?? ""}
                onChange={(e) => updateField("target_audience", e.target.value)}
                placeholder="e.g. Marketing leaders at mid-market B2B companies..."
                className="bg-background dark:bg-background/40"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="idealBuyer" className="text-[13px] text-foreground-secondary">
                Ideal Buyer
              </Label>
              <Input
                id="idealBuyer"
                value={(config.ideal_buyer as string) ?? ""}
                onChange={(e) => updateField("ideal_buyer", e.target.value)}
                placeholder="VP Marketing, Head of Growth, CMO"
                className="bg-background dark:bg-background/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultCompetitors" className="text-[13px] text-foreground-secondary">
                Default Competitors
              </Label>
              <Input
                id="defaultCompetitors"
                value={(config.default_competitors ?? []).join(", ")}
                onChange={(e) =>
                  updateField(
                    "default_competitors",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="WebFX, Siege Media, Single Grain"
                className="bg-background dark:bg-background/40"
              />
              <p className="text-[11px] text-foreground-tertiary">Comma-separated list</p>
            </div>
            <SaveButton
              saving={savingSection === "targets"}
              saved={savedSection === "targets"}
              error={savingSection === "targets" ? sectionError : null}
              onClick={() =>
                void saveSection("targets", {
                  product_description: config.product_description,
                  target_market: config.target_market,
                  target_audience: config.target_audience,
                  ideal_buyer: config.ideal_buyer,
                  default_competitors: config.default_competitors,
                })
              }
            />
          </div>
        </SectionCard>

        {/* ---------------------------------------------------------------- */}
        {/* Section 4: SearchLens Config                                     */}
        {/* ---------------------------------------------------------------- */}
        <SectionCard icon={Eye} title="SearchLens Config">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="searchlensBrand" className="text-[13px] text-foreground-secondary">
                Brand Name for Scanning
              </Label>
              <Input
                id="searchlensBrand"
                value={(config.searchlens_brand_name as string) ?? ""}
                onChange={(e) => updateField("searchlens_brand_name", e.target.value)}
                placeholder="Creative Nexus"
                className="bg-background dark:bg-background/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="searchlensPrompts" className="text-[13px] text-foreground-secondary">
                Default Prompts to Monitor
              </Label>
              <Textarea
                id="searchlensPrompts"
                value={(config.searchlens_prompts ?? []).join("\n")}
                onChange={(e) =>
                  updateField(
                    "searchlens_prompts",
                    e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                placeholder={"best digital marketing agency in India\nAI-powered marketing agency\ntop content marketing firms"}
                className="bg-background dark:bg-background/40"
                rows={4}
              />
              <p className="text-[11px] text-foreground-tertiary">One prompt per line</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="searchlensCompetitors" className="text-[13px] text-foreground-secondary">
                Competitors to Track
              </Label>
              <Input
                id="searchlensCompetitors"
                value={(config.searchlens_competitors ?? []).join(", ")}
                onChange={(e) =>
                  updateField(
                    "searchlens_competitors",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="WebFX, Siege Media, Jasper Agency"
                className="bg-background dark:bg-background/40"
              />
              <p className="text-[11px] text-foreground-tertiary">Comma-separated list</p>
            </div>
            <SaveButton
              saving={savingSection === "searchlens"}
              saved={savedSection === "searchlens"}
              error={savingSection === "searchlens" ? sectionError : null}
              onClick={() =>
                void saveSection("searchlens", {
                  searchlens_brand_name: config.searchlens_brand_name,
                  searchlens_prompts: config.searchlens_prompts,
                  searchlens_competitors: config.searchlens_competitors,
                })
              }
            />
          </div>
        </SectionCard>

        {/* ---------------------------------------------------------------- */}
        {/* Section 5: Outreach Defaults                                     */}
        {/* ---------------------------------------------------------------- */}
        <SectionCard icon={Mail} title="Outreach Defaults">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="outreachSender" className="text-[13px] text-foreground-secondary">
                Sender Name
              </Label>
              <Input
                id="outreachSender"
                value={(config.outreach_sender_name as string) ?? ""}
                onChange={(e) => updateField("outreach_sender_name", e.target.value)}
                placeholder="Prabhu"
                className="bg-background dark:bg-background/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outreachTitle" className="text-[13px] text-foreground-secondary">
                Sender Title
              </Label>
              <Input
                id="outreachTitle"
                value={(config.outreach_sender_title as string) ?? ""}
                onChange={(e) => updateField("outreach_sender_title", e.target.value)}
                placeholder="Founder, Creative Nexus Global"
                className="bg-background dark:bg-background/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outreachValue" className="text-[13px] text-foreground-secondary">
                Company Value Proposition
              </Label>
              <Textarea
                id="outreachValue"
                value={(config.outreach_company_value as string) ?? ""}
                onChange={(e) => updateField("outreach_company_value", e.target.value)}
                placeholder="AI-driven content operations platform that cuts production time by 60%..."
                className="bg-background dark:bg-background/40"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-foreground-secondary">Default Tone</Label>
              <SegmentedControl
                options={["Professional", "Casual", "Direct"]}
                value={
                  (config.outreach_default_tone as string)
                    ? (config.outreach_default_tone as string).charAt(0).toUpperCase() +
                      (config.outreach_default_tone as string).slice(1)
                    : "Professional"
                }
                onChange={(v) => updateField("outreach_default_tone", v.toLowerCase())}
              />
            </div>
            <SaveButton
              saving={savingSection === "outreach"}
              saved={savedSection === "outreach"}
              error={savingSection === "outreach" ? sectionError : null}
              onClick={() =>
                void saveSection("outreach", {
                  outreach_sender_name: config.outreach_sender_name,
                  outreach_sender_title: config.outreach_sender_title,
                  outreach_company_value: config.outreach_company_value,
                  outreach_default_tone: config.outreach_default_tone,
                })
              }
            />
          </div>
        </SectionCard>

        {/* ---------------------------------------------------------------- */}
        {/* Section 6: API Status (read-only)                                */}
        {/* ---------------------------------------------------------------- */}
        <SectionCard icon={Plug} title="API Status">
          <div className="rounded-lg overflow-hidden bg-background dark:bg-background/40">
            {apiIntegrations.map((integration, i) => {
              const isConnected =
                config.api_status?.[integration.id] ??
                ["supabase", "anthropic", "apify", "nvidia", "openai"].includes(
                  integration.id,
                );

              return (
                <div key={integration.id}>
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-foreground">
                        {integration.name}
                      </div>
                      <div className="text-[12px] text-foreground-tertiary">
                        {integration.description}
                      </div>
                    </div>
                    <StatusBadge type={isConnected ? "success" : "neutral"}>
                      {isConnected ? "Connected" : "Not Connected"}
                    </StatusBadge>
                  </div>
                  {i < apiIntegrations.length - 1 && (
                    <div className="h-px bg-divider mx-3" />
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ---------------------------------------------------------------- */}
        {/* Section 7: Notification Preferences                              */}
        {/* ---------------------------------------------------------------- */}
        <SectionCard icon={Bell} title="Notification Preferences">
          <div className="space-y-3">
            {/* Toggle rows */}
            {[
              { id: "notification_email", label: "Email Notifications", description: "Receive notifications via email" },
              { id: "notification_browser", label: "Browser Notifications", description: "Push notifications in the browser" },
              { id: "notification_slack", label: "Slack Notifications", description: "Send alerts to your Slack channel" },
            ].map(({ id, label, description }) => (
              <div key={id} className="flex items-center justify-between rounded-lg bg-background dark:bg-background/40 px-3 py-2.5">
                <div>
                  <p className="text-[13px] font-medium text-foreground">{label}</p>
                  <p className="text-[12px] text-foreground-tertiary">{description}</p>
                </div>
                <button
                  onClick={() => updateField(id, !config[id])}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    config[id]
                      ? "bg-accent"
                      : "bg-foreground-tertiary/20"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                      config[id] ? "left-5" : "left-1"
                    }`}
                  />
                </button>
              </div>
            ))}

            {/* Frequency */}
            <div className="space-y-1.5">
              <Label className="text-[13px] text-foreground-secondary">Frequency</Label>
              <SegmentedControl
                options={["Real-time", "Hourly", "Daily"]}
                value={(config.notification_frequency as string) ?? "Real-time"}
                onChange={(v) => updateField("notification_frequency", v)}
              />
            </div>

            <SaveButton
              saving={savingSection === "notifications"}
              saved={savedSection === "notifications"}
              error={savingSection === "notifications" ? sectionError : null}
              onClick={() =>
                void saveSection("notifications", {
                  notification_email: config.notification_email,
                  notification_browser: config.notification_browser,
                  notification_slack: config.notification_slack,
                  notification_frequency: config.notification_frequency,
                })
              }
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
