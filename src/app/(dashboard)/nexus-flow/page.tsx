"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Send,
  Mail,
  ArrowUpRight,
  Eye,
  MessageSquare,
  Clock,
  Play,
  Pause,
  FileEdit,
  Users,
  Copy,
  RefreshCw,
  Pencil,
  CheckCircle2,
  Loader2,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// API response types for /api/outreach/generate
// ---------------------------------------------------------------------------

interface EmailStep {
  step: number;
  subject_line: string;
  opening_hook: string;
  body: string;
  cta: string;
  ab_variants: Array<{ subject_line: string }>;
}

interface LinkedInOutput {
  connection_request: string;
  follow_up_message: string;
  engagement_prompts: Array<{ context: string; comment: string }>;
}

interface SequenceStep {
  step: number;
  channel: "email" | "linkedin";
  timing: string;
  subject_or_hook: string;
  purpose: string;
  personalisation_variables: string[];
}

interface OutreachApiResponse {
  data: {
    campaignId: string;
    campaign: {
      sequence: SequenceStep[];
      emails: EmailStep[];
      linkedinMessages: LinkedInOutput;
    };
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OutreachStatus = "Opened" | "Replied" | "No Response";
type SequenceStatus = "Active" | "Paused" | "Draft";
type ChannelType = "Email" | "LinkedIn";
type ToneOption = "Professional" | "Casual" | "Direct";

interface Prospect {
  id: string;
  name: string;
  company: string;
  currentStep: number;
  totalSteps: number;
  channel: ChannelType;
  lastAction: string;
  status: OutreachStatus;
}

interface Sequence {
  id: string;
  name: string;
  channel: ChannelType;
  totalSteps: number;
  enrolled: number;
  sent: number;
  opened: number;
  replied: number;
  status: SequenceStatus;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const activeMetrics = [
  { label: "Active Sequences", value: "4", icon: Play, color: "text-accent" },
  { label: "Messages Sent Today", value: "89", icon: Send, color: "text-success" },
  { label: "Reply Rate", value: "11.2%", icon: MessageSquare, color: "text-warning" },
];

const prospects: Prospect[] = [
  {
    id: "p1",
    name: "Meera Krishnan",
    company: "Freshworks",
    currentStep: 3,
    totalSteps: 5,
    channel: "Email",
    lastAction: "Opened email 2h ago",
    status: "Opened",
  },
  {
    id: "p2",
    name: "Rajesh Venkataraman",
    company: "Zoho Corp",
    currentStep: 2,
    totalSteps: 4,
    channel: "LinkedIn",
    lastAction: "Accepted connection request",
    status: "Replied",
  },
  {
    id: "p3",
    name: "Divya Sundaram",
    company: "Razorpay",
    currentStep: 4,
    totalSteps: 5,
    channel: "Email",
    lastAction: "No opens on last 2 emails",
    status: "No Response",
  },
  {
    id: "p4",
    name: "Arjun Nair",
    company: "CleverTap",
    currentStep: 1,
    totalSteps: 4,
    channel: "LinkedIn",
    lastAction: "Message sent 6h ago",
    status: "Opened",
  },
  {
    id: "p5",
    name: "Sneha Patil",
    company: "Darwinbox",
    currentStep: 5,
    totalSteps: 5,
    channel: "Email",
    lastAction: "Replied with interest",
    status: "Replied",
  },
];

const sequences: Sequence[] = [
  {
    id: "s1",
    name: "SaaS Decision Makers - Q2 Outbound",
    channel: "Email",
    totalSteps: 5,
    enrolled: 340,
    sent: 1024,
    opened: 436,
    replied: 89,
    status: "Active",
  },
  {
    id: "s2",
    name: "FinTech Founders - LinkedIn Connect",
    channel: "LinkedIn",
    totalSteps: 4,
    enrolled: 180,
    sent: 520,
    opened: 318,
    replied: 63,
    status: "Paused",
  },
  {
    id: "s3",
    name: "HRTech Heads - Cold Intro",
    channel: "Email",
    totalSteps: 6,
    enrolled: 95,
    sent: 190,
    opened: 72,
    replied: 14,
    status: "Draft",
  },
];

const mockGeneratedMessage = {
  subject: "Quick question about Freshworks' content strategy",
  body: `Hi Meera,

I noticed Freshworks recently expanded into the mid-market segment — congratulations on the growth. We've been helping SaaS companies like CleverTap and Darwinbox scale their content operations using AI-driven workflows that cut production time by 60%.

Would love to share a quick case study showing how a similar team reduced their content backlog from 8 weeks to 2. No pitch, just context.

Worth a 15-minute chat this week?

Best,
Prabhu
Creative Nexus Global`,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function outreachStatusType(status: OutreachStatus) {
  switch (status) {
    case "Opened":
      return "info" as const;
    case "Replied":
      return "success" as const;
    case "No Response":
      return "neutral" as const;
  }
}

function sequenceStatusType(status: SequenceStatus) {
  switch (status) {
    case "Active":
      return "success" as const;
    case "Paused":
      return "warning" as const;
    case "Draft":
      return "neutral" as const;
  }
}

function ChannelIcon({ channel, className }: { channel: ChannelType; className?: string }) {
  if (channel === "Email") {
    return <Mail className={className} strokeWidth={2} />;
  }
  return <Send className={className} strokeWidth={2} />;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: LucideIcon; color: string }) {
  return (
    <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-medium text-foreground-tertiary">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} strokeWidth={1.5} />
      </div>
      <p className="text-[22px] font-bold text-foreground tracking-tight">{value}</p>
    </div>
  );
}

function ProspectRow({ prospect }: { prospect: Prospect }) {
  const initials = prospect.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <div className="flex items-center gap-3 py-2.5 px-3.5 hover:bg-surface-hover transition-colors group">
      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
        <span className="text-[11px] font-semibold text-accent">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-foreground truncate">{prospect.name}</p>
          <span className="text-[11px] text-foreground-tertiary">{prospect.company}</span>
        </div>
        <p className="text-[11px] text-foreground-tertiary truncate">{prospect.lastAction}</p>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        <ChannelIcon
          channel={prospect.channel}
          className="w-3.5 h-3.5 text-foreground-tertiary"
        />
        <span className="text-[11px] text-foreground-tertiary">{prospect.channel}</span>
      </div>
      <div className="hidden md:block shrink-0">
        <span className="text-[12px] font-medium text-foreground">
          Step {prospect.currentStep} of {prospect.totalSteps}
        </span>
        <ProgressBar
          value={prospect.currentStep}
          max={prospect.totalSteps}
          color="accent"
          className="mt-1 w-20"
        />
      </div>
      <div className="shrink-0">
        <StatusBadge type={outreachStatusType(prospect.status)}>{prospect.status}</StatusBadge>
      </div>
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-label={`View ${prospect.name} details`}
      >
        <ArrowUpRight className="w-3.5 h-3.5 text-foreground-tertiary" />
      </button>
    </div>
  );
}

function SequenceCard({ sequence }: { sequence: Sequence }) {
  const openRate = ((sequence.opened / sequence.sent) * 100).toFixed(1);
  const replyRate = ((sequence.replied / sequence.sent) * 100).toFixed(1);

  return (
    <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
            <ChannelIcon channel={sequence.channel} className="w-3.5 h-3.5 text-accent" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">{sequence.name}</h3>
            <p className="text-[11px] text-foreground-tertiary">
              {sequence.channel} &middot; {sequence.totalSteps} steps
            </p>
          </div>
        </div>
        <StatusBadge type={sequenceStatusType(sequence.status)}>{sequence.status}</StatusBadge>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-foreground-tertiary/8 flex items-center justify-center shrink-0">
          <Users className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-foreground">{sequence.enrolled}</p>
          <p className="text-[10px] text-foreground-tertiary">Prospects enrolled</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-background rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-foreground-tertiary flex items-center gap-1">
            <Send className="w-2.5 h-2.5" /> Sent
          </p>
          <p className="text-[15px] font-semibold text-foreground mt-0.5">{sequence.sent.toLocaleString()}</p>
        </div>
        <div className="bg-background rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-foreground-tertiary flex items-center gap-1">
            <Eye className="w-2.5 h-2.5" /> Opened
          </p>
          <p className="text-[15px] font-semibold text-foreground mt-0.5">{sequence.opened.toLocaleString()}</p>
          <p className="text-[10px] text-foreground-tertiary">{openRate}%</p>
        </div>
        <div className="bg-background rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-foreground-tertiary flex items-center gap-1">
            <MessageSquare className="w-2.5 h-2.5" /> Replied
          </p>
          <p className="text-[15px] font-semibold text-foreground mt-0.5">{sequence.replied.toLocaleString()}</p>
          <p className="text-[10px] text-foreground-tertiary">{replyRate}%</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {sequence.status === "Active" && (
          <Button variant="outline" size="sm" className="flex-1">
            <Pause className="w-3 h-3 mr-1" strokeWidth={2} />
            Pause
          </Button>
        )}
        {sequence.status === "Paused" && (
          <Button size="sm" className="flex-1 bg-accent text-white hover:bg-accent/90 border-transparent">
            <Play className="w-3 h-3 mr-1" strokeWidth={2.5} />
            Resume
          </Button>
        )}
        {sequence.status === "Draft" && (
          <Button size="sm" className="flex-1 bg-accent text-white hover:bg-accent/90 border-transparent">
            <Play className="w-3 h-3 mr-1" strokeWidth={2.5} />
            Launch
          </Button>
        )}
        <Button variant="outline" size="sm" className="flex-1">
          <FileEdit className="w-3 h-3 mr-1" strokeWidth={2} />
          Edit
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab content
// ---------------------------------------------------------------------------

function ActiveTab() {
  return (
    <div className="space-y-4">
      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-3">
        {activeMetrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Active outreach list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-foreground">Active Outreach</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
            {prospects.length} prospects in sequence
          </span>
        </div>
        <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border divide-y divide-divider">
          {prospects.map((prospect) => (
            <ProspectRow key={prospect.id} prospect={prospect} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SequencesTab() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground">All Sequences</span>
        <Button size="sm" className="bg-accent text-white hover:bg-accent/90 border-transparent">
          <Play className="w-3 h-3 mr-1" strokeWidth={2.5} />
          New Sequence
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {sequences.map((seq) => (
          <SequenceCard key={seq.id} sequence={seq} />
        ))}
      </div>
    </div>
  );
}

function AIWriterTab({
  generatedEmails,
  generatedLinkedIn,
  generateLoading,
  generateError,
  onGenerate,
}: {
  generatedEmails: EmailStep[];
  generatedLinkedIn: LinkedInOutput | null;
  generateLoading: boolean;
  generateError: string | null;
  onGenerate: (tone: string) => void;
}) {
  const [tone, setTone] = useState<ToneOption>("Professional");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = generatedEmails.length > 0
      ? `Subject: ${generatedEmails[0].subject_line}\n\n${generatedEmails[0].body}`
      : `Subject: ${mockGeneratedMessage.subject}\n\n${mockGeneratedMessage.body}`;
    void navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Use first email from API if available, otherwise fall back to mock
  const displaySubject = generatedEmails.length > 0
    ? generatedEmails[0].subject_line
    : mockGeneratedMessage.subject;
  const displayBody = generatedEmails.length > 0
    ? `${generatedEmails[0].opening_hook}\n\n${generatedEmails[0].body}\n\n${generatedEmails[0].cta}`
    : mockGeneratedMessage.body;
  const hasLiveData = generatedEmails.length > 0;

  return (
    <div className="space-y-4">
      {/* Generate message card */}
      <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-[7px] bg-accent/10 flex items-center justify-center shrink-0">
            <Pencil className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">Generate Message</h3>
            <p className="text-[11px] text-foreground-tertiary">AI writes personalised outreach for each prospect</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {/* Prospect selector (mock) */}
          <div>
            <label className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider block mb-1.5">
              Prospect
            </label>
            <div className="flex items-center gap-2.5 bg-background rounded-lg px-3 py-2 border border-border">
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-semibold text-accent">MK</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground">Meera Krishnan</p>
                <p className="text-[11px] text-foreground-tertiary">VP Marketing, Freshworks</p>
              </div>
            </div>
          </div>

          {/* Tone selector */}
          <div>
            <label className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider block mb-1.5">
              Tone
            </label>
            <SegmentedControl
              options={["Professional", "Casual", "Direct"]}
              value={tone}
              onChange={(v) => setTone(v as ToneOption)}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-accent text-white hover:bg-accent/90 border-transparent"
            disabled={generateLoading}
            onClick={() => onGenerate(tone.toLowerCase())}
          >
            {generateLoading ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" strokeWidth={2} />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3 mr-1" strokeWidth={2} />
                Generate
              </>
            )}
          </Button>
          {generateError && (
            <p className="text-[11px] text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {generateError}
            </p>
          )}
        </div>
      </div>

      {/* Generated message preview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">Generated Message</span>
            {hasLiveData && <StatusBadge type="success">Live</StatusBadge>}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-foreground-tertiary" />
            <span className="text-[11px] text-foreground-tertiary">
              {hasLiveData ? "Generated just now" : "Generated 2 min ago"}
            </span>
          </div>
        </div>
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          {/* Subject line */}
          <div className="mb-3">
            <p className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1">
              Subject Line
            </p>
            <p className="text-[13px] font-semibold text-foreground">{displaySubject}</p>
            {/* Show A/B variants if available */}
            {generatedEmails.length > 0 && generatedEmails[0].ab_variants.length > 0 && (
              <div className="mt-1.5 space-y-1">
                {generatedEmails[0].ab_variants.map((variant, i) => (
                  <p key={i} className="text-[11px] text-foreground-tertiary">
                    Variant {String.fromCharCode(66 + i)}: {variant.subject_line}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-divider mb-3" />

          {/* Body */}
          <div className="mb-4">
            <p className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1.5">
              Body
            </p>
            <div className="bg-background rounded-lg px-3.5 py-3 border border-border">
              <p className="text-[13px] text-foreground-secondary leading-relaxed whitespace-pre-line">
                {displayBody}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1 text-success" strokeWidth={2} />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" strokeWidth={2} />
                  Copy
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <Pencil className="w-3 h-3 mr-1" strokeWidth={2} />
              Edit
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-accent text-white hover:bg-accent/90 border-transparent"
              disabled={generateLoading}
              onClick={() => onGenerate(tone.toLowerCase())}
            >
              {generateLoading ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" strokeWidth={2} />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3 mr-1" strokeWidth={2} />
                  Regenerate
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* LinkedIn messages section — only shown when live data exists */}
      {generatedLinkedIn && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-foreground">LinkedIn Messages</span>
            <StatusBadge type="info">AI Generated</StatusBadge>
          </div>
          <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border space-y-3">
            {/* Connection request */}
            <div>
              <p className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1">
                Connection Request
              </p>
              <div className="bg-background rounded-lg px-3.5 py-2.5 border border-border">
                <p className="text-[13px] text-foreground-secondary leading-relaxed">
                  {generatedLinkedIn.connection_request}
                </p>
              </div>
            </div>

            {/* Follow-up message */}
            <div>
              <p className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1">
                Follow-up Message
              </p>
              <div className="bg-background rounded-lg px-3.5 py-2.5 border border-border">
                <p className="text-[13px] text-foreground-secondary leading-relaxed">
                  {generatedLinkedIn.follow_up_message}
                </p>
              </div>
            </div>

            {/* Engagement prompts */}
            {generatedLinkedIn.engagement_prompts.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1">
                  Engagement Comments
                </p>
                <div className="space-y-2">
                  {generatedLinkedIn.engagement_prompts.map((prompt, i) => (
                    <div key={i} className="bg-background rounded-lg px-3.5 py-2.5 border border-border">
                      <p className="text-[10px] text-foreground-tertiary mb-1">{prompt.context}</p>
                      <p className="text-[12px] text-foreground-secondary">{prompt.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const tabs = ["Active", "Sequences", "AI Writer"] as const;
type Tab = (typeof tabs)[number];

interface OutreachSettings {
  outreach_sender_name?: string;
  outreach_sender_title?: string;
  outreach_company_value?: string;
  outreach_default_tone?: string;
  [key: string]: unknown;
}

export default function NexusFlowPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Active");
  const [settings, setSettings] = useState<OutreachSettings | null>(null);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/xapi/settings");
        if (res.ok) {
          const json = (await res.json()) as { data: OutreachSettings };
          setSettings(json.data ?? null);
        }
      } catch {
        // Settings load failed — will use hardcoded defaults
      }
    }
    void loadSettings();
  }, []);

  // ---------------------------------------------------------------------------
  // AI Writer state
  // ---------------------------------------------------------------------------
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedEmails, setGeneratedEmails] = useState<EmailStep[]>([]);
  const [generatedLinkedIn, setGeneratedLinkedIn] = useState<LinkedInOutput | null>(null);

  /** Generate outreach campaign via /api/outreach/generate. */
  const handleGenerate = useCallback(async (tone: string) => {
    setGenerateLoading(true);
    setGenerateError(null);

    // Use settings defaults where available
    const productValue = settings?.outreach_company_value ??
      "AI-driven content operations platform that cuts production time by 60% and scales content output for B2B SaaS companies.";
    const resolvedTone = tone || settings?.outreach_default_tone || "professional";

    try {
      const res = await fetch("/xapi/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: "Outreach for Meera Krishnan — Freshworks",
          targetRole: "VP Marketing",
          targetIndustry: "SaaS / MarTech",
          productValue,
          tone: resolvedTone,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errBody?.error ?? `Generation failed (${res.status})`);
      }

      const json = (await res.json()) as OutreachApiResponse;
      setGeneratedEmails(json.data.campaign.emails);
      setGeneratedLinkedIn(json.data.campaign.linkedinMessages);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate outreach";
      setGenerateError(message);
    } finally {
      setGenerateLoading(false);
    }
  }, [settings]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="LinkedIn Outreach"
        description="Multi-channel outreach ops — email sequences, LinkedIn, follow-ups with AI-personalised messaging."
        actions={
          <SegmentedControl
            options={[...tabs]}
            value={activeTab}
            onChange={(v) => setActiveTab(v as Tab)}
          />
        }
      />

      {activeTab === "Active" && <ActiveTab />}
      {activeTab === "Sequences" && <SequencesTab />}
      {activeTab === "AI Writer" && (
        <AIWriterTab
          generatedEmails={generatedEmails}
          generatedLinkedIn={generatedLinkedIn}
          generateLoading={generateLoading}
          generateError={generateError}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  );
}
