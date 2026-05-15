"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { getSidebarItems } from "@/navigation/sidebar/sidebar-items";
import { useCanAnyCheck, useCurrentUser } from "@/lib/demo/use-store";

import { EntitySwitcher } from "./entity-switcher";
import { NavMain } from "./nav-main";
import { UserMenu } from "./user-menu";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const user = useCurrentUser();
  const canAny = useCanAnyCheck();
  const navItems = user ? getSidebarItems(canAny) : [];

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <EntitySwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
