/**
 * Per-user lease scoping. Phase 01 enforces this on the client; Phase 02
 * moves the same predicate into Postgres RLS so the rows never leave the DB.
 *
 * Currently only `lawyer` is scoped — admins and account managers see
 * everything in the portfolio.
 */
import type { AppUser } from "./identity";

/**
 * Return true if `user` is allowed to see this lease. `null` user = no
 * (AuthGate will redirect before we get here).
 */
export function canSeeLease(user: AppUser | null, leaseId: string): boolean {
  if (!user) return false;
  if (user.role === "lawyer") {
    return (user.assignedLeaseIds ?? []).includes(leaseId);
  }
  return true;
}

/** Filter an array of lease-keyed rows down to what `user` may see. */
export function scopeByLease<T>(
  user: AppUser | null,
  rows: readonly T[],
  getLeaseId: (row: T) => string,
): T[] {
  if (!user) return [];
  if (user.role !== "lawyer") return [...rows];
  const allowed = new Set(user.assignedLeaseIds ?? []);
  return rows.filter((r) => allowed.has(getLeaseId(r)));
}
