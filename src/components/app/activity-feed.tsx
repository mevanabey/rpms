"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react";

import { LiveDot } from "@/components/ui/live-dot";
import { cn } from "@/lib/utils";
import type { Activity, Severity, WorkflowKind } from "@/lib/demo/types";
import { WORKFLOW_LABEL } from "@/lib/demo/types";

const SEVERITY_ICON: Record<Severity, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const SEVERITY_TONE: Record<Severity, string> = {
  info: "text-violet-600 dark:text-violet-300",
  success: "text-emerald-600 dark:text-emerald-300",
  warning: "text-amber-600 dark:text-amber-300",
  error: "text-rose-600 dark:text-rose-300",
};

function timeAgo(ts: number, now: number): string {
  if (now === 0) return ""; // pre-mount placeholder for SSR safety
  const sec = Math.max(0, Math.floor((now - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

interface Props {
  activities: Activity[];
  limit?: number;
  /** Render with dense styling for sidebar/dropdowns. */
  compact?: boolean;
  className?: string;
}

export function ActivityFeed({ activities, limit, compact, className }: Props) {
  // Initialize at 0 (server) and only switch to real time after mount; this
  // keeps timeAgo() identical between SSR and CSR until hydration completes.
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const items = limit ? activities.slice(0, limit) : activities;
  if (items.length === 0) {
    return (
      <div className={cn("rounded-md border border-dashed py-8 text-center text-muted-foreground text-sm", className)}>
        No activity yet. The system is idle.
      </div>
    );
  }

  return (
    <ul className={cn("flex flex-col", compact ? "" : "gap-1", className)}>
      <AnimatePresence initial={false}>
        {items.map((a, i) => {
          const Icon = SEVERITY_ICON[a.severity];
          const isFresh = now !== 0 && now - a.ts < 30_000;
          const workflowLabel =
            a.workflow === "system" || a.workflow === "human"
              ? a.workflow
              : WORKFLOW_LABEL[a.workflow as WorkflowKind] ?? a.workflow;
          return (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "flex items-start gap-3 border-b border-border/60 py-2.5 last:border-b-0",
                compact ? "px-3" : "px-1",
                i === 0 && isFresh && "bg-emerald-50/40 dark:bg-emerald-950/20",
              )}
              data-slot="activity-item"
            >
              <div className="mt-0.5 shrink-0">
                {isFresh ? (
                  <LiveDot tone="live" size="sm" />
                ) : (
                  <Icon className={cn("size-3.5", SEVERITY_TONE[a.severity])} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/activity/${a.id}`}
                    className={cn(
                      "truncate font-medium hover:underline",
                      compact ? "text-xs" : "text-sm",
                    )}
                  >
                    {a.title}
                  </Link>
                  <span className="shrink-0 text-muted-foreground text-[10px] tabular-nums">
                    {timeAgo(a.ts, now)}
                  </span>
                </div>
                {a.body && !compact && (
                  <p className="mt-0.5 truncate text-muted-foreground text-xs">{a.body}</p>
                )}
                <div className="mt-1 flex items-center gap-2">
                  {a.workflow !== "system" && a.workflow !== "human" ? (
                    <Link
                      href={`/automation/${a.workflow}`}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground text-[10px] hover:bg-muted/60 hover:text-foreground"
                    >
                      <Bot className="size-2.5" />
                      {workflowLabel}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground text-[10px]">
                      <Bot className="size-2.5" />
                      {workflowLabel}
                    </span>
                  )}
                  {a.leaseId && (
                    <Link
                      href={`/leases/${a.leaseId}`}
                      className="inline-flex items-center gap-0.5 font-mono text-muted-foreground text-[10px] hover:text-foreground hover:underline"
                    >
                      {a.leaseId.replace(/^lease_/, "")}
                      <ArrowRight className="size-2.5" />
                    </Link>
                  )}
                </div>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
