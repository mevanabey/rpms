"use client";

import { Onborda, OnbordaProvider } from "onborda";

import { TourCard } from "./tour-card";
import { TOURS } from "@/lib/tour/steps";

/**
 * Onborda is kept around for backward compatibility — the legacy guided
 * tour still resolves through it if invoked. New flows go through the
 * `FlowRunner` (see `src/lib/flows/`) so the user can pick which scripted
 * walkthrough to play, and the runner can drive forms / state directly.
 */
export function AppOnbordaProvider({ children }: { children: React.ReactNode }) {
  return (
    <OnbordaProvider>
      <Onborda
        steps={TOURS}
        cardComponent={TourCard}
        shadowRgb="0,0,0"
        shadowOpacity="0.7"
        cardTransition={{ duration: 0.25, ease: "easeOut" }}
      >
        {children}
      </Onborda>
    </OnbordaProvider>
  );
}
