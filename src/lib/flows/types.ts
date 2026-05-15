/**
 * Demo flow engine — types.
 *
 * Each "flow" is a sequence of steps that drives the UI: navigates between
 * pages, types into fields, clicks buttons, mutates the demo store, and
 * narrates progress with branded popovers. The user clicks the sparkle in
 * the header, picks a flow, sits back, and watches.
 */
import type { ReactNode } from "react";

import type { useDemoStore } from "@/lib/demo/store";

type StoreApi = typeof useDemoStore;

/** Pause and show a popover anchored to a CSS selector. */
export interface PopoverStep {
  kind: "popover";
  selector: string;
  title: string;
  body: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  /** Auto-advance after this many ms (otherwise user clicks "Next"). */
  autoAdvanceMs?: number;
  /** Force advance is the only way out — hide the prev/skip buttons. */
  pinned?: boolean;
}

/** Navigate to a route via the Next router. Waits `settleMs` before next step. */
export interface NavigateStep {
  kind: "navigate";
  to: string;
  settleMs?: number;
}

/** Type a value into an input/textarea, character by character. RHF-safe. */
export interface FillStep {
  kind: "fill";
  selector: string;
  value: string;
  /** ms per character. Default 28. */
  typingMs?: number;
}

/** Programmatic click on an element. */
export interface ClickStep {
  kind: "click";
  selector: string;
  /** Wait this long before clicking (ms). */
  preDelayMs?: number;
  /** Wait this long after clicking before next step. */
  postDelayMs?: number;
}

/** Imperative store mutation. Useful for shortcut state changes. */
export interface StoreStep {
  kind: "store";
  apply: (store: StoreApi) => void;
  caption?: string;
}

/** Just sit and wait, optionally show caption. */
export interface WaitStep {
  kind: "wait";
  ms: number;
  caption?: string;
}

/**
 * Pick a value from a shadcn Select trigger. Clicks the trigger, waits for
 * the popover, clicks the option matching `value` (uses `data-value` attr).
 */
export interface SelectStep {
  kind: "select";
  triggerSelector: string;
  value: string;
  postDelayMs?: number;
}

/** Toggle a checkbox/switch by clicking its trigger. */
export interface ToastStep {
  kind: "toast";
  message: string;
  description?: string;
  tone?: "info" | "success" | "warning";
}

export type FlowStep =
  | PopoverStep
  | NavigateStep
  | FillStep
  | ClickStep
  | StoreStep
  | WaitStep
  | SelectStep
  | ToastStep;

export interface FlowDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
  /** Coarse estimate shown on the picker card. */
  estimatedSeconds: number;
  /** Tags rendered as small chips on the picker card. */
  tags?: string[];
  steps: FlowStep[];
}

export type FlowStatus = "idle" | "running" | "paused" | "completed" | "cancelled";
