"use client";

import Link from "next/link";

import { Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { RoleGate } from "@/components/app/role-gate";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDemoStore } from "@/lib/demo/store";
import { PRESET_USERS } from "@/lib/demo/identity";
import { useCurrentUser, useRoleDef } from "@/lib/demo/use-store";
import { getInitials } from "@/lib/utils";

import { RolePill } from "@/components/app/role-pill";

export default function UsersPage() {
  const me = useCurrentUser();
  const loginAs = useDemoStore((s) => s.loginAs);
  // const pushActivity = useDemoStore((s) => s.pushActivity); // activity log disabled

  return (
    <RoleGate required={["admin:users"]}>
      <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-bold text-2xl tracking-tight">Users</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Capital Trust group staff + role mapping. Clerk wires up in Phase 02.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/access">
                <ShieldAlert className="size-3.5" /> Open RBAC matrix
              </Link>
            </Button>
            <Button size="sm" disabled>
              <Plus className="size-4" /> Invite
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              Role + entity scope drive sidebar visibility, mutation
              authorization, and RLS scoping. Click "Sign in as" to simulate
              that user during the demo.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Entities</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PRESET_USERS.map((u) => {
                  const isMe = me?.id === u.id;
                  return (
                    <TableRow key={u.id} className={isMe ? "bg-muted/40" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7">
                            <AvatarFallback className="text-xs">
                              {u.initials ?? getInitials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{u.name}</div>
                            {isMe && (
                              <div className="text-emerald-700 text-[10px] dark:text-emerald-300">
                                signed in
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <RolePill role={u.role} withTooltip />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.entities.map((e) => (
                            <Badge key={e} variant="outline" className="font-mono text-[10px]">
                              {e}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        >
                          active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isMe}
                          onClick={() => {
                            const label =
                              useDemoStore
                                .getState()
                                .roleDefs.find((r) => r.id === u.role)?.label ?? u.role;
                            loginAs(u.id);
                            // Activity log disabled — app simplified.
                            // pushActivity({
                            //   workflow: "human",
                            //   severity: "info",
                            //   title: `Switched user → ${u.name}`,
                            //   body: `Now signed in as ${label}.`,
                            // });
                            toast.success(`Now signed in as ${u.name}`, {
                              description: `Role · ${label}.`,
                            });
                          }}
                        >
                          {isMe ? "Current" : "Sign in as"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
