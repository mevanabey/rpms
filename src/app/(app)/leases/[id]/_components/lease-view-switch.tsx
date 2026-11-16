"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";

import { useLeaseEditing } from "./use-lease-edit";
import { useLeaseViewMode } from "./use-lease-view";

const ChecklistView = dynamic(() => import("./lease-checklist-view"), {
  loading: () => <p role="status" className="p-4 text-sm text-muted-foreground">Loading Checklist View…</p>,
});

/**
 * Renders Card, List or Checklist View depending on the saved browser
 * preference (List View is the default).
 * List and Card trees are server-rendered and passed in as ReactNode;
 * the original checklist and its client code load only when selected.
 *
 * Edit mode always resolves to the details list — that's where every field
 * becomes editable.
 */
export function LeaseViewSwitch({
  leaseId,
  cardView,
  listView,
  checklist,
}: {
  leaseId: string;
  cardView: ReactNode;
  listView: ReactNode;
  checklist?: { canEdit: boolean };
}) {
  const mode = useLeaseViewMode();
  const editing = useLeaseEditing(leaseId);
  if (editing || mode === "list") return <>{listView}</>;
  if (mode === "checklist") return checklist ? <ChecklistView key={leaseId} leaseId={leaseId} canEdit={checklist.canEdit} /> : null;
  return <>{cardView}</>;
}
