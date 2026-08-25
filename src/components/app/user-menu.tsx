"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { ChevronsUpDown, LogOut, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useDemoStore } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/use-store";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";

import { RolePill } from "./role-pill";

export function UserMenu() {
  const { isMobile } = useSidebar();
  const user = useCurrentUser();
  const logout = useDemoStore((s) => s.logout);
  const clearDemo = useDemoStore((s) => s.clearDemo);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!user) return null;

  const handleSignOut = () => {
    startTransition(async () => {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch (e) {
        toast.error("Sign-out failed", {
          description: e instanceof Error ? e.message : String(e),
        });
        return;
      }
      // Drop any persisted client state so the next session is clean.
      logout();
      try {
        clearDemo();
      } catch {
        // clearDemo throws if not hydrated yet — safe to ignore.
      }
      router.replace("/login");
      router.refresh();
    });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                  {user.initials ?? getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-medium text-sm">{user.name}</span>
                <RolePill role={user.role} size="sm" className="mt-0.5 w-fit" />
              </div>
              <ChevronsUpDown className="ml-auto size-4 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <div className="px-2 py-1.5 text-xs">
              <div className="truncate font-medium">{user.email}</div>
              <div className="text-[10px] text-muted-foreground">
                Capital Trust · {user.entities.length > 0 ? user.entities.join(", ") : "no entities assigned"}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/admin/users")}>
              <UserCog className="size-3.5" />
              Manage users
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                if (!pending) handleSignOut();
              }}
              variant="destructive"
            >
              <LogOut className="size-3.5" />
              {pending ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
