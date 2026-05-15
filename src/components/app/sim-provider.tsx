"use client";

import { useEffect } from "react";

import { toast } from "sonner";

import { useDemoStore } from "@/lib/demo/store";
// Heartbeat disabled — leaving these imports out keeps the lint clean.
// import { SIM_TICK_MS, tickOnce } from "@/lib/demo/sim";
import { useDemoHydrated } from "@/lib/demo/use-store";
import type { WorkflowKind } from "@/lib/demo/types";
import { WORKFLOW_LABEL } from "@/lib/demo/types";

/**
 * Mounts the demo's heartbeat. Every ~14s it generates a new activity / approval /
 * autonomy event so the UI feels alive. Pauses when `simEnabled = false` (set
 * during the onboarding tour so it doesn't steal attention).
 */
export function SimProvider({ children }: { children: React.ReactNode }) {
  const hydrated = useDemoHydrated();
  const simEnabled = useDemoStore((s) => s.simEnabled);

  // App simplified — demo heartbeat disabled. Re-enable by uncommenting
  // the body below. The activity / approval / autonomy generators remain
  // in src/lib/demo/sim.ts and can be wired back if/when the workflow
  // narrative comes back.
  useEffect(() => {
    void hydrated;
    void simEnabled;
    /*
    if (!hydrated || !simEnabled) return;
    let cancelled = false;
    const fire = () => {
      if (cancelled) return;
      const state = useDemoStore.getState();
      tickOnce({
        pushActivity: (a) => {
          const created = state.pushActivity(a);
          if (a.severity === "warning" || a.severity === "error") {
            toast.warning(a.title, { description: a.body });
          }
          return created;
        },
        requestApproval: (req) => {
          const created = state.requestApproval(req);
          toast.warning("Decision requested", {
            description: req.title,
            duration: 6000,
          });
          return created;
        },
        pendingApprovalsCount: state.approvals.filter((a) => !a.decision).length,
        bumpAutoExec: (workflow: WorkflowKind) => {
          const cur = state.autonomy[workflow];
          if (!cur) return;
          useDemoStore.setState({
            autonomy: {
              ...state.autonomy,
              [workflow]: {
                ...cur,
                autoExecutions: cur.autoExecutions + 1,
                confidencePct: Math.min(100, cur.confidencePct + 1),
                lastDecisionTs: Date.now(),
              },
            },
          });
        },
      });
      state.markTickAt(Date.now());
    };

    const initial = setTimeout(fire, 6000);
    const interval = setInterval(fire, SIM_TICK_MS);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
    */
  }, [hydrated, simEnabled]);

  // Surface autonomy promotions via toast — listen at the store level.
  useEffect(() => {
    let prev = useDemoStore.getState().autonomy;
    const unsub = useDemoStore.subscribe((state) => {
      const cur = state.autonomy;
      for (const k of Object.keys(cur) as WorkflowKind[]) {
        if (prev[k] && prev[k].level !== cur[k].level) {
          toast.success(`Promoted · ${WORKFLOW_LABEL[k]}`, {
            description: `Now running at "${cur[k].level}". Confidence ${cur[k].confidencePct}%.`,
            duration: 8000,
          });
        }
      }
      prev = cur;
    });
    return unsub;
  }, []);

  return <>{children}</>;
}
