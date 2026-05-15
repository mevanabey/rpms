"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import {
  Bell,
  Building2,
  Coins,
  FileSignature,
  Files,
  Gauge,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  Users,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/**
 * Global command-palette search.
 *
 * For now this is a Quick-Nav-only palette that mirrors the sidebar — once
 * the entity modules (members, classes, etc.) ship, each will register
 * its own searchable rows here so ⌘K becomes the universal find-and-go.
 *
 * Keyboard:
 *   - `⌘K` / `Ctrl+K` — open
 *   - `⌘J` / `Ctrl+J` — also open (legacy binding)
 *   - `Esc` — close (cmdk default)
 */
const QUICK_NAV: Array<{ value: string; label: string; href: string; icon: LucideIcon }> = [
  { value: "dashboard overview home", label: "Dashboard", href: "/", icon: LayoutDashboard },
  { value: "properties buildings", label: "Properties", href: "/properties", icon: Building2 },
  { value: "units floors apartments", label: "Units", href: "/units", icon: Gauge },
  { value: "parties tenants landlords clients", label: "Parties", href: "/parties", icon: Users },
  { value: "leases contracts agreements", label: "Leases", href: "/leases", icon: FileSignature },
  { value: "new lease onboarding", label: "New lease", href: "/leases/new", icon: FileSignature },
  { value: "documents files vault", label: "Documents", href: "/documents", icon: Files },
  { value: "payments ledger receipts", label: "Payments", href: "/payments", icon: Receipt },
  { value: "reconciliation inbox bank", label: "Reconciliation inbox", href: "/payments/inbox", icon: Inbox },
  { value: "commissions introducers payouts", label: "Commissions", href: "/commissions", icon: Coins },
  { value: "reminders notifications", label: "Reminders", href: "/reminders", icon: Bell },
  { value: "maintenance tickets repairs", label: "Maintenance", href: "/maintenance", icon: Wrench },
  { value: "compliance vat stamp duty fire", label: "Compliance", href: "/compliance", icon: ShieldCheck },
  { value: "rent roll report", label: "Rent roll", href: "/reports/rent-roll", icon: ScrollText },
  { value: "arrears late report", label: "Arrears", href: "/reports/arrears", icon: ScrollText },
  { value: "escalations rent increase report", label: "Escalations", href: "/reports/escalations", icon: ScrollText },
  { value: "cashflow report", label: "Cashflow", href: "/reports/cashflow", icon: ScrollText },
  { value: "import xlsx admin migration", label: "Import (XLSX)", href: "/admin/import", icon: UploadCloud },
  { value: "templates email lease admin", label: "Templates", href: "/admin/templates", icon: Settings },
  { value: "workflows admin", label: "Workflows", href: "/admin/workflows", icon: Settings },
  { value: "users admin", label: "Users", href: "/admin/users", icon: Settings },
];

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "j") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="link"
        className="px-0! font-normal text-muted-foreground hover:no-underline"
      >
        <Search data-icon="inline-start" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium text-[10px]">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} className="max-w-xl">
        <Command>
          <CommandInput placeholder="Search the dashboard…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-[480px]">
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup heading="Quick nav">
              {QUICK_NAV.map((item) => (
                <CommandItem key={item.href + item.label} value={item.value} onSelect={() => go(item.href)}>
                  <item.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
