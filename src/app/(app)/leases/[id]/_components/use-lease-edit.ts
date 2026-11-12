"use client";

/** Per-lease edit state. The view switch temporarily renders List View while
 * editing; the browser's saved layout preference remains unchanged. */
import { create } from "zustand";

interface EditState {
  editing: Record<string, boolean>;
  setEditing: (leaseId: string, on: boolean) => void;
}

export const useLeaseEditStore = create<EditState>((set) => ({
  editing: {},
  setEditing: (leaseId, on) => {
    set((s) => ({ editing: { ...s.editing, [leaseId]: on } }));
  },
}));

export function useLeaseEditing(leaseId: string): boolean {
  return useLeaseEditStore((s) => s.editing[leaseId] ?? false);
}
