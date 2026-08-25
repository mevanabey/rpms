"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

interface SortableHeaderProps {
  label: string;
  active: boolean;
  direction: SortDir;
  onToggle: () => void;
  align?: "left" | "right";
  className?: string;
}

/**
 * Sortable column header for hand-rolled tables (those not built on TanStack).
 * Sister to `DataTableColumnHeader` but decoupled from `@tanstack/react-table`.
 *
 * Cycle: idle → asc → desc → idle. Caller owns the sort state.
 */
export function SortableHeader({
  label,
  active,
  direction,
  onToggle,
  align = "left",
  className,
}: SortableHeaderProps) {
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onToggle}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "h-7 px-2 font-medium text-xs",
        align === "left" ? "-ml-2" : "-mr-2",
        className,
      )}
    >
      <span>{label}</span>
      <Icon
        className={cn("size-3", active ? "text-foreground" : "text-muted-foreground/60")}
      />
    </Button>
  );
}
