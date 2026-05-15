"use client";

import { useRoleDef } from "@/lib/demo/use-store";
import { type Role } from "@/lib/demo/identity";
import { cn } from "@/lib/utils";

interface Props {
  role: Role;
  /** Suppress the icon-equivalent border styling — used inside dense rows. */
  size?: "sm" | "md";
  className?: string;
  /** Include the role's tooltip describing its purpose. */
  withTooltip?: boolean;
  /** Override label (rarely needed; use the role's own label by default). */
  labelOverride?: string;
}

/**
 * Displays a role chip using live label + tone from the demo store. Use this
 * everywhere a role is rendered so admin's edits propagate immediately.
 */
export function RolePill({ role, size = "md", className, withTooltip, labelOverride }: Props) {
  const def = useRoleDef(role);
  const label = labelOverride ?? def?.label ?? role;
  const tone =
    def?.tone ??
    "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800";
  return (
    <span
      title={withTooltip ? def?.description : undefined}
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}
