"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plug,
  Globe,
  Target,
  Eye,
  Mail,
  Bell,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Search,
  Code,
  Megaphone,
  MapPin,
  Building2,
  Shield,
  Landmark,
  Phone,
  User,
  ExternalLink,
  Copy,
  Check,
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
  google_integrations?: Record<string, string>;
  notification_email?: boolean;
  notification_browser?: boolean;
  notification_slack?: boolean;
  notification_whatsapp?: boolean;
  notification_frequency?: string;
  lead_auto_send_threshold?: number;
  lead_review_threshold?: number;
  lead_followup_intervals?: string;
  lead_max_followups?: number;
  [key: string]: unknown;
}

interface OfficeLocation {
  label: string;
  city: string;
  state: string;
  address: string;
}

interface SocialAccount {
  handle: string;
  url: string;
}

interface FounderProfile {
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
}

interface CompanyData {
  org_id?: string;
  name?: string;
  legal_name?: string;
  website?: string;
  brand_color?: string;
  about?: string;
  gstin?: string;
  pan?: string;
  lut_no?: string;
  bank_account_name?: string;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  bank_swift?: string;
  bank_micr?: string;
  bank_branch?: string;
  bank_branch_address?: string;
  offices?: OfficeLocation[];
  phones?: string[];
  emails?: string[];
  social?: Record<string, SocialAccount>;
  founder?: FounderProfile;
}

// ---------------------------------------------------------------------------
// Section Card
// ---------------------------------------------------------------------------

