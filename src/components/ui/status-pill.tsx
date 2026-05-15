import { AlertTriangle, CheckCircle2, CircleDot, Info, Pause, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type StatusTone =
  | "active"
  | "pending"
  | "warning"
  | "danger"
  | "info"
  | "muted"
  | "draft";

const TONES: Record<
  StatusTone,
  { icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  active: {
    icon: CheckCircle2,
    cls:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  },
  pending: {
    icon: CircleDot,
    cls:
      "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200",
  },
  warning: {
    icon: AlertTriangle,
    cls:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  },
  danger: {
    icon: XCircle,
    cls:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200",
  },
  info: {
    icon: Info,
    cls:
      "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-200",
  },
  muted: {
    icon: Pause,
    cls:
      "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300",
  },
  draft: {
    icon: CircleDot,
    cls:
      "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
  },
};

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  label: string;
  /** Hide the icon — useful inside dense tables. */
  iconless?: boolean;
}

/**
 * Semantic colored pill with built-in icon. Single source for status
 * formatting across the app — replaces ad-hoc Badge variants. Non-technical
 * viewers can read it at a glance because the colour + icon agree.
 */
export function StatusPill({
  tone = "info",
  label,
  iconless,
  className,
  ...props
}: Props) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <span
      data-slot="status-pill"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium text-xs",
        t.cls,
        className,
      )}
      {...props}
    >
      {!iconless && <Icon className="size-3.5" />}
      {label}
    </span>
  );
}
