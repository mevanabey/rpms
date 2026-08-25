"use client";

import type { ReactNode } from "react";

import { useLeaseEditing } from "./use-lease-edit";
import { useLeaseViewMode } from "./use-lease-view";

/**
 * Renders either `defaultView` or `detailsView` depending on the per-lease
 * view mode (default = rich layout, details = compact two-column table).
 * Both trees are server-rendered ahead of time and passed in as ReactNode;
 * this client wrapper just picks which one to display.
 *
 * Edit mode always resolves to the details list — that's where every field
 * becomes editable.
 */
export function LeaseViewSwitch({
  leaseId,
  defaultView,
  detailsView,
}: {
  leaseId: string;
  defaultView: ReactNode;
  detailsView: ReactNode;
}) {
  const mode = useLeaseViewMode(leaseId);
  const editing = useLeaseEditing(leaseId);
  return <>{editing || mode === "details" ? detailsView : defaultView}</>;
}
