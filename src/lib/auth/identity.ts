import "server-only";
import { cache } from "react";
import { eq, sql } from "drizzle-orm";

import { getAuthUser } from "@/lib/supabase/auth";
import type { AppUser, Role } from "@/lib/demo/identity";
import { db } from "@/server/db/client";
import { userRole as userRoleTable } from "@/server/db/schema";

/**
 * Roles known to the permissions matrix in `src/lib/demo/identity.ts`.
 * `viewer` is the auto-provisioned default for users without an explicit
 * entry — read-only, sees nothing privileged. Promotions happen in
 * /admin/users.
 */
const DEFAULT_NEW_USER_ROLE: Role = "viewer";

function deriveDisplayName(email: string, metadataName?: string | null): string {
  if (metadataName && metadataName.trim()) return metadataName.trim();
  const local = email.split("@")[0] ?? "User";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Atomic upsert of the user_role row. INSERT ... ON CONFLICT DO UPDATE
 * always returns the row, so concurrent layout renders never race against
 * each other (the previous SELECT-then-INSERT pattern was a duplicate-key
 * waiting to happen the moment Next.js re-rendered the layout twice).
 *
 * The DO UPDATE just touches `updated_at` — we never overwrite an admin's
 * role/entities accidentally.
 */
async function upsertUserRoleRow(userId: string) {
  const [row] = await db
    .insert(userRoleTable)
    .values({
      userId,
      role: DEFAULT_NEW_USER_ROLE,
      entities: [],
      assignedLeaseIds: [],
      isActive: true,
    })
    .onConflictDoUpdate({
      target: userRoleTable.userId,
      set: { updatedAt: sql`now()` },
    })
    .returning();
  return row;
}

/**
 * Resolves the currently-authenticated AppUser from the Supabase session
 * and the `user_role` table.
 *
 * Behaviour:
 *   - No Supabase session                       → returns null
 *   - First-time user (no user_role row)         → atomically provisions a
 *                                                  `viewer` row, returns AppUser
 *   - Existing user, `is_active = false`         → returns null (treated as
 *                                                  signed out)
 *   - DB unavailable / transient error           → throws (the layout will
 *                                                  surface a server error
 *                                                  rather than silently
 *                                                  signing the user out)
 *
 * Wrapped in `React.cache` so Server Components in a single request share
 * one resolution.
 */
export const getCurrentAppUser = cache(async (): Promise<AppUser | null> => {
  const sbUser = await getAuthUser();
  if (!sbUser?.email) return null;

  // Try a plain SELECT first — the common case is "row already exists".
  // Only fall through to the upsert on a miss.
  let [row] = await db
    .select()
    .from(userRoleTable)
    .where(eq(userRoleTable.userId, sbUser.id))
    .limit(1);

  if (!row) {
    row = await upsertUserRoleRow(sbUser.id);
  }

  if (!row || row.isActive === false) {
    return null;
  }

  const metadataName =
    (sbUser.user_metadata?.name as string | undefined) ??
    (sbUser.user_metadata?.full_name as string | undefined);

  const name = deriveDisplayName(sbUser.email, metadataName);
  const initials = name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  return {
    id: sbUser.id,
    name,
    email: sbUser.email,
    role: row.role,
    entities: row.entities ?? [],
    initials,
    partyId: row.partyId ?? undefined,
    assignedLeaseIds: row.assignedLeaseIds ?? undefined,
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
