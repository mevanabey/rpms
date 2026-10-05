import type { ReactNode } from "react";

import { recentLeaseAudit } from "@/server/audit";

import { cookies } from "next/headers";

import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { AppSidebar } from "./app-sidebar";
import { DashboardBreadcrumb } from "./dashboard-breadcrumb";
import { NotificationBell } from "./notification-bell";
import { SearchDialog } from "./sidebar/search-dialog";
import { TourLauncher } from "./tour-launcher";
import { ThemeToggle } from "./theme-toggle";

export async function DashboardShell({ children }: Readonly<{ children: ReactNode }>) {
  const [cookieStore, activity] = await Promise.all([cookies(), recentLeaseAudit()]);
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="floating" collapsible="icon" data-onborda="sidebar" />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex w-full items-center justify-between gap-2 px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mx-2 hidden data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center md:flex"
              />
              <div className="hidden min-w-0 md:block">
                <DashboardBreadcrumb />
              </div>
            </div>
            <div className="flex items-center gap-2" data-onborda="header-chrome">
              <SearchDialog />
              <Separator
                orientation="vertical"
                className="data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center hidden sm:flex"
              />
              <NotificationBell entries={activity} />
              <TourLauncher />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className="h-full p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
