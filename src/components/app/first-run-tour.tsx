"use client";

import { useEffect, useRef } from "react";

import { useOnborda } from "onborda";

import { useDemoStore } from "@/lib/demo/store";

/**
 * Auto-launches the guided tour the first time the user lands on the app.
 * Persists completion via the demo store so we don't pester on every visit.
 */
export function FirstRunTour() {
  const { startOnborda } = useOnborda();
  const hydrated = useDemoStore((s) => s.hydrated);
  const tourCompletedAt = useDemoStore((s) => s.tourCompletedAt);
  const launchedRef = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    if (tourCompletedAt) return;
    if (launchedRef.current) return;
    launchedRef.current = true;
    const id = setTimeout(() => {
      useDemoStore.getState().setSimEnabled(false);
      startOnborda("rpms-main");
    }, 1500);
    return () => clearTimeout(id);
    // startOnborda intentionally omitted: stable enough in practice and would
    // re-trigger on every Onborda state change otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, tourCompletedAt]);

  return null;
}
