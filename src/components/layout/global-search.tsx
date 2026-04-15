"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Users, FileText, Search, CreditCard, Activity, Briefcase } from "lucide-react";

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[13px] text-foreground-tertiary bg-surface-hover rounded-lg transition-colors hover:bg-surface-active"
      >
        <Search className="w-3.5 h-3.5" strokeWidth={2} />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="ml-auto text-[10px] font-medium text-foreground-tertiary bg-background border border-border rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search clients, leads, projects..." />
        <CommandList>
          <CommandEmpty className="py-10 text-center text-[13px] text-foreground-tertiary">
            No results found.
          </CommandEmpty>
          <CommandGroup heading="Clients & Leads">
            <CommandItem onSelect={() => runCommand(() => router.push("/people"))}>
              <Users className="mr-2 h-4 w-4 text-foreground-tertiary" strokeWidth={1.8} />
              People Directory
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/gtm/leads"))}>
              <Briefcase className="mr-2 h-4 w-4 text-foreground-tertiary" strokeWidth={1.8} />
              Leads Management
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Operations">
            <CommandItem onSelect={() => runCommand(() => router.push("/finance/invoices"))}>
              <CreditCard className="mr-2 h-4 w-4 text-foreground-tertiary" strokeWidth={1.8} />
              Invoices
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/signal"))}>
              <Activity className="mr-2 h-4 w-4 text-foreground-tertiary" strokeWidth={1.8} />
              Signal Runs
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/executive"))}>
              <FileText className="mr-2 h-4 w-4 text-foreground-tertiary" strokeWidth={1.8} />
              Executive Reports
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
