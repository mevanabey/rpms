"use client";

import { useState } from "react";

import { Download, ExternalLink, FileSignature, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Props {
  leaseId: string;
  /** Pretty title shown in the dialog header. */
  title?: string;
  /** Defaults to the Lucky Seven PDF — every lease in the demo points at the
   *  same signed indenture. Phase 02 stores per-lease URLs in `Document`. */
  pdfUrl?: string;
  /** Lease status — disables the modal cleanly if there's no signed PDF yet. */
  hasSignedPdf?: boolean;
  /** Optional override for the trigger button's label. */
  triggerLabel?: string;
}

const DEFAULT_PDF = "/docs/lucky-seven-signed-lease.pdf";

export function SignedLeaseDialog({
  leaseId,
  title = "Signed lease",
  pdfUrl = DEFAULT_PDF,
  hasSignedPdf = true,
  triggerLabel = "View signed lease",
}: Props) {
  const [open, setOpen] = useState(false);

  // If there's no signed PDF yet, render a disabled trigger that explains.
  if (!hasSignedPdf) {
    return (
      <Button variant="outline" size="sm" disabled>
        <FileText className="size-4" /> Not yet signed
      </Button>
    );
  }

  const filename = `${leaseId}-signed-lease.pdf`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="size-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] w-screen flex-col gap-0 overflow-hidden rounded-none border-0 p-0 !max-w-none !max-h-none sm:h-[96vh] sm:w-[98vw] sm:!max-w-[1600px] sm:rounded-lg sm:border"
      >
        <DialogHeader className="flex flex-col gap-2 border-b px-4 py-3 space-y-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2 text-base leading-tight">
                <FileSignature className="size-4 shrink-0" />
                <span className="min-w-0 break-words">{title}</span>
              </DialogTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {leaseId}
                </Badge>
              </div>
              <DialogDescription className="mt-1.5 text-xs">
                Notarised lease indenture · canonical legal instrument.
              </DialogDescription>
            </div>
            {/* Mobile-only close, sits next to title block. */}
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                className="shrink-0 sm:hidden"
              >
                <X className="size-4" />
              </Button>
            </DialogClose>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 self-stretch sm:self-start">
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
              <a href={pdfUrl} download={filename}>
                <Download className="size-3.5" />
                Download
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                <span className="sm:inline">Open in new tab</span>
              </a>
            </Button>
            {/* Desktop-only close — sits at the end of the action group. */}
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                className="hidden shrink-0 sm:inline-flex"
              >
                <X className="size-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-muted/20">
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=0&statusbar=0&view=FitH`}
            title={`${title} — ${leaseId}`}
            className="h-full w-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
