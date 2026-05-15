"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { Download, FileCheck2, Send } from "lucide-react";
import { toast } from "sonner";

import { SectionHeader } from "@/components/app/section-header";
import { SignaturePad } from "@/components/app/signature-pad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { Lease, Party, Property, Unit } from "@/core/types";
import { partyMap } from "@/lib/lookup";
import { useDemoStore } from "@/lib/demo/store";
import {
  useCurrentUser,
  useLeaseDocSettings,
  useLeaseSignatures,
} from "@/lib/demo/use-store";
import { LeaseDocument } from "@/templates/leases/lease-document";
import { fromLease } from "@/templates/leases/lease-document-data";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  { ssr: false, loading: () => <PdfFallback /> },
);

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFDownloadLink),
  { ssr: false },
);

export function LeaseDocumentSection({
  lease,
  parties,
  property,
  units,
}: {
  lease: Lease;
  parties: Party[];
  property?: Property;
  units: Unit[];
}) {
  const user = useCurrentUser();
  const signatures = useLeaseSignatures(lease.id);
  const settings = useLeaseDocSettings();
  const saveSignature = useDemoStore((s) => s.saveLeaseSignature);
  const clearSignature = useDemoStore((s) => s.clearLeaseSignature);

  const partyById = useMemo(() => partyMap(parties), [parties]);

  const data = useMemo(
    () => fromLease(lease, property, units, partyById, signatures),
    [lease, property, units, partyById, signatures],
  );

  // The set of parties operators can sign as in the demo — lessor, lessee,
  // plus any additional roles defined on the lease (lawyers, etc.).
  const signers = useMemo(() => {
    const out: { id: string; label: string; role: string }[] = [];
    const lessor = partyById.get(lease.lessorPartyId);
    if (lessor) out.push({ id: lessor.id, label: lessor.displayName, role: "lessor" });
    const lessee = partyById.get(lease.lesseePartyId);
    if (lessee) out.push({ id: lessee.id, label: lessee.displayName, role: "lessee" });
    for (const r of lease.additionalRoles ?? []) {
      const p = partyById.get(r.partyId);
      if (p && !out.find((s) => s.id === p.id)) {
        out.push({ id: p.id, label: p.displayName, role: r.role });
      }
    }
    return out;
  }, [lease, partyById]);

  const [signerId, setSignerId] = useState<string>(signers[0]?.id ?? "");
  const activeSig = signatures[signerId];

  const fileName = `${data.agreementTitle.replace(/\s+/g, "-").toLowerCase()}-${lease.id}.pdf`;

  const handleSign = (dataUrl: string | null) => {
    if (!signerId || !user) return;
    if (dataUrl) {
      saveSignature(lease.id, signerId, { dataUrl, by: user.name });
    } else {
      clearSignature(lease.id, signerId);
    }
  };

  const handleSend = () => {
    const recipients = signers
      .map((s) => partyById.get(s.id))
      .filter((p): p is Party => Boolean(p))
      .flatMap((p) => p.emails ?? []);
    if (recipients.length === 0) {
      toast.error("No emails on file", {
        description: "Add an email address to the lessor/lessee party first.",
      });
      return;
    }
    toast.success(`Sent for signature · ${recipients.length} recipient(s)`, {
      description: `${data.agreementTitle} dispatched to ${recipients.join(", ")}.`,
    });
  };

  const signedCount = Object.keys(signatures).length;
  const totalSigners = signers.length;

  return (
    <section className="flex flex-col gap-3" data-onborda="lease-document">
      <SectionHeader
        title="Lease document"
        description="Auto-filled from this lease. Preview, download, sign, and send to parties."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px]">
              {signedCount} / {totalSigners} signed
            </Badge>
            <PDFDownloadLink document={<LeaseDocument data={data} settings={settings} />} fileName={fileName}>
              {({ loading }) => (
                <Button size="sm" variant="outline" disabled={loading}>
                  <Download className="size-3.5" />
                  {loading ? "Preparing…" : "Download PDF"}
                </Button>
              )}
            </PDFDownloadLink>
            <Button size="sm" onClick={handleSend}>
              <Send className="size-3.5" /> Send for signature
            </Button>
          </div>
        }
      />
      <Card>
        <CardContent className="px-0">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr]">
            <div className="border-b lg:border-r lg:border-b-0">
              <PDFViewer
                showToolbar={false}
                style={{ width: "100%", height: 640, border: 0 }}
              >
                <LeaseDocument data={data} settings={settings} />
              </PDFViewer>
            </div>
            <div className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1">
                <h3 className="flex items-center gap-2 font-medium text-sm">
                  <FileCheck2 className="size-4" /> Sign as
                </h3>
                <p className="text-muted-foreground text-xs">
                  Drop a signature and it lands on the PDF instantly. In production
                  this is replaced by DropboxSign / DocuSign.
                </p>
              </div>
              <Select value={signerId} onValueChange={setSignerId}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Choose a party…" />
                </SelectTrigger>
                <SelectContent>
                  {signers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                      <span className="ml-2 text-muted-foreground text-[10px] uppercase">
                        {s.role}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SignaturePad
                width={360}
                height={130}
                initialDataUrl={activeSig?.dataUrl}
                onChange={handleSign}
                disabled={!signerId}
              />
              {activeSig && (
                <p className="text-muted-foreground text-[11px]">
                  Signed {new Date(activeSig.signedAt).toLocaleString("en-GB")} ·{" "}
                  {activeSig.by}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function PdfFallback() {
  return (
    <div className="flex h-[640px] flex-col gap-3 p-6">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-4 h-full w-full" />
    </div>
  );
}
