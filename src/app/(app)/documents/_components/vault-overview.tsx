"use client";

import { useMemo } from "react";

import { useShallow } from "zustand/react/shallow";

import { FileText, Files } from "lucide-react";

import { AttachmentList } from "@/components/app/attachment-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDemoStore } from "@/lib/demo/store";
import {
  DOCUMENT_KIND_LABEL,
  type ApprovalAttachment,
  type DocumentKind,
} from "@/lib/demo/types";

const VAULT_KINDS: DocumentKind[] = [
  "lease_signed",
  "lease_draft",
  "kyc_id",
  "stamp_duty_receipt",
  "vat_invoice",
  "receipt",
];

export function VaultOverview() {
  const approvals = useDemoStore(useShallow((s) => s.approvals));

  const allDocs = useMemo<ApprovalAttachment[]>(() => {
    const seen = new Set<string>();
    const out: ApprovalAttachment[] = [];
    for (const a of approvals) {
      for (const d of a.attachments ?? []) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        out.push(d);
      }
    }
    return out.sort((x, y) => (y.uploadedAt ?? 0) - (x.uploadedAt ?? 0));
  }, [approvals]);

  const countsByKind = useMemo(() => {
    const counts: Partial<Record<DocumentKind, number>> = {};
    for (const d of allDocs) {
      counts[d.kind] = (counts[d.kind] ?? 0) + 1;
    }
    return counts;
  }, [allDocs]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {VAULT_KINDS.map((kind) => (
          <Card key={kind}>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <FileText className="size-3.5" />
                {DOCUMENT_KIND_LABEL[kind]}
              </CardDescription>
              <CardTitle className="text-xl tabular-nums">{countsByKind[kind] ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {allDocs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
          <Files className="size-10 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Vault empty</CardTitle>
            <CardDescription className="mt-1 max-w-md">
              Phase 02 wires Vercel Blob (SHA-256 dedupe), DropboxSign envelopes, and per-lease
              version timelines.
            </CardDescription>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent uploads</CardTitle>
            <CardDescription>
              Files attached during decisions, KYC submissions, and lease generation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AttachmentList attachments={allDocs} variant="stacked" />
          </CardContent>
        </Card>
      )}
    </>
  );
}
