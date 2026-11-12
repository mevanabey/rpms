"use client";

import type { ReactNode } from "react";

import { useLeaseEditing } from "./use-lease-edit";
import { useLeaseViewMode } from "./use-lease-view";

/**
 * Renders either `cardView` or `listView` depending on the saved browser
 * preference (List View is the default).
 * Both trees are server-rendered ahead of time and passed in as ReactNode;
 * this client wrapper just picks which one to display.
 *
 * Edit mode always resolves to the details list — that's where every field
 * becomes editable.
 */
export function LeaseViewSwitch({
  leaseId,
  cardView,
  listView,
}: {
  leaseId: string;
  cardView: ReactNode;
  listView: ReactNode;
}) {
  const mode = useLeaseViewMode();
  const editing = useLeaseEditing(leaseId);
  return <>{editing || mode === "list" ? listView : cardView}</>;
}
