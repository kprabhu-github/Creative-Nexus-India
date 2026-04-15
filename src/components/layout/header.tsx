"use client";

import { Button } from "@/components/ui/button";
import { GlobalSearch } from "./global-search";
import { NotificationPanel } from "./notification-panel";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Header() {
  return (
    <header className="h-12 flex items-center justify-between px-5 bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-10">
      <div className="flex-1 max-w-md">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationPanel />
        <div className="h-4 w-px bg-border" />
        <Button variant="ghost" className="gap-2 text-foreground-secondary hover:text-foreground h-8 px-2">
          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
            <span className="text-[10px] font-semibold text-white">KP</span>
          </div>
          <span className="text-[13px] font-medium hidden md:block">K. Prabhu</span>
        </Button>
      </div>
    </header>
  );
}
