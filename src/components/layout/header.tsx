"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GlobalSearch } from "./global-search";
import { NotificationPanel } from "./notification-panel";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { User, Settings, Mail, LogOut } from "lucide-react";

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
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled && json?.data) setMe(json.data as MeShape); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function go(path: string) {
    setOpen(false);
    router.push(path);
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

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 h-8 px-2 rounded-md text-foreground-secondary hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] font-semibold text-white">{initials(displayName)}</span>
              )}
            </div>
            <span className="text-[13px] font-medium hidden md:block">{displayName}</span>
            <svg width="10" height="10" viewBox="0 0 12 12" className="opacity-50"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>

          {open && (
            <div
              className="absolute right-0 top-full mt-1 w-64 bg-background border border-border rounded-lg shadow-lg overflow-hidden z-50"
              role="menu"
            >
              <div className="px-3 py-2.5 border-b border-border">
                <div className="text-[13px] font-semibold text-foreground leading-tight">{displayName}</div>
                <div className="text-[11px] text-foreground-tertiary leading-tight mt-0.5 truncate">{subtitle}</div>
              </div>
              <div className="py-1">
                <MenuItem icon={<User className="h-4 w-4" />} label="My profile" onClick={() => go("/profile")} />
                <MenuItem icon={<Settings className="h-4 w-4" />} label="Settings" onClick={() => go("/settings")} />
                <MenuItem icon={<Mail className="h-4 w-4" />} label="Email integrations" onClick={() => go("/settings/integrations")} />
              </div>
              <div className="border-t border-border py-1">
                <MenuItem icon={<LogOut className="h-4 w-4" />} label="Sign out" onClick={handleSignOut} destructive />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium hover:bg-muted/60 transition-colors text-left ${destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground"}`}
    >
      <span className={destructive ? "text-destructive" : "text-foreground-secondary"}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
