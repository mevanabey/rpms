import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { isNotNull } from "drizzle-orm";

import { requireResource } from "@/lib/auth/authorization";
import { DEFAULT_ROLES } from "@/lib/demo/identity";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { db } from "@/server/db/client";
import { leasePartyRoleTable, userRole } from "@/server/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function UsersPage() {
  await requireResource("admin:users");
  const authUsers: User[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await getSupabaseAdmin().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    authUsers.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const [roles, assignments] = await Promise.all([
    db.select().from(userRole),
    db.select({ userId: leasePartyRoleTable.userId, leaseId: leasePartyRoleTable.leaseId })
      .from(leasePartyRoleTable).where(isNotNull(leasePartyRoleTable.userId)),
  ]);
  const roleById = new Map(roles.map((row) => [row.userId, row]));
  const leaseIdsByUser = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    if (!assignment.userId) continue;
    const ids = leaseIdsByUser.get(assignment.userId) ?? new Set<string>();
    ids.add(assignment.leaseId);
    leaseIdsByUser.set(assignment.userId, ids);
  }
  const labels = new Map(DEFAULT_ROLES.map((role) => [role.id, role.label]));

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Users</h1>
        <p className="mt-1 text-muted-foreground text-sm">Supabase accounts and their RPMS access. Assign lawyers, accountants, and advisors from a lease’s Team & contacts section.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>System users</CardTitle>
          <CardDescription>External contacts live in Parties and have no login access. Staff lease access requires an explicit system-user assignment.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>User</TableHead><TableHead>App role</TableHead><TableHead>Linked contact</TableHead><TableHead>Leases</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {authUsers.filter((user) => user.email).sort((a, b) => a.email!.localeCompare(b.email!)).map((user) => {
                const row = roleById.get(user.id);
                const name = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email!.split("@")[0]);
                return <TableRow key={user.id}>
                  <TableCell><div className="font-medium">{name}</div><div className="text-xs text-muted-foreground">{user.email}</div></TableCell>
                  <TableCell>{row ? labels.get(row.role) ?? row.role : "No RPMS role"}</TableCell>
                  <TableCell>{row?.partyId ? <Link className="text-primary hover:underline" href={`/parties/${row.partyId}`}>View contact</Link> : "—"}</TableCell>
                  <TableCell>{leaseIdsByUser.get(user.id)?.size ?? 0}</TableCell>
                  <TableCell><Badge variant="outline">{row?.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
