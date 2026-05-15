"use client";

import { useEffect, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Pause, Play, SkipForward, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFlowRunner } from "@/lib/flows/runner";

const SPOTLIGHT_PADDING = 8;
const SPOTLIGHT_RADIUS = 12;
const POPOVER_OFFSET = 12;
const POPOVER_WIDTH = 380;

/**
 * Renders the dimmed-overlay spotlight and the active step's popover.
 * Mounted once at the root of the app so the runner can reach into any
 * page's DOM.
 */
export function FlowOverlay() {
  const { activePopover, status, current, stepIndex, totalSteps, next, skip, cancel } =
    useFlowRunner();

  // Re-measure on resize / scroll so spotlight tracks moving content.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!activePopover) return;
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [activePopover]);

  if (status !== "running" && status !== "paused") return null;
  if (!activePopover) return null;

  const r = activePopover.rect;
  const hasRect = !!r;

  return (
    <div className="pointer-events-none fixed inset-0 z-[140]" data-tick={tick}>
      {/* Dim overlay with a hole cut out via box-shadow. */}
      {hasRect && (
        <motion.div
          key={activePopover.selector}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute"
          style={{
            top: r.top - SPOTLIGHT_PADDING,
            left: r.left - SPOTLIGHT_PADDING,
            width: r.width + SPOTLIGHT_PADDING * 2,
            height: r.height + SPOTLIGHT_PADDING * 2,
            borderRadius: SPOTLIGHT_RADIUS,
            boxShadow:
              "0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 2px rgba(120,120,255,0.6)",
            transition:
              "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
          }}
        />
      )}
      {!hasRect && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/55"
        />
      )}

      <FlowPopover
        rect={r}
        title={activePopover.title}
        body={activePopover.body}
        side={activePopover.side ?? "bottom"}
        pinned={activePopover.pinned}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        flowTitle={current?.title ?? ""}
        onNext={next}
        onSkip={skip}
        onCancel={cancel}
      />
    </div>
  );
}

interface PopoverProps {
  rect: DOMRect | null;
  title: string;
  body: React.ReactNode;
  side: "top" | "bottom" | "left" | "right";
  pinned?: boolean;
  stepIndex: number;
  totalSteps: number;
  flowTitle: string;
  onNext: () => void;
  onSkip: () => void;
  onCancel: () => void;
}

function FlowPopover({
  rect,
  title,
  body,
  side,
  pinned,
  stepIndex,
  totalSteps,
  flowTitle,
  onNext,
  onSkip,
  onCancel,
}: PopoverProps) {
  const margin = 16;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  let top = vh / 2 - 100;
  let left = vw / 2 - POPOVER_WIDTH / 2;
  if (rect) {
    if (side === "bottom") {
      top = rect.bottom + POPOVER_OFFSET;
      left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
    } else if (side === "top") {
      top = rect.top - POPOVER_OFFSET - 200;
      left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
    } else if (side === "right") {
      top = rect.top + rect.height / 2 - 100;
      left = rect.right + POPOVER_OFFSET;
    } else {
      top = rect.top + rect.height / 2 - 100;
      left = rect.left - POPOVER_OFFSET - POPOVER_WIDTH;
    }
  }
  // Clamp into viewport
  left = Math.max(margin, Math.min(left, vw - POPOVER_WIDTH - margin));
  top = Math.max(margin, Math.min(top, vh - 240 - margin));

  const progress = ((stepIndex + 1) / Math.max(1, totalSteps)) * 100;

  return (
    <AnimatePresence>
      <motion.div
        key={title + stepIndex}
        initial={{ opacity: 0, y: 6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.22 }}
        className="pointer-events-auto absolute w-[var(--popover-w)] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
        style={
          {
            top,
            left,
            "--popover-w": `${POPOVER_WIDTH}px`,
          } as React.CSSProperties
        }
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <div className="min-w-0">
            <div className="truncate font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
              {flowTitle}
            </div>
            <div className="truncate font-semibold">{title}</div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="End flow"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-4 py-3 text-sm">{body}</div>
        <div className="border-t">
          <div className="h-1 overflow-hidden bg-muted">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-4 py-2.5">
            <div className="text-muted-foreground text-xs">
              Step {stepIndex + 1} of {totalSteps}
            </div>
            <div className="flex items-center gap-1">
              {!pinned && (
                <Button variant="ghost" size="sm" onClick={onSkip}>
                  Skip
                </Button>
              )}
              <Button size="sm" onClick={onNext}>
                Next <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function FlowProgressWidget() {
  const { status, current, stepIndex, totalSteps, pause, resume, cancel } = useFlowRunner();
  if (status !== "running" && status !== "paused") return null;
  if (!current) return null;
  const isPaused = status === "paused";
  const progress = ((stepIndex + 1) / Math.max(1, totalSteps)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="fixed bottom-4 left-1/2 z-[150] -translate-x-1/2 rounded-full border bg-popover/95 backdrop-blur px-3 py-2 shadow-2xl flex items-center gap-3 max-w-[calc(100vw-2rem)]"
    >
      <span className="inline-flex items-center gap-1.5 font-medium text-xs">
        <span className="text-base">{current.emoji}</span>
        <span className="truncate max-w-[180px] sm:max-w-none">{current.title}</span>
      </span>
      <span className="text-muted-foreground text-[11px] tabular-nums">
        {stepIndex + 1}/{totalSteps}
      </span>
      <div className="hidden sm:block h-1 w-32 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="ml-1 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={isPaused ? "Resume flow" : "Pause flow"}
          onClick={() => (isPaused ? resume() : pause())}
        >
          {isPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="End flow"
          onClick={cancel}
        >
          <SkipForward className="size-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}
