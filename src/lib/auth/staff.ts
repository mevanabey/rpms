import "server-only";

import type { User } from "@supabase/supabase-js";
import { inArray } from "drizzle-orm";

import { requireResource } from "@/lib/auth/authorization";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { db } from "@/server/db/client";
import { userRole } from "@/server/db/schema";

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: "lawyer" | "accountant" | "advisor";
  partyId?: string;
}

/** Only lease editors receive the account directory. Contacts remain separate. */
export async function getAssignableStaff(): Promise<StaffUser[]> {
  const caller = await requireResource("leases:read");
  if (caller.role !== "admin" && caller.role !== "account_manager") return [];

  const authUsers: User[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await getSupabaseAdmin().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list staff: ${error.message}`);
    authUsers.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const users = authUsers.filter((user) => user.email);
  if (users.length === 0) return [];
  const roles = await db.select().from(userRole).where(inArray(userRole.userId, users.map((u) => u.id)));
  const byId = new Map(roles.map((role) => [role.userId, role]));
  return users.flatMap((user): StaffUser[] => {
    const row = byId.get(user.id);
    if (!row?.isActive || !["lawyer", "accountant", "advisor"].includes(row.role)) return [];
    const email = user.email!;
    const name = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? email.split("@")[0]);
    return [{ id: user.id, email, name, role: row.role as StaffUser["role"], partyId: row.partyId ?? undefined }];
  }).sort((a, b) => a.name.localeCompare(b.name));
}
