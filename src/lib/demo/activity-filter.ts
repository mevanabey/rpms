/**
 * Per-role activity filtering. The activity feed, the dashboard live panel,
 * and the notification bell all run activities through `filterActivities`
 * so each user sees only what their role is supposed to see.
 *
 * Phase 02 wires this through Postgres RLS — rows the user can't see never
 * leave the database. The shape stays the same.
 */
import type { AppUser } from "./identity";
import type { Activity } from "./types";

export function filterActivities(
  activities: readonly Activity[],
  user: AppUser | null,
): Activity[] {
  if (!user) return [];

  switch (user.role) {
    case "admin":
    case "account_manager":
      return [...activities];

    case "lawyer": {
      // Scoped to their assigned leases. Untargeted activities (no leaseId)
      // are dropped unless they're a system/human note about the lawyer.
      const myLeases = new Set(user.assignedLeaseIds ?? []);
      return activities.filter((a) => {
        if (a.workflow === "human" && a.title.includes(user.name)) return true;
        if (!a.leaseId) return false;
        return myLeases.has(a.leaseId);
      });
    }

    default:
      // Custom role: no opinions yet — show only activities they could
      // navigate to (i.e. ones with no lease, or their own decisions).
      return activities.filter(
        (a) => a.workflow === "human" || a.workflow === "system",
      );
  }
}
