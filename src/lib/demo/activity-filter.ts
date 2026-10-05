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

import { canSeeLease } from "./scope";
import { hasRole } from "./identity";

export function filterActivities(activities: readonly Activity[], user: AppUser | null): Activity[] {
  if (!user) return [];
  return activities.filter((activity) => activity.leaseId ? canSeeLease(user, activity.leaseId) : hasRole(user, "admin"));
}
