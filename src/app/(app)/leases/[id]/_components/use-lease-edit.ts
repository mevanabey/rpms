"use client";

/**
 * Per-lease "edit mode" — the single edit method for a lease (SPEC §5).
 *
 * Turning it on forces the page into the compact **details view** (the
 * two-column checklist list) and turns every editable value cell into the
 * right form control; each field saves on its own the moment it changes, so
 * there is no draft state and no global Save button.
 *
 * Turning it off restores whichever view the operator was on before.
 * Kept in a tiny Zustand map keyed by lease id — same pattern as
 * `use-lease-view` / `use-progress-collapse` — so the header button and the
 * table cells share state without lifting it through a server component.
 */
import { create } from "zustand";

import { useLeaseViewStore, type LeaseViewMode } from "./use-lease-view";

interface EditState {
  editing: Record<string, boolean>;
  /** View mode to restore when edit mode is switched back off. */
  restore: Record<string, LeaseViewMode>;
  setEditing: (leaseId: string, on: boolean) => void;
}

export const useLeaseEditStore = create<EditState>((set, get) => ({
  editing: {},
  restore: {},
  setEditing: (leaseId, on) => {
    const view = useLeaseViewStore.getState();
    if (on) {
      const previous = view.mode[leaseId] ?? "default";
      view.setMode(leaseId, "details");
      set((s) => ({
        editing: { ...s.editing, [leaseId]: true },
        restore: { ...s.restore, [leaseId]: previous },
      }));
      return;
    }
    view.setMode(leaseId, get().restore[leaseId] ?? "default");
    set((s) => ({ editing: { ...s.editing, [leaseId]: false } }));
  },
}));

export function useLeaseEditing(leaseId: string): boolean {
  return useLeaseEditStore((s) => s.editing[leaseId] ?? false);
}
