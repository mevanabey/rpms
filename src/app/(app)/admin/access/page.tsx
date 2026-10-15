import { Check, ShieldCheck, X } from "lucide-react";
import { eq } from "drizzle-orm";

import { requireResource } from "@/lib/auth/authorization";
import { ALL_RESOURCES, DEFAULT_PERMISSIONS, DEFAULT_ROLES, RESOURCE_GROUPS, rolesFor, type Resource } from "@/lib/demo/identity";
import { db } from "@/server/db/client";
import { userRole } from "@/server/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const permissionLabels: Record<Resource, string> = {
  "properties:read": "View properties", "properties:create": "Add properties", "properties:write": "Edit properties independently",
  "units:read": "View units", "units:create": "Add units", "units:write": "Edit units",
  "parties:read": "View contacts", "parties:create": "Add contacts", "parties:write": "Edit contacts independently",
  "leases:read": "View visible leases", "leases:create": "Add leases", "leases:write": "Edit and delete visible leases",
  "documents:read": "View lease documents", "documents:write": "Create and update lease documents",
  "checklists:manage": "Upload and import checklists",
  "payments:read": "View rent and payments", "payments:write": "Mark and reverse rent payments", "payments:reconcile": "Reconcile payments",
  "reminders:read": "View reminders", "reminders:send": "Send reminders",
  "commissions:read": "View commissions", "commissions:payout": "Pay commissions",
  "maintenance:read": "View maintenance", "maintenance:write": "Manage maintenance",
  "compliance:read": "View compliance", "compliance:write": "Manage compliance",
  "tasks:read": "View tasks", "tasks:decide": "Decide tasks",
  "automation:read": "View automation", "automation:promote": "Manage automation",
  "reports:read": "View reports",
  "admin:import": "Import legacy workbooks", "admin:templates": "Manage templates", "admin:workflows": "Manage workflow settings",
  "admin:users": "Manage users", "admin:rbac": "View the permissions matrix", "admin:reset-demo": "Manage demo data",
};

/** Display the same effective rules used by server authorization and navigation. */
export default async function RbacPage() {
  await requireResource("admin:rbac");
  const accounts = await db.select({ role: userRole.role, roles: userRole.roles })
    .from(userRole).where(eq(userRole.isActive, true));

  return <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
    <div>
      <h1 className="flex items-center gap-2 font-bold text-2xl tracking-tight">
        <ShieldCheck className="size-6" /> Roles and permissions
      </h1>
      <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
        Current access rules for every role. This matrix is read-only and matches
        the permissions enforced by the server.
      </p>
      <p className="mt-2 max-w-3xl text-muted-foreground text-sm">
        Only admins can see every lease. Other staff see leases assigned to them
        or created by them. Multiple roles combine their permissions.
        Lease editing includes deletion; rent payments require their own permission.
        Checklist management includes upload and import; the resulting records are managed in Leases.
        Lease editors can also correct linked contacts and property details from that lease.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {DEFAULT_ROLES.map((role) => <Card key={role.id}>
        <CardHeader>
          <CardTitle className="text-base"><Badge variant="outline" className={role.tone}>{role.label}</Badge></CardTitle>
          <CardDescription>{role.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{DEFAULT_PERMISSIONS[role.id]?.length ?? 0} of {ALL_RESOURCES.length} permissions</p>
          <p className="text-muted-foreground">{accounts.filter((account) => rolesFor(account).includes(role.id)).length} active accounts</p>
        </CardContent>
      </Card>)}
    </div>

    {RESOURCE_GROUPS.map((group) => <Card key={group.label}>
      <CardHeader><CardTitle className="text-base">{group.label}</CardTitle></CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="sticky left-0 min-w-[220px] bg-background">Permission</TableHead>
            {DEFAULT_ROLES.map((role) => <TableHead key={role.id} className="text-center">{role.label}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>{group.resources.map((resource) => <TableRow key={resource}>
            <TableCell className="sticky left-0 bg-background text-sm" data-permission={resource}>{permissionLabels[resource]}</TableCell>
            {DEFAULT_ROLES.map((role) => {
              const allowed = DEFAULT_PERMISSIONS[role.id]?.includes(resource) ?? false;
              return <TableCell key={role.id} className="text-center" aria-label={`${role.label}: ${allowed ? "Allowed" : "Not granted"}`}>
                {allowed
                  ? <Check className="mx-auto size-4 text-emerald-600" aria-hidden />
                  : <X className="mx-auto size-4 text-muted-foreground" aria-hidden />}
              </TableCell>;
            })}
          </TableRow>)}</TableBody>
        </Table>
      </CardContent>
    </Card>)}
  </div>;
}
