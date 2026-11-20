"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, FileCheck2, FileSpreadsheet } from "lucide-react";
import type { Lease } from "@/core/types";
import { checklistSignoff } from "@/lib/checklist/review-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLeaseViewStore } from "./use-lease-view";
import { useLeaseEditing } from "./use-lease-edit";

const ApprovalDialog = dynamic(() => import("./checklist-approval-dialog"));

export function ChecklistReviewPanel({ lease, canEdit, canRecordPayments }: { lease: Lease; canEdit: boolean; canRecordPayments: boolean }) {
  const [open, setOpen] = useState(false);
  const editing = useLeaseEditing(lease.id);
  const signoff = checklistSignoff(lease);
  if (signoff) return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4" />Checklist approved and signed off</CardTitle>
      <CardDescription>{signoff.approvedByName} · {new Date(signoff.approvedAt).toLocaleDateString()} · {signoff.recordedPayments} historical rent payments recorded at approval</CardDescription>
    </CardHeader>
    {signoff.notes && <CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{signoff.notes}</p></CardContent>}
  </Card>;
  return <>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="size-4" />Checklist review required</CardTitle>
        <CardDescription>Review the original checklist and mapped lease details, then sign off the import. Upload the executed agreement and record rent already collected to activate this lease.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Checklist imports use this review instead of the new-lease progress steps. Each linked lease is approved separately.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={editing} onClick={() => useLeaseViewStore.getState().setMode("checklist")}><FileSpreadsheet className="size-4" />Review checklist</Button>
          {canEdit && <Button disabled={editing} onClick={() => setOpen(true)}>Approve &amp; activate</Button>}
        </div>
        {editing && <p className="text-xs text-muted-foreground">Finish editing before reviewing and approving.</p>}
        {!canEdit && <p className="text-xs text-muted-foreground">A staff member with lease editing access must complete the sign-off.</p>}
      </CardContent>
    </Card>
    {open && <ApprovalDialog leaseId={lease.id} canRecordPayments={canRecordPayments} onClose={() => setOpen(false)} />}
  </>;
}
