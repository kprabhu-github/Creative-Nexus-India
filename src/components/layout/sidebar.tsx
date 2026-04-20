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
  { name: "Team", href: "/people", icon: Users },
  { name: "Projects", href: "/projects", icon: Briefcase },
  { name: "Attendance", href: "/attendance", icon: Clock },
  { name: "Expenses", href: "/finance/expenses", icon: Receipt },
  { name: "Invoices", href: "/finance/invoices", icon: FileText },
  { name: "Finance", href: "/finance", icon: DollarSign },
  { name: "Contracts", href: "/contracts", icon: FileSignature },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Onboarding", href: "/onboarding", icon: UserPlus },
  { name: "Inbox", href: "/messages", icon: MessageCircle },
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
            "flex items-center gap-2 mx-2 px-2 py-[5px] rounded-md transition-colors",
            active
              ? "bg-surface-active text-foreground font-medium"
              : "text-foreground-secondary hover:bg-surface-hover"
          )}
        >
          <link.icon
            className={cn(
              "w-4 h-4 shrink-0",
              active ? "text-foreground" : "text-foreground-tertiary"
            )}
            strokeWidth={1.8}
          />
          {!collapsed && (
            <span className="text-[13px] truncate">{link.name}</span>
          )}
        </Link>
      );
    });

  return (
    <aside
      className={cn(
        "h-screen flex flex-col transition-all duration-200 relative shrink-0",
        "bg-[hsl(var(--sidebar-bg))] backdrop-blur-xl border-r border-border",
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

      <button
        onClick={toggleCollapsed}
        className="absolute -right-3 top-14 bg-background border border-border rounded-full p-0.5 text-foreground-tertiary hover:text-foreground transition-colors z-10"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      <div className="flex-1 overflow-y-auto py-2">
        <div className={cn("px-3 mb-1", collapsed && "hidden")}>
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider">
            Modules
          </span>
        </div>
        <div className="space-y-px">{renderLinks(modulesNav)}</div>

        <div className={cn("px-3 mt-5 mb-1", collapsed && "hidden")}>
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider">
            Operations
          </span>
        </div>
        {collapsed && <div className="h-3" />}
        <div className="space-y-px">{renderLinks(opsNav)}</div>
      </div>

      <div className={cn(
        "px-3.5 py-3 text-[11px] text-foreground-tertiary border-t border-border",
        collapsed && "text-center px-0"
      )}>
        {collapsed ? "CX" : "creativenexus.in"}
      </div>
    </aside>
  );
}
