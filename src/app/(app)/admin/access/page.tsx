"use client";

import { useState } from "react";

import {
  Check,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { RoleGate } from "@/components/app/role-gate";
import { RoleFormDialog } from "@/components/app/role-form-dialog";
import { RolePill } from "@/components/app/role-pill";
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
import {
  ALL_RESOURCES,
  PRESET_USERS,
  RESOURCE_GROUPS,
  type Resource,
  type Role,
  type RoleDefinition,
} from "@/lib/demo/identity";
import { usePermissions, useRoleDefs } from "@/lib/demo/use-store";
import { cn } from "@/lib/utils";

export default function RbacPage() {
  return (
    <RoleGate required={["admin:rbac"]}>
      <RbacPageInner />
    </RoleGate>
  );
}

function RbacPageInner() {
  const roleDefs = useRoleDefs();
  const permissions = usePermissions();
  const setPermission = useDemoStore((s) => s.setPermission);
  const deleteRoleDef = useDemoStore((s) => s.deleteRoleDef);
  const resetRolePermissions = useDemoStore((s) => s.resetRolePermissions);
  const resetAllRbac = useDemoStore((s) => s.resetAllRbac);
  const [editing, setEditing] = useState<RoleDefinition | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const userCount = (role: Role) => PRESET_USERS.filter((u) => u.role === role).length;
  const allowedCount = (role: Role) => permissions[role]?.length ?? 0;
  const totalResources = ALL_RESOURCES.length;

  const handleDelete = (role: RoleDefinition) => {
    const inUse = userCount(role.id);
    if (inUse > 0) {
      toast.error(`Can't delete · ${inUse} user${inUse === 1 ? "" : "s"} still assigned to this role`);
      return;
    }
    const result = deleteRoleDef(role.id);
    if (!result.ok) {
      toast.error(result.reason ?? "Couldn't delete role");
      return;
    }
    toast.success(`Role "${role.label}" deleted`);
  };

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div data-onborda="page-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-bold text-2xl tracking-tight">
              <ShieldAlert className="size-6" />
              Access
            </h1>
            <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
              Roles and permissions. The matrix below is the single source of
              truth — sidebar items, page guards, and action buttons all read
              from it. Click any cell to grant or revoke.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              resetAllRbac();
              toast.success("All roles + permissions reset to defaults");
            }}>
              <RotateCcw className="size-3.5" /> Reset all
            </Button>
            <RoleFormDialog
              open={showAdd}
              onOpenChange={setShowAdd}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" /> New role
                </Button>
              }
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7">
        {roleDefs.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardDescription className="text-[11px] uppercase tracking-wider">
                <RolePill role={r.id} size="sm" />
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {allowedCount(r.id)}
                <span className="ml-1 font-normal text-muted-foreground text-xs">
                  of {totalResources}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-2">
              <div className="text-muted-foreground text-xs">
                {userCount(r.id)} user{userCount(r.id) === 1 ? "" : "s"}
                {!r.builtin && (
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    custom
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setEditing(r)}
                  aria-label={`Edit ${r.label}`}
                >
                  <Pencil className="size-3.5" />
                </Button>
                {!r.builtin && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDelete(r)}
                    aria-label={`Delete ${r.label}`}
                    className="text-rose-600 hover:text-rose-700 dark:text-rose-300"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && (
        <RoleFormDialog
          editing={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          trigger={<span />}
        />
      )}

      {RESOURCE_GROUPS.map((g) => (
        <Card key={g.label}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" /> {g.label}
            </CardTitle>
            <CardDescription>
              {g.resources.length} resource{g.resources.length === 1 ? "" : "s"} · click cells to toggle.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px] sticky left-0 bg-background">Resource</TableHead>
                  {roleDefs.map((r) => (
                    <TableHead key={r.id} className="text-center">
                      <RolePill role={r.id} size="sm" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.resources.map((res) => (
                  <TableRow key={res}>
                    <TableCell className="sticky left-0 bg-background font-mono text-xs">
                      {res}
                    </TableCell>
                    {roleDefs.map((r) => {
                      const on = (permissions[r.id] ?? []).includes(res);
                      return (
                        <TableCell key={r.id} className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => setPermission(r.id, res as Resource, !on)}
                            aria-label={`Toggle ${res} for ${r.label}`}
                            className={cn(
                              "inline-flex size-7 items-center justify-center rounded-md border transition-colors",
                              on
                                ? "border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "border-border bg-muted/30 text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {on ? <Check className="size-4" /> : <X className="size-3" />}
                          </button>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-role tools</CardTitle>
          <CardDescription>
            Reset a role’s permissions to the built-in default — useful after
            experimenting with toggles.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {roleDefs.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <RolePill role={r.id} />
                <p className="mt-1 text-muted-foreground text-xs">{r.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!r.builtin}
                onClick={() => {
                  resetRolePermissions(r.id);
                  toast.success(`${r.label} permissions reset to default`);
                }}
              >
                <RotateCcw className="size-3.5" /> Reset
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
