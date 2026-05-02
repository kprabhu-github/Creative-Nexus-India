"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Zap, Share2, Radar, Target, Link2,
  FileText, Briefcase, MessageCircle, Settings,
  Users, DollarSign, Clock, ListChecks, Hash, BrainCircuit, TrendingUp,
  Receipt, FileSignature, CalendarDays, UserPlus,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const modulesNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Signal Engine", href: "/signal", icon: Zap },
  { name: "Social Intelligence", href: "/social", icon: Share2 },
  { name: "AI SearchLens", href: "/searchlens", icon: Radar },
  { name: "GTM Engine", href: "/gtm", icon: Target },
  { name: "LinkedIn Outreach", href: "/linkedin", icon: Link2 },
  { name: "Website Leads", href: "/leads", icon: Users },
];

const opsNav = [
  { name: "Executive", href: "/executive", icon: TrendingUp },
  { name: "Team", href: "/team", icon: Users },
  { name: "Projects", href: "/projects", icon: Briefcase },
  { name: "Attendance", href: "/attendance", icon: Clock },
  { name: "Expenses", href: "/finance/expenses", icon: Receipt },
  { name: "Invoices", href: "/finance/invoices", icon: FileText },
  { name: "Finance", href: "/finance", icon: DollarSign },
  { name: "Contracts", href: "/contracts", icon: FileSignature },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Onboarding", href: "/onboarding", icon: UserPlus },
  { name: "Inbox", href: "/inbox", icon: MessageCircle },
  { name: "Sprints", href: "/ops/projects", icon: ListChecks },
  { name: "Channels", href: "/slack", icon: Hash },
  { name: "AI Lab", href: "/ops", icon: BrainCircuit },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) setCollapsed(JSON.parse(saved));
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(next));
  };

  const renderLinks = (links: typeof modulesNav) =>
    links.map((link) => {
      const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
      return (
        <Link
          key={link.name}
          href={link.href}
          className={cn(
            "group relative flex items-center gap-2.5 mx-2 px-2.5 py-[6px] rounded-md transition-[background-color,color] duration-150 ease-out active:scale-[0.98]",
            active
              ? "bg-surface-active/60 text-foreground font-medium"
              : "text-foreground-secondary hover:bg-surface-hover/70 hover:text-foreground"
          )}
        >
          {active && (
            <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-accent" />
          )}
          <link.icon
            className={cn(
              "w-4 h-4 shrink-0 transition-colors",
              active ? "text-accent" : "text-foreground-tertiary group-hover:text-foreground-secondary"
            )}
            strokeWidth={1.5}
          />
          {!collapsed && (
            <span className="text-[13px] tracking-tight truncate">{link.name}</span>
          )}
        </Link>
      );
    });

  return (
    <aside
      className={cn(
        "h-screen flex flex-col transition-all duration-200 ease-out relative shrink-0",
        "bg-[hsl(var(--sidebar-bg))] backdrop-blur-2xl border-r border-border/60",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      <div className="flex items-center gap-2.5 px-3.5 h-12 shrink-0">
        <div className="w-7 h-7 rounded-[7px] bg-foreground flex items-center justify-center shrink-0 relative">
          <span className="text-background font-bold text-[11px]">CX</span>
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#D90A2C] rotate-45" />
        </div>
        {!collapsed && (
          <span className="text-[13px] font-semibold text-foreground tracking-tight truncate">
            Command Centre
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className={cn("px-3 mb-1.5", collapsed && "hidden")}>
          <span className="text-[10px] font-semibold text-foreground-tertiary/80 uppercase tracking-[0.12em]">
            Modules
          </span>
        </div>
        <div className="space-y-px">{renderLinks(modulesNav)}</div>

        <div className={cn("px-3 mt-6 mb-1.5", collapsed && "hidden")}>
          <span className="text-[10px] font-semibold text-foreground-tertiary/80 uppercase tracking-[0.12em]">
            Operations
          </span>
        </div>
        {collapsed && <div className="h-3" />}
        <div className="space-y-px">{renderLinks(opsNav)}</div>
      </div>

      <button
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "flex items-center gap-2 mx-2 mb-2 px-2.5 py-[6px] rounded-md text-foreground-tertiary hover:text-foreground hover:bg-surface-hover/70 transition-colors duration-150 ease-out",
          collapsed && "justify-center"
        )}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} /> : <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />}
        {!collapsed && <span className="text-[12px] tracking-tight">Collapse</span>}
      </button>

      <div className={cn(
        "px-3.5 py-2.5 text-[10px] text-foreground-tertiary/70 border-t border-border/60 tracking-tight",
        collapsed && "text-center px-0"
      )}>
        {collapsed ? "CX" : "creativenexus.in"}
      </div>
    </aside>
  );
}
