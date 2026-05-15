"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { toast } from "sonner";

import { useDemoStore } from "@/lib/demo/store";

import {
  clickElement,
  delay,
  rectOf,
  selectOption,
  simulatedType,
  waitForSelector,
} from "./dom";
import type {
  FlowDef,
  FlowStatus,
  FlowStep,
  PopoverStep,
} from "./types";

interface FlowRunnerContext {
  status: FlowStatus;
  current: FlowDef | null;
  stepIndex: number;
  totalSteps: number;
  /** When a popover step is active, this holds the selector + content for rendering. */
  activePopover:
    | (PopoverStep & { rect: DOMRect | null })
    | null;
  start: (flow: FlowDef) => void;
  next: () => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  /** Skip the current popover step (only allowed on non-pinned popovers). */
  skip: () => void;
}

const Ctx = createContext<FlowRunnerContext | null>(null);

export function useFlowRunner(): FlowRunnerContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFlowRunner must be used inside FlowRunnerProvider");
  return ctx;
}

export function FlowRunnerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const setSimEnabled = useDemoStore((s) => s.setSimEnabled);

  const [current, setCurrent] = useState<FlowDef | null>(null);
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [activePopover, setActivePopover] = useState<
    (PopoverStep & { rect: DOMRect | null }) | null
  >(null);

  // Track whether the runner has been cancelled mid-await so async loops bail.
  const cancelledRef = useRef(false);
  const pausedRef = useRef(false);
  const popoverWaiterRef = useRef<(() => void) | null>(null);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    pausedRef.current = false;
    popoverWaiterRef.current = null;
    setActivePopover(null);
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    pausedRef.current = false;
    setStatus("cancelled");
    setActivePopover(null);
    setSimEnabled(true);
    if (popoverWaiterRef.current) {
      popoverWaiterRef.current();
      popoverWaiterRef.current = null;
    }
    toast("Flow cancelled");
  }, [setSimEnabled]);

  const next = useCallback(() => {
    if (popoverWaiterRef.current) {
      const w = popoverWaiterRef.current;
      popoverWaiterRef.current = null;
      w();
    }
  }, []);

  const skip = useCallback(() => {
    if (popoverWaiterRef.current) {
      const w = popoverWaiterRef.current;
      popoverWaiterRef.current = null;
      w();
    }
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setStatus("running");
  }, []);

  // Wait while paused, bail if cancelled.
  const waitWhilePaused = useCallback(async () => {
    while (pausedRef.current && !cancelledRef.current) {
      await delay(150);
    }
  }, []);

  const runStep = useCallback(
    async (step: FlowStep): Promise<void> => {
      if (cancelledRef.current) return;
      await waitWhilePaused();
      switch (step.kind) {
        case "navigate": {
          if (step.to !== window.location.pathname) {
            router.push(step.to);
          }
          await delay(step.settleMs ?? 800);
          return;
        }
        case "wait": {
          await delay(step.ms);
          return;
        }
        case "store": {
          step.apply(useDemoStore);
          if (step.caption) toast(step.caption);
          await delay(250);
          return;
        }
        case "toast": {
          if (step.tone === "success") toast.success(step.message, { description: step.description });
          else if (step.tone === "warning") toast.warning(step.message, { description: step.description });
          else toast(step.message, { description: step.description });
          await delay(700);
          return;
        }
        case "click": {
          if (step.preDelayMs) await delay(step.preDelayMs);
          const el = await waitForSelector(step.selector);
          if (!el) {
            console.warn("[flow] click target not found:", step.selector);
            return;
          }
          clickElement(el);
          await delay(step.postDelayMs ?? 350);
          return;
        }
        case "fill": {
          const el = (await waitForSelector(step.selector)) as
            | HTMLInputElement
            | HTMLTextAreaElement
            | null;
          if (!el) {
            console.warn("[flow] fill target not found:", step.selector);
            return;
          }
          await simulatedType(el, step.value, step.typingMs);
          await delay(120);
          return;
        }
        case "select": {
          await selectOption(step.triggerSelector, step.value);
          await delay(step.postDelayMs ?? 350);
          return;
        }
        case "popover": {
          // Find target, anchor a popover, wait until user clicks Next.
          const el = await waitForSelector(step.selector);
          const rect = rectOf(el);
          setActivePopover({ ...step, rect });
          await new Promise<void>((resolve) => {
            popoverWaiterRef.current = resolve;
            if (step.autoAdvanceMs) {
              const t = setTimeout(() => {
                if (popoverWaiterRef.current === resolve) {
                  popoverWaiterRef.current = null;
                  resolve();
                }
              }, step.autoAdvanceMs);
              // If the user manually advances, the timeout still fires and
              // resolves a no-op since we cleared the ref.
              void t;
            }
          });
          setActivePopover(null);
          return;
        }
        default:
          return;
      }
    },
    [router, waitWhilePaused],
  );

  // Listen for popover targets being scrolled / re-laid-out and update rect.
  useEffect(() => {
    if (!activePopover) return;
    let frame = 0;
    const sync = () => {
      const el = document.querySelector(activePopover.selector);
      const rect = rectOf(el);
      if (rect && rect.toString() !== activePopover.rect?.toString()) {
        setActivePopover({ ...activePopover, rect });
      }
      frame = requestAnimationFrame(sync);
    };
    frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  }, [activePopover]);

  // Cancel the flow if the user navigates manually to a route the flow
  // didn't drive them to (heuristic — best effort).
  useEffect(() => {
    // We'll leave this as a no-op for now. Manual nav cancel is not strictly
    // necessary; the user can hit the cancel button on the progress widget.
  }, [pathname]);

  const start = useCallback(
    async (flow: FlowDef) => {
      reset();
      setCurrent(flow);
      setStepIndex(0);
      setStatus("running");
      setSimEnabled(false);
      // Brief breath before kicking off.
      await delay(200);
      try {
        for (let i = 0; i < flow.steps.length; i++) {
          if (cancelledRef.current) break;
          setStepIndex(i);
          await runStep(flow.steps[i]);
        }
        if (!cancelledRef.current) {
          setStatus("completed");
          toast.success(`Flow complete · ${flow.title}`, {
            description: "Demo state has been updated.",
          });
        }
      } finally {
        setActivePopover(null);
        setSimEnabled(true);
      }
    },
    [reset, runStep, setSimEnabled],
  );

  const value = useMemo<FlowRunnerContext>(
    () => ({
      status,
      current,
      stepIndex,
      totalSteps: current?.steps.length ?? 0,
      activePopover,
      start,
      next,
      cancel,
      pause,
      resume,
      skip,
    }),
    [status, current, stepIndex, activePopover, start, next, cancel, pause, resume, skip],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
