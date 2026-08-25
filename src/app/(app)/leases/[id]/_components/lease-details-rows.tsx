"use client";

/**
 * Renders the two-column details list of a lease.
 *
 * The rows themselves (labels + already-formatted values, each wrapped in a
 * `<LeaseFieldCell>` where the field is editable) are built server-side and
 * passed in; this client wrapper only decides which rows are visible, since
 * rows for unset optional fields (grace date, lock-in date, occupancy cap)
 * exist purely so edit mode can set them.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { useLeaseEditing } from "./use-lease-edit";

export type LeaseDetailRow = {
  label: string;
  value: ReactNode;
  /** Row is only surfaced while the lease is in edit mode. */
  editOnly?: boolean;
};

export function LeaseDetailsRows({
  leaseId,
  rows,
}: {
  leaseId: string;
  rows: LeaseDetailRow[];
}) {
  const editing = useLeaseEditing(leaseId);
  const visible = rows.filter((r) => !r.editOnly || editing);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(200px,1fr)_2fr]">
      {visible.map((r, i) => (
        <div key={`${r.label}-${i}`} className="contents text-sm">
          <div
            className={cn(
              "border-b px-4 py-2.5 text-muted-foreground text-xs uppercase tracking-wider",
              i === 0 && "sm:border-t",
            )}
          >
            {r.label}
          </div>
          <div className={cn("border-b px-4 py-2.5", i === 0 && "sm:border-t")}>
            {r.value ?? "—"}
          </div>
        </div>
      ))}
    </div>
  );
}
