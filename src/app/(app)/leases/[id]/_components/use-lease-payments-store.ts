"use client";

/**
 * Per-lease optimistic ledger overlay. When the user marks rent as paid we
 * append the returned `LedgerEntry` here so the Active panel stats and the
 * Recent ledger table reflect the payment instantly — without waiting for
 * Next 16's `router.refresh()` to flow the new RSC payload through (which
 * is slow in dev).
 *
 * Cleared per-lease when the server props have caught up; the consumer
 * components use a `key` derived from props so the state lifecycle ties
 * itself to the latest server snapshot.
 */
import { create } from "zustand";

import type { LedgerEntry } from "@/core/types";

interface State {
  byLease: Record<string, LedgerEntry[]>;
  add: (leaseId: string, entry: LedgerEntry) => void;
  clear: (leaseId: string) => void;
}

export const useLeasePaymentsStore = create<State>((set) => ({
  byLease: {},
  add: (leaseId, entry) =>
    set((s) => ({
      byLease: {
        ...s.byLease,
        [leaseId]: [...(s.byLease[leaseId] ?? []), entry],
      },
    })),
  clear: (leaseId) =>
    set((s) => {
      if (!s.byLease[leaseId]) return s;
      const next = { ...s.byLease };
      delete next[leaseId];
      return { byLease: next };
    }),
}));

// Stable empty array reference. Returning `[]` from the selector creates a
// new array each call, fails React's snapshot equality check, and triggers
// "getSnapshot should be cached / Maximum update depth exceeded" loops.
const EMPTY: readonly LedgerEntry[] = Object.freeze([]);

export function useOptimisticPaidEntries(leaseId: string): readonly LedgerEntry[] {
  return useLeasePaymentsStore((s) => s.byLease[leaseId] ?? EMPTY);
}
