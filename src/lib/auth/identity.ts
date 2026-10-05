import "server-only";
import { cache } from "react";
import { and, eq, inArray } from "drizzle-orm";

import { getAuthUser } from "@/lib/supabase/auth";
import { rolesFor, type AppUser } from "@/lib/demo/identity";
import { db } from "@/server/db/client";
import { lease as leaseTable, leasePartyRoleTable, userRole as userRoleTable } from "@/server/db/schema";

const PARTICIPANT_ROLES = {
  lawyer: ["lessor_lawyer", "lessee_lawyer"],
  accountant: ["accountant_handler"],
  advisor: ["advisor"],
} as const;

function deriveDisplayName(email: string, metadataName?: string | null): string {
  if (metadataName && metadataName.trim()) return metadataName.trim();
  const local = email.split("@")[0] ?? "User";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

/** Verified Supabase session paired with an explicitly provisioned access row.
 * Unknown accounts are never auto-provisioned. Request-level caching shares
 * the lookup between layouts, pages, and server actions. */
export const getAccountAccess = cache(async () => {
  const sbUser = await getAuthUser();
  if (!sbUser?.email) return null;

  const [row] = await db
    .select()
    .from(userRoleTable)
    .where(eq(userRoleTable.userId, sbUser.id))
    .limit(1);
  return row ? { authUser: sbUser, row } : null;
});

export const getCurrentAppUser = cache(async (): Promise<AppUser | null> => {
  const access = await getAccountAccess();
  if (!access) return null;
  const { authUser: sbUser, row } = access;

  // Only explicitly provisioned active accounts may enter RPMS.
  if (!row || !row.isActive || row.passwordSetupRequired) {
    return null;
  }

  const metadataName =
    (sbUser.user_metadata?.name as string | undefined) ??
    (sbUser.user_metadata?.full_name as string | undefined);

  const name = deriveDisplayName(sbUser.email!, metadataName);
  const initials = name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  const roleIds = rolesFor(row);
  const participantRoles = roleIds.flatMap((role) => {
    if (role === "lawyer") return [...PARTICIPANT_ROLES.lawyer];
    if (role === "accountant") return [...PARTICIPANT_ROLES.accountant];
    if (role === "advisor") return [...PARTICIPANT_ROLES.advisor];
    return [];
  });
  const assignments = participantRoles.length
    ? await db
        .select({ leaseId: leasePartyRoleTable.leaseId })
        .from(leasePartyRoleTable)
        .where(and(
          eq(leasePartyRoleTable.userId, sbUser.id),
          inArray(leasePartyRoleTable.role, participantRoles),
        ))
    : [];
  const created = await db.select({ id: leaseTable.id }).from(leaseTable)
    .where(eq(leaseTable.createdBy, sbUser.id));

  return {
    id: sbUser.id,
    name,
    email: sbUser.email!,
    role: row.role,
    roles: roleIds,
    entities: row.entities ?? [],
    initials,
    partyId: row.partyId ?? undefined,
    assignedLeaseIds: assignments.map((assignment) => assignment.leaseId),
    createdLeaseIds: created.map((item) => item.id),
  };
});

/**
 * Throws when there is no authenticated user. Use in server actions to
 * refuse anonymous mutations.
 */
export async function requireAppUser(): Promise<AppUser> {
  const user = await getCurrentAppUser();
  if (!user) {
    throw new Error("Not authenticated.");
  }
  return user;
}
