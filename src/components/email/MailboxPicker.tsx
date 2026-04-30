"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Mail } from "lucide-react";

interface MailboxAccount {
  id: string;
  email: string;
  display_name: string;
  status: "connected" | "failed" | "disconnected";
}

interface MailboxPickerProps {
  selectedAccountId: string | null;
  onSelect: (id: string) => void;
  storageKey?: string;
}

export function MailboxPicker({ selectedAccountId, onSelect, storageKey }: MailboxPickerProps) {
  const [accounts, setAccounts] = useState<MailboxAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/xapi/email/accounts");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data?: { accounts?: MailboxAccount[] } };
        if (cancelled) return;
        const connected = (json.data?.accounts ?? []).filter((a) => a.status === "connected");
        setAccounts(connected);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("MailboxPicker: failed to load accounts", err);
        setError(true);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate from localStorage / auto-pick first, once after accounts load.
  useEffect(() => {
    if (loading || error || hydratedRef.current || accounts.length === 0) return;
    if (selectedAccountId && accounts.some((a) => a.id === selectedAccountId)) {
      hydratedRef.current = true;
      return;
    }
    if (storageKey) {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved && accounts.some((a) => a.id === saved)) {
          hydratedRef.current = true;
          onSelect(saved);
          return;
        }
      } catch (err) {
        console.error("MailboxPicker: localStorage read failed", err);
      }
    }
    hydratedRef.current = true;
    onSelect(accounts[0].id);
  }, [loading, error, accounts, selectedAccountId, storageKey, onSelect]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handlePick = (id: string) => {
    onSelect(id);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, id);
      } catch (err) {
        console.error("MailboxPicker: localStorage write failed", err);
      }
    }
    setOpen(false);
  };

  const selected = accounts.find((a) => a.id === selectedAccountId) ?? null;

  if (loading) {
    return (
      <div className="text-[12px] text-foreground-tertiary px-3 py-2 border border-divider rounded-[8px] bg-background-secondary">
        Loading mailboxes&hellip;
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-[12px] text-foreground-tertiary px-3 py-2 border border-divider rounded-[8px] bg-background-secondary">
        Failed to load mailboxes
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <button
        type="button"
        disabled
        className="text-[12px] text-foreground-tertiary px-3 py-2 border border-divider rounded-[8px] bg-background-secondary cursor-not-allowed w-full text-left"
      >
        No mailboxes connected &mdash; go to Settings &rarr; Integrations
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 border border-divider rounded-[8px] bg-background hover:bg-background-secondary text-[12px] text-foreground min-w-[220px]"
      >
        <Mail className="w-3.5 h-3.5 text-foreground-tertiary shrink-0" />
        <span className="flex-1 text-left truncate">
          {selected ? (
            <>
              <span className="font-semibold">{selected.display_name}</span>
              <span className="text-foreground-tertiary ml-1.5 text-[11px]">{selected.email}</span>
            </>
          ) : (
            <span className="text-foreground-tertiary">Choose mailbox&hellip;</span>
          )}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-foreground-tertiary shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[260px] bg-background border border-divider rounded-md shadow-lg py-1 max-h-72 overflow-auto">
          {accounts.map((a) => {
            const isSel = a.id === selectedAccountId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => handlePick(a.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-background-secondary ${isSel ? "bg-accent/10" : ""}`}
              >
                <Mail className="w-3.5 h-3.5 text-foreground-tertiary shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground truncate">{a.display_name}</span>
                  <span className="block text-[11px] text-foreground-tertiary truncate">{a.email}</span>
                </span>
                {isSel && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
