"use client";

import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

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
import { Skeleton } from "@/components/ui/skeleton";
import type { Party, Property, Unit } from "@/core/types";
import { partyMap } from "@/lib/lookup";
import type { DraftProperty } from "@/lib/demo/types";
import { useLeaseDocSettings } from "@/lib/demo/use-store";
import { LeaseDocument } from "@/templates/leases/lease-document";
import {
  fromDraftIntent,
  type LeaseDocumentData,
} from "@/templates/leases/lease-document-data";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  { ssr: false, loading: () => <Skeleton className="h-[640px] w-full" /> },
);
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFDownloadLink),
  { ssr: false },
);

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

  const fileName = `${data.agreementTitle.replace(/\s+/g, "-").toLowerCase()}-${draftId}.pdf`;

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
          {open && (
            <PDFViewer
              showToolbar={false}
              style={{ width: "100%", height: 640, border: 0 }}
            >
              <LeaseDocument data={data} settings={settings} />
            </PDFViewer>
          )}
        </div>
        <DialogFooter>
          <PDFDownloadLink document={<LeaseDocument data={data} settings={settings} />} fileName={fileName}>
            {({ loading }) => (
              <Button size="sm" variant="outline" disabled={loading}>
                <Download className="size-3.5" />
                {loading ? "Preparing…" : "Download draft"}
              </Button>
            )}
          </PDFDownloadLink>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
