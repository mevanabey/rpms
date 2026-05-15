import { Bot, ShieldCheck, UserCheck, UserCog } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  AUTONOMY_DESCRIPTION,
  AUTONOMY_LABEL,
  AUTONOMY_THRESHOLD,
  type AutonomyLevel,
} from "@/lib/demo/types";

const LEVEL_ICON: Record<AutonomyLevel, React.ComponentType<{ className?: string }>> = {
  manual: UserCog,
  "human-gated": UserCheck,
  "auto-with-review": ShieldCheck,
  auto: Bot,
};

const LEVEL_TONE: Record<AutonomyLevel, string> = {
  manual: "text-zinc-700 bg-zinc-100 border-zinc-200 dark:text-zinc-300 dark:bg-zinc-900 dark:border-zinc-800",
  "human-gated": "text-amber-800 bg-amber-100 border-amber-200 dark:text-amber-200 dark:bg-amber-950/60 dark:border-amber-900",
  "auto-with-review": "text-blue-800 bg-blue-100 border-blue-200 dark:text-blue-200 dark:bg-blue-950/60 dark:border-blue-900",
  auto: "text-emerald-800 bg-emerald-100 border-emerald-200 dark:text-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-900",
};

const BAR_TONE: Record<AutonomyLevel, string> = {
  manual: "bg-zinc-400",
  "human-gated": "bg-amber-500",
  "auto-with-review": "bg-blue-500",
  auto: "bg-emerald-500",
};

interface Props {
  level: AutonomyLevel;
  confidencePct: number;
  /** Show full description + threshold helper text. */
  expanded?: boolean;
  className?: string;
}

/**
 * Visualises a workflow's autonomy level + how close it is to the next
 * promotion threshold. The "decision matrix" is just a list of these.
 */
export function AutonomyMeter({ level, confidencePct, expanded, className }: Props) {
  const Icon = LEVEL_ICON[level];
  const threshold = AUTONOMY_THRESHOLD[level];
  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="autonomy-meter">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium text-xs",
            LEVEL_TONE[level],
          )}
        >
          <Icon className="size-3.5" />
          {AUTONOMY_LABEL[level]}
        </span>
        <span className="ml-auto font-mono text-muted-foreground text-xs tabular-nums">
          {confidencePct}%
        </span>
      </div>

      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={confidencePct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${AUTONOMY_LABEL[level]} confidence ${confidencePct}%`}
      >
        <div
          className={cn("h-full transition-all duration-500 ease-out", BAR_TONE[level])}
          style={{ width: `${Math.min(100, Math.max(0, confidencePct))}%` }}
        />
        {threshold < 100 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/30"
            style={{ left: `${threshold}%` }}
            aria-hidden
            title={`Promotion at ${threshold}%`}
          />
        )}
      </div>

      {expanded && (
        <p className="text-muted-foreground text-xs">
          {AUTONOMY_DESCRIPTION[level]}
          {threshold < 100 && (
            <>
              {" "}Next promotion at <span className="font-mono">{threshold}%</span>.
            </>
          )}
        </p>
      )}
    </div>
  );
}
