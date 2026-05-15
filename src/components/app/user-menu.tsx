"use client";

import { useRouter } from "next/navigation";

import { ChevronsUpDown, LogOut, Sparkles, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useDemoStore } from "@/lib/demo/store";
import { PRESET_USERS } from "@/lib/demo/identity";
import { useCurrentUser, useRoleDef } from "@/lib/demo/use-store";
import { cn, getInitials } from "@/lib/utils";

import { RolePill } from "./role-pill";

export function UserMenu() {
  const { isMobile } = useSidebar();
  const user = useCurrentUser();
  const myRoleDef = useRoleDef(user?.role);
  const loginAs = useDemoStore((s) => s.loginAs);
  const logout = useDemoStore((s) => s.logout);
  const router = useRouter();

  if (!user) return null;

  const onSwitch = (id: string) => {
    if (id === user.id) return;
    const next = PRESET_USERS.find((u) => u.id === id);
    if (!next) return;
    loginAs(id);
    void myRoleDef;
    const toLabel =
      useDemoStore.getState().roleDefs.find((r) => r.id === next.role)?.label ??
      next.role;
    // Activity log disabled — app simplified.
    // pushActivity({
    //   workflow: "human",
    //   severity: "info",
    //   title: `Switched user → ${next.name}`,
    //   body: `From ${user.name} (${myRoleDef?.label ?? user.role}) to ${next.name} (${toLabel}).`,
    // });
    toast.success(`Now signed in as ${next.name}`, {
      description: `Role · ${toLabel}.`,
    });
  };

  const onSignOut = () => {
    // Activity log disabled — app simplified.
    // pushActivity({
    //   workflow: "human",
    //   severity: "info",
    //   title: `${user.name} signed out`,
    // });
    logout();
    router.replace("/login");
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
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3" />
              Switch user (demo)
            </DropdownMenuLabel>
            {PRESET_USERS.map((u) => (
              <DropdownMenuItem
                key={u.id}
                className={cn("gap-2 p-2", u.id === user.id && "bg-muted")}
                onSelect={() => onSwitch(u.id)}
              >
                <Avatar className="size-7">
                  <AvatarFallback className="text-[10px]">
                    {u.initials ?? getInitials(u.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{u.name}</span>
                  <span className="truncate text-muted-foreground text-[10px]">
                    <UserRoleSummary role={u.role} entities={u.entities} />
                  </span>
                </div>
                {u.id === user.id && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    current
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/admin/users")}>
              <UserCog className="size-3.5" />
              Manage users
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onSignOut} variant="destructive">
              <LogOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function UserRoleSummary({ role, entities }: { role: string; entities: string[] }) {
  const def = useRoleDef(role);
  return (
    <>
      {def?.label ?? role} · {entities.join(", ")}
    </>
  );
}
