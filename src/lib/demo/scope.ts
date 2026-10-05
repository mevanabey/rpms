/** Per-user lease scoping for server access checks and client views. */
import type { AppUser } from "./identity";
import { hasRole } from "./identity";

/**
 * Return true if `user` is allowed to see this lease. `null` user = no
 * (AuthGate will redirect before we get here).
 */
export function canSeeLease(user: AppUser | null, leaseId: string): boolean {
  if (!user) return false;
  return hasRole(user, "admin") ||
    (user.assignedLeaseIds ?? []).includes(leaseId) ||
    (user.createdLeaseIds ?? []).includes(leaseId);
}

/** Filter an array of lease-keyed rows down to what `user` may see. */
export function scopeByLease<T>(
  user: AppUser | null,
  rows: readonly T[],
  getLeaseId: (row: T) => string,
): T[] {
  if (!user) return [];
  if (hasRole(user, "admin")) return [...rows];
  const allowed = new Set([...(user.assignedLeaseIds ?? []), ...(user.createdLeaseIds ?? [])]);
  return rows.filter((r) => allowed.has(getLeaseId(r)));
}