function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border ${className ?? ""}`}
    >
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
// Read-Only Display Row
// ---------------------------------------------------------------------------

function DisplayRow({
  label,
  value,
  mono,
  copiable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copiable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background dark:bg-background/40">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-foreground-tertiary">{label}</p>
        <p
          className={`text-[13px] text-foreground ${mono ? "font-mono tracking-wide" : ""}`}
        >
          {value}
        </p>
      </div>
      {copiable && (
        <button
          onClick={() => void handleCopy()}
          className="ml-2 p-1.5 rounded-md text-foreground-tertiary hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-success" strokeWidth={2} />
          ) : (
            <Copy className="w-3.5 h-3.5" strokeWidth={2} />
          )}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy All Button
// ---------------------------------------------------------------------------

function CopyAllButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <button
      onClick={() => void handleCopy()}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-foreground-tertiary hover:text-foreground hover:bg-surface-hover transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-success" strokeWidth={2} />
          <span className="text-success">Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" strokeWidth={2} />
          <span>{label}</span>
        </>
      )}
    </button>
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
// Social Icon Component (using Lucide fallbacks with proper labels)
// ---------------------------------------------------------------------------

function SocialIcon({ platform }: { platform: string }) {
  const iconMap: Record<string, string> = {
    instagram: "IG",
    facebook: "FB",
    twitter: "X",
    linkedin_company: "in",
    linkedin_personal: "in",
    youtube: "YT",
    pinterest: "Pi",
  };
  return (
    <div className="w-6 h-6 rounded-md bg-foreground-tertiary/8 flex items-center justify-center shrink-0">
      <span className="text-[10px] font-bold text-foreground-tertiary">
        {iconMap[platform] ?? "?"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Status Badge Data
// ---------------------------------------------------------------------------

const apiIntegrations = [
  { id: "supabase", name: "Supabase", description: "Database and authentication" },
  { id: "anthropic", name: "Anthropic Claude", description: "AI strategy and content" },
  { id: "apify", name: "Apify", description: "Web scraping and automation" },
  { id: "nvidia", name: "NVIDIA NIM", description: "PII scanning and safety" },
  { id: "openai", name: "OpenAI", description: "Embeddings and fallback" },
  { id: "semrush", name: "Semrush", description: "SEO and keyword research" },
  { id: "razorpay", name: "Razorpay", description: "Payment processing" },
  { id: "google_analytics", name: "Google Analytics 4", description: "Website analytics" },
  { id: "google_search_console", name: "Google Search Console", description: "Search performance" },
  { id: "google_tag_manager", name: "Google Tag Manager", description: "Tag management" },
  { id: "google_ads", name: "Google Ads", description: "Paid search advertising" },
  { id: "whatsapp", name: "WhatsApp Business", description: "Client messaging" },
];

// ---------------------------------------------------------------------------
// Google Integrations Config
// ---------------------------------------------------------------------------

const googleIntegrations = [
  {
    id: "google_analytics",
    name: "Google Analytics 4",
    icon: BarChart3,
    field: "ga4_property_id",
    placeholder: "364261665",
    label: "Property ID",
    defaultValue: "364261665",
  },
  {
    id: "google_search_console",
    name: "Google Search Console",
    icon: Search,
    field: "gsc_site_url",
    placeholder: "creativenexus.in",
    label: "Site URL",
    defaultValue: "creativenexus.in",
  },
  {
    id: "google_tag_manager",
    name: "Google Tag Manager",
    icon: Code,
    field: "gtm_container_id",
    placeholder: "GTM-MGZXH6W",
    label: "Container ID",
    defaultValue: "GTM-MGZXH6W",
  },
  {
    id: "google_workspace",
    name: "Google Workspace (GSuite)",
    icon: Mail,
    field: "gsuite_domain",
    placeholder: "creativenexus.in",
    label: "Domain",
    defaultValue: "creativenexus.in",
  },
  {
    id: "google_ads",
    name: "Google Ads",
    icon: Megaphone,
    field: "google_ads_customer_id",
    placeholder: "123-456-7890",
    label: "Customer ID",
  },
  {
    id: "google_business",
    name: "Google Business Profile",
    icon: MapPin,
    field: "gbp_location_id",
    placeholder: "Location ID",
    label: "Location ID",
  },
] as const;

// ---------------------------------------------------------------------------
// Social platform display names
// ---------------------------------------------------------------------------

const socialPlatformNames: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter / X",
  linkedin_company: "LinkedIn (Company)",
  linkedin_personal: "LinkedIn (K. Prabhu)",
  youtube: "YouTube",
  pinterest: "Pinterest",
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState("Company");
  const [company, setCompany] = useState<CompanyData>({});
  const [config, setConfig] = useState<AgencyConfig>({});
  const [pageLoading, setPageLoading] = useState(true);

  // Per-section save state
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function loadData() {
      try {
        const [companyRes, settingsRes] = await Promise.all([
          fetch("/api/company"),
          fetch("/api/settings"),
        ]);

        if (companyRes.ok) {
          const json = (await companyRes.json()) as { data: CompanyData };
          setCompany(json.data ?? {});
        }

        if (settingsRes.ok) {
          const json = (await settingsRes.json()) as { data: AgencyConfig };
          setConfig(json.data ?? {});
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setPageLoading(false);
      }
    }
    void loadData();
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
  // Loading state
  // ---------------------------------------------------------------------------
  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Build banking details string for copy-all
  // ---------------------------------------------------------------------------
  const bankingCopyText = [
    `Account Name: ${company.bank_account_name ?? ""}`,
    `Bank: ${company.bank_name ?? ""}`,
    `Account No: ${company.bank_account_no ?? ""}`,
    `IFSC: ${company.bank_ifsc ?? ""}`,
    `SWIFT: ${company.bank_swift ?? ""}`,
    `MICR: ${company.bank_micr ?? ""}`,
    `Branch: ${company.bank_branch ?? ""}`,
    `Branch Address: ${company.bank_branch_address ?? ""}`,
  ].join("\n");

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Settings"
        description="Company profile, platform configuration, and integrations"
      />

      {/* Tab Switcher — horizontal tabs across 5 areas */}
      <div className="mb-5 overflow-x-auto">
        <SegmentedControl
          options={["Company", "Brand", "Marketing", "Integrations", "Notifications"]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* ================================================================== */}
      {/* TAB 1: Company — Identity, Legal, Banking, Addresses, Contact      */}
      {/* ================================================================== */}
      {activeTab === "Company" && (
        <div className="grid gap-4 max-w-2xl">
          {/* -------------------------------------------------------------- */}
          {/* Section 1: Company Identity                                     */}
          {/* -------------------------------------------------------------- */}
          <SectionCard icon={Building2} title="Company Identity">
            <div className="space-y-1.5">
              <DisplayRow
                label="Company Name"
                value={company.name ?? "Creative Nexus India"}
              />
              <DisplayRow
                label="Legal Name"
                value={company.legal_name ?? "M/s. Creative Nexus India"}
              />
              <DisplayRow
                label="Website"
                value={company.website ?? "creativenexus.in"}
              />
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background dark:bg-background/40">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-foreground-tertiary">Brand Color</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div
                      className="w-5 h-5 rounded-md border border-border shrink-0"
                      style={{
                        backgroundColor: company.brand_color ?? "#D90A2C",
                      }}
                    />
                    <span className="text-[13px] font-mono text-foreground">
                      {company.brand_color ?? "#D90A2C"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="py-2 px-3 rounded-lg bg-background dark:bg-background/40">
                <p className="text-[12px] text-foreground-tertiary mb-1">About</p>
                <p className="text-[13px] text-foreground leading-relaxed">
                  {company.about ??
                    "Creative Nexus India is an AI-native digital marketing and creative agency that combines cutting-edge artificial intelligence with bold creative strategy. We help brands across India and globally build powerful digital presence through data-driven SEO, AI-powered content, performance marketing, and immersive design experiences. Founded with a mission to redefine how agencies operate, we leverage 36 AI agents and 13 automated workflows to deliver results that traditional agencies simply cannot match."}
                </p>
              </div>
            </div>
          </SectionCard>

          {/* -------------------------------------------------------------- */}
          {/* Section 2: Legal & Tax                                          */}
          {/* -------------------------------------------------------------- */}
          <SectionCard icon={Shield} title="Legal & Tax">
            <p className="text-[12px] text-foreground-tertiary mb-2">
              Official registration details for invoicing and compliance
            </p>
            <div className="space-y-1.5">
              <DisplayRow
                label="GSTIN"
                value={company.gstin ?? "07AANFC9845Q1ZF"}
                mono
                copiable
              />
              <DisplayRow
                label="PAN"
                value={company.pan ?? "AANFC9845Q"}
                mono
                copiable
              />
              <DisplayRow
                label="LUT No."
                value={company.lut_no ?? "AD070719000441B"}
                mono
                copiable
              />
            </div>
          </SectionCard>

          {/* -------------------------------------------------------------- */}
          {/* Section 3: Banking Details                                      */}
          {/* -------------------------------------------------------------- */}
          <SectionCard icon={Landmark} title="Banking Details">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] text-foreground-tertiary">
                Bank transfer details for invoice payments
              </p>
              <CopyAllButton text={bankingCopyText} label="Copy all" />
            </div>
            <div className="space-y-1.5">
              <DisplayRow
                label="Account Name"
                value={company.bank_account_name ?? "M/s. Creative Nexus India"}
                copiable
              />
              <DisplayRow
                label="Bank"
                value={company.bank_name ?? "ICICI Bank Ltd."}
              />
              <DisplayRow
                label="Account Number"
                value={company.bank_account_no ?? "033105005146"}
                mono
                copiable
              />
              <DisplayRow
                label="IFSC Code"
                value={company.bank_ifsc ?? "ICIC0000331"}
                mono
                copiable
              />
              <DisplayRow
                label="SWIFT Code"
                value={company.bank_swift ?? "ICICINBBNRI"}
                mono
                copiable
              />
              <DisplayRow
                label="MICR Code"
                value={company.bank_micr ?? "110229046"}
                mono
                copiable
              />
              <DisplayRow
                label="Branch"
                value={company.bank_branch ?? "Ashok Vihar Branch"}
              />
              <DisplayRow
                label="Branch Address"
                value={
                  company.bank_branch_address ??
                  "B-2/16, Kheman House, Ashok Vihar-II, New Delhi - 110052"
                }
              />
            </div>
          </SectionCard>

          {/* -------------------------------------------------------------- */}
          {/* Section 4: Office Addresses                                     */}
          {/* -------------------------------------------------------------- */}
          <SectionCard icon={MapPin} title="Office Addresses">
            <div className="space-y-2">
              {(
                company.offices ?? [
                  {
                    label: "Head Office",
                    city: "Gurugram",
                    state: "Haryana",
                    address:
                      "Tower B, Sohna Road, Sector 49, Gurugram, Haryana 122018",
                  },
                  {
                    label: "Design Studio",
                    city: "Bengaluru",
                    state: "Karnataka",
                    address: "HSR Layout, Sector 2, Bengaluru, Karnataka 560102",
                  },
                  {
                    label: "Registered Office",
                    city: "Delhi",
                    state: "Delhi",
                    address:
                      "B-2/16, Ashok Vihar Phase-II, New Delhi 110052",
                  },
                ]
              ).map((office) => (
                <div
                  key={office.label}
                  className="flex items-start gap-2.5 py-2.5 px-3 rounded-lg bg-background dark:bg-background/40"
                >
                  <div className="w-6 h-6 rounded-md bg-foreground-tertiary/8 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin
                      className="w-3 h-3 text-foreground-tertiary"
                      strokeWidth={2}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-foreground">
                        {office.label}
                      </p>
                      <span className="text-[11px] text-foreground-tertiary">
                        {office.city}, {office.state}
                      </span>
                    </div>
                    <p className="text-[12px] text-foreground-secondary mt-0.5">
                      {office.address}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* -------------------------------------------------------------- */}
          {/* Section 5: Contact Information                                  */}
          {/* -------------------------------------------------------------- */}
          <SectionCard icon={Phone} title="Contact Information">
            <div className="space-y-1.5">
              <div className="py-2 px-3 rounded-lg bg-background dark:bg-background/40">
                <p className="text-[12px] text-foreground-tertiary mb-1.5">
                  Phone Numbers
                </p>
                <div className="space-y-1">
                  {(company.phones ?? ["+91 9999212010", "+91 9019321894"]).map(
                    (phone) => (
                      <a
                        key={phone}
                        href={`tel:${phone.replace(/\s/g, "")}`}
                        className="flex items-center gap-2 text-[13px] text-accent hover:underline"
                      >
                        <Phone className="w-3 h-3" strokeWidth={2} />
                        {phone}
                      </a>
                    ),
                  )}
                </div>
              </div>
              <div className="py-2 px-3 rounded-lg bg-background dark:bg-background/40">
                <p className="text-[12px] text-foreground-tertiary mb-1.5">
                  Email Addresses
                </p>
                <div className="space-y-1">
                  {(
                    company.emails ?? [
                      "info@creativenexus.in",
                      "prabhu@creativenexus.in",
                      "rishabh@creativenexus.in",
                    ]
                  ).map((email) => (
                    <a
                      key={email}
                      href={`mailto:${email}`}
                      className="flex items-center gap-2 text-[13px] text-accent hover:underline"
                    >
                      <Mail className="w-3 h-3" strokeWidth={2} />
                      {email}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 2: Brand — Social media + Founder profile                       */}
      {/* ================================================================== */}
      {activeTab === "Brand" && (
        <div className="grid gap-4 max-w-2xl">
          <SectionCard icon={Globe} title="Social Media Accounts">
            <div className="space-y-1.5">
              {Object.entries(
                company.social ?? {
                  instagram: {
                    handle: "@creativenexusindia",
                    url: "https://instagram.com/creativenexusindia",
                  },
                  facebook: {
                    handle: "@creativenexusinc",
                    url: "https://facebook.com/creativenexusinc",
                  },
                  twitter: {
                    handle: "@creativenexusin",
                    url: "https://x.com/creativenexusin",
                  },
                  linkedin_company: {
                    handle: "Creative Nexus India",
                    url: "https://linkedin.com/company/13328448",
                  },
                  linkedin_personal: {
                    handle: "K. Prabhu",
                    url: "https://linkedin.com/in/k-prabhu-2062ba14",
                  },
                  youtube: {
                    handle: "Creative Nexus",
                    url: "https://youtube.com/@creativenexusindia",
                  },
                  pinterest: {
                    handle: "@CreativeNexusindia",
                    url: "https://pinterest.com/CreativeNexusindia",
                  },
                },
              ).map(([platform, account]) => (
                <a
                  key={platform}
                  href={account.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-background dark:bg-background/40 hover:bg-surface-hover transition-colors group"
                >
                  <SocialIcon platform={platform} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground">
                      {socialPlatformNames[platform] ?? platform}
                    </p>
                    <p className="text-[12px] text-foreground-tertiary">
                      {account.handle}
                    </p>
                  </div>
                  <ExternalLink
                    className="w-3.5 h-3.5 text-foreground-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
                    strokeWidth={2}
                  />
                </a>
              ))}
            </div>
          </SectionCard>

          {/* -------------------------------------------------------------- */}
          {/* Section 7: Founder Profile                                      */}
          {/* -------------------------------------------------------------- */}
          <SectionCard icon={User} title="Founder Profile">
            {(() => {
              const founder = company.founder ?? {
                name: "K. Prabhu",
                title: "Founder & CEO",
                email: "prabhu@creativenexus.in",
                phone: "+91 9999212010",
                linkedin: "https://linkedin.com/in/k-prabhu-2062ba14",
              };
              return (
                <div className="space-y-1.5">
                  <DisplayRow label="Name" value={founder.name} />
                  <DisplayRow label="Title" value={founder.title} />
                  <div className="py-2 px-3 rounded-lg bg-background dark:bg-background/40">
                    <p className="text-[12px] text-foreground-tertiary">Email</p>
                    <a
                      href={`mailto:${founder.email}`}
                      className="text-[13px] text-accent hover:underline"
                    >
                      {founder.email}
                    </a>
                  </div>
                  <div className="py-2 px-3 rounded-lg bg-background dark:bg-background/40">
                    <p className="text-[12px] text-foreground-tertiary">Phone</p>
                    <a
                      href={`tel:${founder.phone.replace(/\s/g, "")}`}
                      className="text-[13px] text-accent hover:underline"
                    >
                      {founder.phone}
                    </a>
                  </div>
                  <a
                    href={founder.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 py-2 px-3 rounded-lg bg-background dark:bg-background/40 hover:bg-surface-hover transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-foreground-tertiary">
                        LinkedIn
                      </p>
                      <p className="text-[13px] text-accent group-hover:underline">
                        {founder.linkedin}
                      </p>
                    </div>
                    <ExternalLink
                      className="w-3.5 h-3.5 text-foreground-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
                      strokeWidth={2}
                    />
                  </a>
                </div>
              );
            })()}
          </SectionCard>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 3: Marketing — ICP, SearchLens, Outreach defaults              */}
      {/* ================================================================== */}
      {activeTab === "Marketing" && (
        <div className="grid gap-4 max-w-2xl">
          <SectionCard icon={Target} title="Target Defaults (ICP)">
            <p className="text-[12px] text-foreground-tertiary mb-3">
              These defaults are used by all AI modules. No more pop-up prompts.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="productDescription"
                  className="text-[13px] text-foreground-secondary"
                >
                  Product Description
                </Label>
                <Textarea
                  id="productDescription"
                  value={(config.product_description as string) ?? ""}
                  onChange={(e) =>
                    updateField("product_description", e.target.value)
                  }
                  placeholder="Describe your product or service..."
                  className="bg-background dark:bg-background/40"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="targetMarket"
                  className="text-[13px] text-foreground-secondary"
                >
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
                <Label
                  htmlFor="targetAudience"
                  className="text-[13px] text-foreground-secondary"
                >
                  Target Audience
                </Label>
                <Textarea
                  id="targetAudience"
                  value={(config.target_audience as string) ?? ""}
                  onChange={(e) =>
                    updateField("target_audience", e.target.value)
                  }
                  placeholder="e.g. Marketing leaders at mid-market B2B companies..."
                  className="bg-background dark:bg-background/40"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="idealBuyer"
                  className="text-[13px] text-foreground-secondary"
                >
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
                <Label
                  htmlFor="defaultCompetitors"
                  className="text-[13px] text-foreground-secondary"
                >
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
                {(config.default_competitors ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(config.default_competitors ?? []).map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-foreground-tertiary">
                  Comma-separated list
                </p>
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

          {/* -------------------------------------------------------------- */}
          {/* Section 2: AI SearchLens Config                                 */}
          {/* -------------------------------------------------------------- */}
          <SectionCard icon={Eye} title="AI SearchLens Config">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="searchlensBrand"
                  className="text-[13px] text-foreground-secondary"
                >
                  Brand Name for Scanning
                </Label>
                <Input
                  id="searchlensBrand"
                  value={(config.searchlens_brand_name as string) ?? ""}
                  onChange={(e) =>
                    updateField("searchlens_brand_name", e.target.value)
                  }
                  placeholder="Creative Nexus"
                  className="bg-background dark:bg-background/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="searchlensPrompts"
                  className="text-[13px] text-foreground-secondary"
                >
                  Monitoring Prompts
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
                  placeholder={
                    "best digital marketing agency in India\nAI-powered marketing agency\ntop content marketing firms"
                  }
                  className="bg-background dark:bg-background/40"
                  rows={4}
                />
                <p className="text-[11px] text-foreground-tertiary">
                  One prompt per line
                </p>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="searchlensCompetitors"
                  className="text-[13px] text-foreground-secondary"
                >
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
                {(config.searchlens_competitors ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(config.searchlens_competitors ?? []).map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-foreground-tertiary">
                  Comma-separated list
                </p>
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

          {/* -------------------------------------------------------------- */}
          {/* Section 3: Outreach Defaults                                    */}
          {/* -------------------------------------------------------------- */}
          <SectionCard icon={Mail} title="Outreach Defaults">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="outreachSender"
                  className="text-[13px] text-foreground-secondary"
                >
                  Sender Name
                </Label>
                <Input
                  id="outreachSender"
                  value={(config.outreach_sender_name as string) ?? ""}
                  onChange={(e) =>
                    updateField("outreach_sender_name", e.target.value)
                  }
                  placeholder="Prabhu"
                  className="bg-background dark:bg-background/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="outreachTitle"
                  className="text-[13px] text-foreground-secondary"
                >
                  Sender Title
                </Label>
                <Input
                  id="outreachTitle"
                  value={(config.outreach_sender_title as string) ?? ""}
                  onChange={(e) =>
                    updateField("outreach_sender_title", e.target.value)
                  }
                  placeholder="Founder, Creative Nexus Global"
                  className="bg-background dark:bg-background/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="outreachValue"
                  className="text-[13px] text-foreground-secondary"
                >
                  Company Value Proposition
                </Label>
                <Textarea
                  id="outreachValue"
                  value={(config.outreach_company_value as string) ?? ""}
                  onChange={(e) =>
                    updateField("outreach_company_value", e.target.value)
                  }
                  placeholder="AI-driven content operations platform that cuts production time by 60%..."
                  className="bg-background dark:bg-background/40"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] text-foreground-secondary">
                  Default Tone
                </Label>
                <SegmentedControl
                  options={["Professional", "Casual", "Direct"]}
                  value={
                    config.outreach_default_tone
                      ? (config.outreach_default_tone as string)
                          .charAt(0)
                          .toUpperCase() +
                        (config.outreach_default_tone as string).slice(1)
                      : "Professional"
                  }
                  onChange={(v) =>
                    updateField("outreach_default_tone", v.toLowerCase())
                  }
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

        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 4: Integrations — Google + Email + API status                   */}
      {/* ================================================================== */}
      {activeTab === "Integrations" && (
        <div className="grid gap-4 max-w-2xl">
          <SectionCard icon={Mail} title="Email Mailboxes (SMTP + IMAP)">
            <p className="text-[12px] text-foreground-tertiary mb-3">
              Connect your @creativenexus.in mailboxes for sending and receiving via SMTP+IMAP.
            </p>
            <a href="/settings/integrations" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent/90">
              Open Email Integrations →
            </a>
          </SectionCard>
          <SectionCard icon={Globe} title="Google Integrations">
            <p className="text-[12px] text-foreground-tertiary mb-3">
              Connect your Google services. OAuth will be enabled in a future
              update — for now, entering an ID marks the service as connected.
            </p>
            <div className="space-y-2.5">
              {googleIntegrations.map((integration) => {
                const googleConfig = config.google_integrations ?? {};
                const currentValue =
                  googleConfig[integration.field] ??
                  ("defaultValue" in integration
                    ? (integration.defaultValue ?? "")
                    : "");
                const isConnected = Boolean(currentValue);

                return (
                  <div
                    key={integration.id}
                    className="rounded-lg bg-background dark:bg-background/40 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md bg-foreground-tertiary/8 flex items-center justify-center shrink-0">
                        <integration.icon
                          className="w-3 h-3 text-foreground-tertiary"
                          strokeWidth={2}
                        />
                      </div>
                      <span className="text-[13px] font-medium text-foreground flex-1">
                        {integration.name}
                      </span>
                      <StatusBadge
                        type={isConnected ? "success" : "neutral"}
                      >
                        {isConnected ? "Connected" : "Not Connected"}
                      </StatusBadge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={currentValue}
                        onChange={(e) => {
                          const updated = {
                            ...config.google_integrations,
                            [integration.field]: e.target.value,
                          };
                          updateField("google_integrations", updated);
                        }}
                        placeholder={integration.placeholder}
                        className="bg-background-secondary dark:bg-background/60 flex-1 text-[13px]"
                      />
                      {isConnected ? (
                        <Button
                          variant="outline"
                          className="shrink-0 text-[12px]"
                          onClick={() => {
                            const updated = {
                              ...config.google_integrations,
                              [integration.field]: "",
                            };
                            updateField("google_integrations", updated);
                            void saveSection("google", {
                              google_integrations: updated,
                            });
                          }}
                        >
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          className="bg-accent text-white hover:bg-accent/90 border-transparent shrink-0 text-[12px]"
                          disabled={
                            !currentValue || savingSection === "google"
                          }
                          onClick={() => {
                            void saveSection("google", {
                              google_integrations: config.google_integrations,
                            });
                          }}
                        >
                          {savingSection === "google" ? (
                            <Loader2
                              className="w-3 h-3 animate-spin"
                              strokeWidth={2}
                            />
                          ) : (
                            "Connect"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {(savedSection === "google" ||
              (savingSection === "google" && sectionError)) && (
              <div className="flex items-center gap-1 mt-2">
                {savedSection === "google" && (
                  <span className="text-[12px] text-success flex items-center gap-1 animate-in fade-in duration-300">
                    <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
                    Saved
                  </span>
                )}
                {savingSection === "google" && sectionError && (
                  <span className="text-[12px] text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" strokeWidth={2} />
                    {sectionError}
                  </span>
                )}
              </div>
            )}
          </SectionCard>

          {/* -------------------------------------------------------------- */}
          {/* Section 5: API Status                                           */}
          {/* -------------------------------------------------------------- */}
          <SectionCard icon={Plug} title="API Status">
            <div className="rounded-lg overflow-hidden bg-background dark:bg-background/40">
              {apiIntegrations.map((integration, i) => {
                const googleFieldMap: Record<string, string> = {
                  google_analytics: "ga4_property_id",
                  google_search_console: "gsc_site_url",
                  google_tag_manager: "gtm_container_id",
                  google_ads: "google_ads_customer_id",
                };
                const googleField = googleFieldMap[integration.id];
                const isConnected = googleField
                  ? Boolean(config.google_integrations?.[googleField])
                  : config.api_status?.[integration.id] ??
                    [
                      "supabase",
                      "anthropic",
                      "apify",
                      "nvidia",
                      "openai",
                    ].includes(integration.id);

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
                      <StatusBadge
                        type={isConnected ? "success" : "neutral"}
                      >
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

        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 5: Notifications — Notification preferences                     */}
      {/* ================================================================== */}
      {activeTab === "Notifications" && (
        <div className="grid gap-4 max-w-2xl">
          <SectionCard icon={Bell} title="Notification Preferences">
            <div className="space-y-3">
              {[
                {
                  id: "notification_email",
                  label: "Email Notifications",
                  description: "Receive notifications via email",
                },
                {
                  id: "notification_browser",
                  label: "Browser Notifications",
                  description: "Push notifications in the browser",
                },
                {
                  id: "notification_slack",
                  label: "Slack Notifications",
                  description: "Send alerts to your Slack channel",
                },
                {
                  id: "notification_whatsapp",
                  label: "WhatsApp Notifications",
                  description: "Receive alerts via WhatsApp",
                },
              ].map(({ id, label, description }) => (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-lg bg-background dark:bg-background/40 px-3 py-2.5"
                >
                  <div>
                    <p className="text-[13px] font-medium text-foreground">
                      {label}
                    </p>
                    <p className="text-[12px] text-foreground-tertiary">
                      {description}
                    </p>
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

              <div className="space-y-1.5">
                <Label className="text-[13px] text-foreground-secondary">
                  Frequency
                </Label>
                <SegmentedControl
                  options={["Real-time", "Hourly", "Daily"]}
                  value={
                    (config.notification_frequency as string) ?? "Real-time"
                  }
                  onChange={(v) => updateField("notification_frequency", v)}
                />
              </div>

              <SaveButton
                saving={savingSection === "notifications"}
                saved={savedSection === "notifications"}
                error={
                  savingSection === "notifications" ? sectionError : null
                }
                onClick={() =>
                  void saveSection("notifications", {
                    notification_email: config.notification_email,
                    notification_browser: config.notification_browser,
                    notification_slack: config.notification_slack,
                    notification_whatsapp: config.notification_whatsapp,
                    notification_frequency: config.notification_frequency,
                  })
                }
              />
            </div>
          </SectionCard>

          {/* -------------------------------------------------------------- */}
          {/* Section 7: Lead Qualification                                   */}
          {/* -------------------------------------------------------------- */}
          <div className="bg-background-secondary rounded-[10px] p-4 dark:border dark:border-border">
            <h3 className="text-[13px] font-semibold text-foreground mb-3">
              Lead Qualification
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
                  Auto-send threshold
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.lead_auto_send_threshold ?? 85}
                  onChange={(e) =>
                    setConfig({ ...config, lead_auto_send_threshold: parseInt(e.target.value) || 85 })
                  }
                  className="mt-1 w-full px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm"
                />
                <p className="text-[10px] text-foreground-tertiary mt-1">
                  Score at or above this auto-sends email (0-100)
                </p>
              </div>
              <div>
                <label className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
                  Spam threshold
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.lead_review_threshold ?? 50}
                  onChange={(e) =>
                    setConfig({ ...config, lead_review_threshold: parseInt(e.target.value) || 50 })
                  }
                  className="mt-1 w-full px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm"
                />
                <p className="text-[10px] text-foreground-tertiary mt-1">
                  Score below this flagged as spam (0-100)
                </p>
              </div>
              <div>
                <label className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
                  Follow-up intervals (days)
                </label>
                <input
                  type="text"
                  value={config.lead_followup_intervals ?? "2, 4, 7, 14"}
                  onChange={(e) =>
                    setConfig({ ...config, lead_followup_intervals: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm"
                />
                <p className="text-[10px] text-foreground-tertiary mt-1">
                  Comma-separated days between follow-ups
                </p>
              </div>
              <div>
                <label className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
                  Max follow-ups
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={config.lead_max_followups ?? 4}
                  onChange={(e) =>
                    setConfig({ ...config, lead_max_followups: parseInt(e.target.value) || 4 })
                  }
                  className="mt-1 w-full px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm"
                />
                <p className="text-[10px] text-foreground-tertiary mt-1">
                  Stop follow-up sequence after this many
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                void saveSection("lead_qualification", {
                  lead_auto_send_threshold: config.lead_auto_send_threshold,
                  lead_review_threshold: config.lead_review_threshold,
                  lead_followup_intervals: config.lead_followup_intervals,
                  lead_max_followups: config.lead_max_followups,
                })
              }
              className="mt-3 px-4 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
            >
              Save Lead Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
