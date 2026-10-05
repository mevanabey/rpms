"use client";

/**
 * Hooks that wrap `useDemoStore` with shallow comparison so callers don't
 * have to remember `useShallow` for every array/object selector.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";

import { useShallow } from "zustand/react/shallow";

import {
  selectDecidedApprovals,
  selectPendingApprovals,
  useDemoStore,
} from "./store";
import {
  canAny as canAnyImpl,
  can as canImpl,
  DEFAULT_PERMISSIONS,
  PRESET_USERS,
  type AppUser,
  type Resource,
  type Role,
  type RoleDefinition,
} from "./identity";
import { useAuthIdentity } from "@/lib/auth/identity-context";

/** True once the persisted state has rehydrated client-side. */
export function useDemoHydrated(): boolean {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const hydrated = useDemoStore((s) => s.hydrated);
  useEffect(() => {
    if (!useDemoStore.getState().hydrated) {
      void useDemoStore.persist.rehydrate();
    }
  }, []);
  return mounted && hydrated;
}

export function usePendingApprovals() {
  return useDemoStore(useShallow(selectPendingApprovals));
}

export function useDecidedApprovals() {
  return useDemoStore(useShallow(selectDecidedApprovals));
}

export function useActivities() {
  return useDemoStore(useShallow((s) => s.activities));
}

export function useDraftLeases() {
  return useDemoStore(useShallow((s) => s.draftLeases));
}

export function useDraftProperties() {
  return useDemoStore(useShallow((s) => s.draftProperties));
}

export function useDraftUnits() {
  return useDemoStore(useShallow((s) => s.draftUnits));
}

export function useDraftParties() {
  return useDemoStore(useShallow((s) => s.draftParties));
}

export function useAutonomyMatrix() {
  return useDemoStore(useShallow((s) => s.autonomy));
}

export function useTickets() {
  return useDemoStore(useShallow((s) => s.tickets));
}

export function useTemplateOverrides() {
  return useDemoStore(useShallow((s) => s.templateOverrides));
}

export function useRentPayments() {
  return useDemoStore(useShallow((s) => s.rentPayments));
}

const EMPTY_SIGNATURES = {} as Record<string, { dataUrl: string; signedAt: string; by: string }>;
export function useLeaseSignatures(leaseId: string) {
  return useDemoStore(
    useShallow((s) => s.leaseSignatures[leaseId] ?? EMPTY_SIGNATURES),
  );
}

export function useLeaseDocSettings() {
  return useDemoStore(useShallow((s) => s.leaseDocSettings));
}

export function useRentReminders() {
  return useDemoStore(useShallow((s) => s.rentReminders));
}

/**
 * Overlay map of party addresses captured by the lease intake form.
 * Use `partyAddressFor(partyId)` to resolve an address: overlay first, then
 * the server-rendered `Party.address` as fallback.
 */
export function usePartyAddresses() {
  return useDemoStore(useShallow((s) => s.partyAddresses));
}

import { filterActivities } from "./activity-filter";

/**
 * Activities filtered for the current user according to their role. Use this
 * everywhere a feed is rendered (page, dashboard panel, notification bell).
 * Memoised so consumers can pass it to effects without re-render loops.
 */
export function useVisibleActivities(): import("./types").Activity[] {
  const all = useActivities();
  const user = useCurrentUser();
  return useMemo(
    () => filterActivities(all, user),
    [all, user],
  );
}

/**
 * Currently logged-in user. Prefers the server-resolved Supabase identity
 * injected by `<AuthIdentityProvider>`; falls back to the legacy in-memory
 * `PRESET_USERS` lookup so the public /login page still works before a
 * session exists.
 */
export function useCurrentUser(): AppUser | null {
  const fromCtx = useAuthIdentity();
  const id = useDemoStore((s) => s.currentUserId);
  if (fromCtx) return fromCtx;
  if (!id) return null;
  return PRESET_USERS.find((u) => u.id === id) ?? null;
}

// ───────────────────────────────────────────────────────────── RBAC hooks

export function useRoleDefs(): RoleDefinition[] {
  return useDemoStore(useShallow((s) => s.roleDefs));
}

/** Resolve display info for a single role id, with sensible fallback. */
export function useRoleDef(role: Role | null | undefined): RoleDefinition | undefined {
  return useDemoStore(useShallow((s) => s.roleDefs.find((r) => r.id === role)));
}

export function usePermissions(): Record<Role, Resource[]> {
  // Production permission rules must not depend on stale browser demo state.
  return DEFAULT_PERMISSIONS;
}

/**
 * Returns a checker bound to the *current user* and current permissions.
 * Components and `getSidebarItems` use this to decide what to show.
 */
export function useCanCheck(): (resource: Resource) => boolean {
  const user = useCurrentUser();
  const permissions = usePermissions();
  return (resource) => {
    return canImpl(user, permissions, resource);
  };
}

export function useCanAnyCheck(): (resources: Resource[]) => boolean {
  const user = useCurrentUser();
  const permissions = usePermissions();
  return (resources) => canAnyImpl(user, permissions, resources);
}
