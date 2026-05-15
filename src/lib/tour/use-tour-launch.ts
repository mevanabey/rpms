"use client";

import { useOnborda } from "onborda";

import { useDemoStore } from "@/lib/demo/store";

/**
 * Tiny hook that starts the guided tour and pauses the sim engine while
 * it's running. The actual tour steps live in `src/lib/tour/steps.tsx`.
 */
export function useTourLaunch() {
  const { startOnborda } = useOnborda();
  const setSimEnabled = useDemoStore((s) => s.setSimEnabled);
  const markTourCompleted = useDemoStore((s) => s.markTourCompleted);

  return (tourName: string = "rpms-main") => {
    setSimEnabled(false);
    startOnborda(tourName);
    // The sim resumes when the user closes the tour.
    if (typeof window !== "undefined") {
      const resume = () => {
        setSimEnabled(true);
        markTourCompleted();
      };
      // Heuristic: re-enable after the tour duration elapses or on Escape.
      // Onborda emits no global event for "completed", so we listen for Esc
      // and provide a manual "done" callback wired in OnbordaProvider config.
      window.addEventListener("keydown", function listener(e) {
        if (e.key === "Escape") {
          resume();
          window.removeEventListener("keydown", listener);
        }
      });
    }
  };
}
