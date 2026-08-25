"use client";

/**
 * Per-lease "view mode" — toggles between the rich default layout (parties,
 * clauses, premises card, KPIs, etc.) and a compact "details" view that lists
 * every captured field in a two-column table followed by the rent + ledger
 * tables. Stored in a tiny Zustand map keyed by lease id so the toggle button
 * (above the progress panel) and the page renderer share state without
 * lifting it through a server component.
 *
 * Default = "default".
 */
import { create } from "zustand";

export type LeaseViewMode = "default" | "details";

interface ViewState {
  mode: Record<string, LeaseViewMode>;
  setMode: (leaseId: string, value: LeaseViewMode) => void;
  toggle: (leaseId: string) => void;
}

export const useLeaseViewStore = create<ViewState>((set) => ({
  mode: {},
  setMode: (leaseId, value) =>
    set((s) => ({ mode: { ...s.mode, [leaseId]: value } })),
  toggle: (leaseId) =>
    set((s) => {
      const current = s.mode[leaseId] ?? "default";
      return {
        mode: {
          ...s.mode,
          [leaseId]: current === "default" ? "details" : "default",
        },
      };
    }),
}));

export function useLeaseViewMode(leaseId: string): LeaseViewMode {
  return useLeaseViewStore((s) => s.mode[leaseId] ?? "default");
}
