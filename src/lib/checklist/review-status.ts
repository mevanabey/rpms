import type { Lease } from "@/core/types";

export interface ChecklistSignoff {
  status: "approved";
  approvedAt: string;
  approvedById: string;
  approvedByName: string;
  notes: string;
  recordedPayments: number;
}

export function isChecklistImport(lease: Pick<Lease, "importMeta">): boolean {
  return lease.importMeta?.source === "checklist-upload";
}

export function checklistSignoff(lease: Pick<Lease, "importMeta">): ChecklistSignoff | undefined {
  const value = lease.importMeta?.review as ChecklistSignoff | undefined;
  return value?.status === "approved" && value.approvedAt && value.approvedById ? value : undefined;
}

export function needsChecklistReview(lease: Pick<Lease, "importMeta">): boolean {
  return isChecklistImport(lease) && !checklistSignoff(lease);
}

export function assertChecklistReviewed(lease: Pick<Lease, "importMeta">): void {
  if (needsChecklistReview(lease)) throw new Error("Review and sign off this checklist through Approve & activate first.");
}
