/** Per-user lease scoping for server access checks and client views. */
import type { AppUser } from "./identity";

/**
 * Return true if `user` is allowed to see this lease. `null` user = no
 * (AuthGate will redirect before we get here).
 */
export function canSeeLease(user: AppUser | null, leaseId: string): boolean {
  if (!user) return false;
  if (user.role === "lawyer" || user.role === "accountant" || user.role === "advisor") {
    return (user.assignedLeaseIds ?? []).includes(leaseId);
  }
  return user.role === "admin" || user.role === "account_manager";
}

/** Filter an array of lease-keyed rows down to what `user` may see. */
export function scopeByLease<T>(
  user: AppUser | null,
  rows: readonly T[],
  getLeaseId: (row: T) => string,
): T[] {
  if (!user) return [];
  if (user.role === "admin" || user.role === "account_manager") return [...rows];
  if (user.role !== "lawyer" && user.role !== "accountant" && user.role !== "advisor") return [];
  const allowed = new Set(user.assignedLeaseIds ?? []);
  return rows.filter((r) => allowed.has(getLeaseId(r)));
}
