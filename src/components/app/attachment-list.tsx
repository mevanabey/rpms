"use client";

import { Download, ExternalLink, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApprovalAttachment } from "@/lib/demo/types";
import { DOCUMENT_KIND_LABEL } from "@/lib/demo/types";
import { cn, formatDate } from "@/lib/utils";

interface Props {
  attachments: ApprovalAttachment[];
  /** Compact = inline inside another card. Stacked = full rows for vault / detail pages. */
  variant?: "compact" | "stacked";
  /** Optional empty-state message. When omitted, the list is hidden when empty. */
  emptyState?: string;
  className?: string;
}

export function AttachmentList({
  attachments,
  variant = "compact",
  emptyState,
  className,
}: Props) {
  if (attachments.length === 0) {
    if (!emptyState) return null;
    return (
      <div className={cn("rounded-md border border-dashed p-3 text-center text-muted-foreground text-xs", className)}>
        {emptyState}
      </div>
    );
  }

  return (
    <ul
      className={cn(
        "flex flex-col",
        variant === "compact" ? "gap-1.5" : "gap-2",
        className,
      )}
    >
      {attachments.map((doc) => (
        <li
          key={doc.id}
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-md border bg-background px-2.5 py-2",
            variant === "stacked" && "px-3 py-2.5",
          )}
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground">
            <FileText className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-medium text-sm">{doc.name}</span>
              <Badge variant="outline" className="text-[10px]">
                {DOCUMENT_KIND_LABEL[doc.kind]}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground text-[11px]">
              {typeof doc.sizeKb === "number" && (
                <span className="tabular-nums">
                  {doc.sizeKb >= 1000
                    ? `${(doc.sizeKb / 1000).toFixed(1)} MB`
                    : `${doc.sizeKb} KB`}
                </span>
              )}
              {doc.uploadedAt && (
                <span className="tabular-nums">{formatDate(new Date(doc.uploadedAt).toISOString())}</span>
              )}
              {doc.uploadedBy && <span>· {doc.uploadedBy}</span>}
              {doc.note && <span>· {doc.note}</span>}
            </div>
          </div>
          {doc.url && (
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${doc.name}`}>
                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
              <Button asChild variant="ghost" size="icon-sm" aria-label={`Download ${doc.name}`}>
                <a href={doc.url} download={doc.name}>
                  <Download className="size-3.5" />
                </a>
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
