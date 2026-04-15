"use client";

import { useState } from "react";
import { Settings2, Plug, Palette, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Integration {
  id: string;
  name: string;
  description: string;
  connected: boolean;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const integrations: Integration[] = [
  {
    id: "supabase",
    name: "Supabase",
    description: "Database and authentication",
    connected: true,
  },
  {
    id: "semrush",
    name: "Semrush",
    description: "SEO and keyword research",
    connected: true,
  },
  {
    id: "apify",
    name: "Apify",
    description: "Web scraping and automation",
    connected: true,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Team communication",
    connected: false,
  },
];

// ---------------------------------------------------------------------------
// Section Card
// ---------------------------------------------------------------------------

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Settings2;
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
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [orgName, setOrgName] = useState("Creative Nexus Global");
  const [domain, setDomain] = useState("creativenexusglobal.com");

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Settings"
        description="Organisation and preferences"
      />

      <div className="grid gap-4 max-w-2xl">
        {/* Organisation */}
        <SectionCard icon={Settings2} title="Organisation">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="orgName" className="text-[13px] text-foreground-secondary">
                Organisation Name
              </Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="bg-background dark:bg-background/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="domain" className="text-[13px] text-foreground-secondary">
                Domain
              </Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="bg-background dark:bg-background/40"
              />
            </div>
            <Button className="bg-accent text-white hover:bg-accent/90 border-transparent">
              Save
            </Button>
          </div>
        </SectionCard>

        {/* Integrations */}
        <SectionCard icon={Plug} title="Integrations">
          <div className="rounded-lg overflow-hidden bg-background dark:bg-background/40">
            {integrations.map((integration, i) => (
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
                  <div className="flex items-center gap-2.5 shrink-0">
                    <StatusBadge
                      type={integration.connected ? "success" : "neutral"}
                    >
                      {integration.connected ? "Connected" : "Not Connected"}
                    </StatusBadge>
                    <Button variant="outline" size="xs">
                      Configure
                    </Button>
                  </div>
                </div>
                {i < integrations.length - 1 && (
                  <div className="h-px bg-divider mx-3" />
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Theme */}
        <SectionCard icon={Palette} title="Theme">
          <p className="text-[13px] text-foreground-secondary">
            Theme is controlled from the header toggle.
          </p>
          <p className="text-[11px] text-foreground-tertiary mt-1">
            Use the sun/moon icon in the top-right corner of the header to switch between light and dark mode.
          </p>
        </SectionCard>

        {/* Billing */}
        <SectionCard icon={CreditCard} title="Billing">
          <div className="rounded-lg bg-background dark:bg-background/40 px-3 py-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-0.5">
                  Current Plan
                </div>
                <div className="text-[13px] font-semibold text-foreground">
                  Full Stack Retainer
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-0.5">
                  Monthly MRR
                </div>
                <div className="text-[13px] font-semibold text-foreground">
                  &#8377;2,50,000/mo
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-0.5">
                  Next Billing
                </div>
                <div className="text-[13px] font-semibold text-foreground">
                  May 1, 2026
                </div>
              </div>
            </div>
            <div className="h-px bg-divider my-3" />
            <Button variant="outline" size="sm">
              Manage Plan
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
