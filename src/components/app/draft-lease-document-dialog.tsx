"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";

import { Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LeaseDocumentPreview } from "@/components/app/lease-document-preview";
import type { Party, Property, Unit } from "@/core/types";
import { partyMap } from "@/lib/lookup";
import type { DraftProperty } from "@/lib/demo/types";
import { useLeaseDocSettings } from "@/lib/demo/use-store";
import {
  fromDraftIntent,
  type LeaseDocumentData,
} from "@/templates/leases/lease-document-data";
import { downloadLeaseAgreement } from "@/templates/leases/lease-template-render";

export function DraftLeaseDocumentDialog({
  draftId,
  intent,
  property,
  draftProperty,
  units,
  parties,
  trigger,
}: {
  draftId: string;
  intent: Record<string, unknown>;
  property?: Property;
  draftProperty?: DraftProperty;
  units: Unit[];
  parties: Party[];
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [downloading, startDownload] = useTransition();
  const settings = useLeaseDocSettings();

  const data: LeaseDocumentData = useMemo(() => {
    const propertyLike: Property | undefined = property
      ? property
      : draftProperty
        ? {
            id: draftProperty.id,
            name: draftProperty.name,
            addressLine: draftProperty.addressLine,
            city: draftProperty.city,
            lotNo: draftProperty.lotNo,
            planNo: draftProperty.planNo,
            perches: draftProperty.perches,
            asstNo: draftProperty.asstNo,
          }
        : undefined;
    return fromDraftIntent(draftId, intent, propertyLike, units, partyMap(parties));
  }, [draftId, intent, property, draftProperty, units, parties]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <FileText className="size-3.5" /> Preview draft document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{data.agreementTitle}</DialogTitle>
          <DialogDescription>
            Draft auto-filled from the wizard. Send for signature once KYC clears.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-md border">
          {open && <LeaseDocumentPreview data={data} settings={settings} className="h-[640px]" />}
        </div>
        <DialogFooter>
          <Button
            size="sm"
            variant="outline"
            onClick={() => startDownload(async () => { await downloadLeaseAgreement(data, settings); })}
            disabled={downloading}
          >
            <Download className="size-3.5" />
            {downloading ? "Preparing…" : "Download draft (.docx)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
