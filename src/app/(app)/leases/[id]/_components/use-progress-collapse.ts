"use client";

/**
 * Per-lease collapse state for the lease-progress block. Lives in a tiny
 * Zustand store so the toggle button (in LeaseDetailActions) and the block
 * itself (rendered above the KPI strip) share the same open/closed flag
 * without lifting state up to a server component parent.
 *
 * Default = open. Per-lease scope so collapsing one lease's progress doesn't
 * collapse another's.
 */
import { create } from "zustand";

interface CollapseState {
  open: Record<string, boolean>;
  toggle: (leaseId: string) => void;
  set: (leaseId: string, value: boolean) => void;
}

export const useProgressCollapse = create<CollapseState>((set) => ({
  open: {},
  toggle: (leaseId) =>
    set((s) => ({
      open: { ...s.open, [leaseId]: !(s.open[leaseId] ?? true) },
    })),
  set: (leaseId, value) =>
    set((s) => ({ open: { ...s.open, [leaseId]: value } })),
}));

export function useProgressOpen(leaseId: string): boolean {
  return useProgressCollapse((s) => s.open[leaseId] ?? true);
}
