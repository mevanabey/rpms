"use client";

import { Building2, ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

// Placeholder until the real Capital Trust group switcher lands. The list of
// entities matches docs/SPEC.md §12 (multi-entity tenancy). When wired up, the
// active entity will be persisted via cookies and resolved server-side; the
// UI shape here is the contract.
const ENTITIES = [
  { id: "cth", name: "Capital Trust Holdings", short: "CTH" },
  { id: "ctp1", name: "Capital Trust Properties One", short: "CTP-1" },
  { id: "ctr", name: "Capital Trust Residencies", short: "CTR" },
  { id: "tcl", name: "Tech City Lanka", short: "TCL" },
  { id: "cbpo", name: "Capital BPO", short: "CBPO" },
  { id: "colbpo", name: "Colombo BPO", short: "ColBPO" },
];

export function EntitySwitcher() {
  const { isMobile } = useSidebar();
  const active = ENTITIES[0];

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{active.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  Capital Trust group
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Legal entities
            </DropdownMenuLabel>
            {ENTITIES.map((e) => (
              <DropdownMenuItem key={e.id} className="gap-2 p-2" disabled={e.id !== active.id}>
                <div className="flex size-6 items-center justify-center rounded-sm border bg-background text-[10px] font-medium">
                  {e.short.slice(0, 3)}
                </div>
                <div className="flex-1 text-sm">{e.name}</div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              Switcher wires up in Phase 02 (auth + RLS scope)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
