"use client";

import { ChevronsUpDown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// Placeholder. Real account / sign-out menu wires up when Clerk is added.
export function NavUserPlaceholder() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" disabled>
          <Avatar className="size-8 rounded-lg">
            <AvatarFallback className="rounded-lg">CT</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">Capital Trust staff</span>
            <span className="truncate text-xs text-muted-foreground">
              Auth wires in Phase 02
            </span>
          </div>
          <ChevronsUpDown className="ml-auto size-4 opacity-40" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
