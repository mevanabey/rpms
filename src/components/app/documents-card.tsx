"use client";

import { useMemo } from "react";

import { useShallow } from "zustand/react/shallow";

import { AttachmentList } from "@/components/app/attachment-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDemoStore } from "@/lib/demo/store";
import type { ApprovalAttachment, ApprovalRequest } from "@/lib/demo/types";

interface Props {
  /** Filter: approvals tied to this lease. */
  leaseId?: string;
  /** Filter: approvals tied to this party (or any of these lease ids). */
  partyId?: string;
  partyLeaseIds?: string[];
  title?: string;
  description?: string;
  emptyState?: string;
}

/**
 * Renders all documents that have surfaced for a lease or party — by reading
 * approval attachments from the demo store. The same list shows on the lease
 * detail page, the party detail page, and the documents vault, so an upload
 * made during a decision flow is immediately findable wherever the user
 * expects it.
 */
export function DocumentsCard({
  leaseId,
  partyId,
  partyLeaseIds,
  title = "Documents",
  description = "Files attached to decisions and onboarding for this record.",
  emptyState = "No documents attached yet.",
}: Props) {
  const approvals = useDemoStore(useShallow((s) => s.approvals));

  const attachments = useMemo<ApprovalAttachment[]>(() => {
    const seen = new Set<string>();
    const matches: ApprovalAttachment[] = [];
    const matchesApproval = (a: ApprovalRequest) => {
      if (leaseId && a.leaseId === leaseId) return true;
      if (partyId && a.partyId === partyId) return true;
      if (partyLeaseIds && a.leaseId && partyLeaseIds.includes(a.leaseId)) return true;
      return false;
    };
    for (const a of approvals) {
      if (!matchesApproval(a)) continue;
      for (const doc of a.attachments ?? []) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);
        matches.push(doc);
      }
    }
    return matches.sort((x, y) => (y.uploadedAt ?? 0) - (x.uploadedAt ?? 0));
  }, [approvals, leaseId, partyId, partyLeaseIds]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <AttachmentList attachments={attachments} variant="stacked" emptyState={emptyState} />
      </CardContent>
    </Card>
  );
}
