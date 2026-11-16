"use client";

/** Browser-wide lease layout preference, shared across leases and reloads.
 * The server snapshot always uses List View so localStorage cannot cause a
 * hydration mismatch. Edit mode overrides the layout without changing it. */
import { useSyncExternalStore } from "react";
import { create } from "zustand";

import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";

export type LeaseViewMode = "list" | "card" | "checklist";

const STORAGE_KEY = "rpms:lease-view-mode";
const DEFAULT_VIEW: LeaseViewMode = "list";

interface ViewState {
  mode: LeaseViewMode;
  setMode: (value: LeaseViewMode) => void;
}

function savedView(): LeaseViewMode {
  const saved = getLocalStorageValue(STORAGE_KEY);
  return saved === "card" || saved === "checklist" ? saved : DEFAULT_VIEW;
}

export const useLeaseViewStore = create<ViewState>((set) => ({
  mode: savedView(),
  setMode: (mode) => {
    set({ mode });
    setLocalStorageValue(STORAGE_KEY, mode);
  },
}));

const getSnapshot = () => useLeaseViewStore.getState().mode;
const getServerSnapshot = () => DEFAULT_VIEW;

export function useLeaseViewMode(): LeaseViewMode {
  return useSyncExternalStore(useLeaseViewStore.subscribe, getSnapshot, getServerSnapshot);
}
