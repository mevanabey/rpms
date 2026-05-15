"use client";

import Link from "next/link";

import { AnimatePresence, motion } from "framer-motion";
import { ShieldQuestion } from "lucide-react";

import { LiveDot } from "@/components/ui/live-dot";
import { usePendingApprovals } from "@/lib/demo/use-store";
import { cn } from "@/lib/utils";

/**
 * Shows pending-decision count in the header. Pulses when there's something
 * waiting. Click → /tasks. Auto-hides when count is 0.
 */
export function ApprovalsPill() {
  const pending = usePendingApprovals();
  const count = pending.length;

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key={count}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <Link
            href="/tasks"
            data-onborda="approvals-pill"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-900 text-xs transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-950",
            )}
          >
            <LiveDot tone="warning" size="xs" />
            <ShieldQuestion className="size-3.5" />
            <span className="hidden sm:inline">{count} awaiting decision</span>
            <span className="sm:hidden">{count}</span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
