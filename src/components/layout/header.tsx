"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GlobalSearch } from "./global-search";
import { NotificationPanel } from "./notification-panel";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { User, Settings, LogOut } from "lucide-react";

interface MeShape {
  id: string;
  email: string;
  profile: {
    display_name: string | null;
    avatar_url: string | null;
    title: string | null;
    role?: string | null;
  } | null;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function Header() {
  const router = useRouter();
  const [me, setMe] = useState<MeShape | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled && json?.data) setMe(json.data as MeShape); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const displayName = me?.profile?.display_name || me?.email?.split("@")[0] || "User";
  const avatarUrl = me?.profile?.avatar_url;
  const subtitle = me?.profile?.title || me?.email || "";

  return (
    <header className="h-12 flex items-center justify-between px-5 bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-10">
      <div className="flex-1 max-w-md">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationPanel />
        <div className="h-4 w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 h-8 px-2 rounded-md text-foreground-secondary hover:text-foreground hover:bg-muted/50 transition-colors">
            <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] font-semibold text-white">{initials(displayName)}</span>
              )}
            </div>
            <span className="text-[13px] font-medium hidden md:block">{displayName}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold leading-tight">{displayName}</span>
                <span className="text-[11px] text-foreground-tertiary leading-tight mt-0.5">{subtitle}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>My profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings/integrations")} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Email integrations</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
