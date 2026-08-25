"use client";

import { useEffect, useState } from "react";

import { CheckCircle2, Eye, FileText, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LeaseDocumentPreview } from "@/components/app/lease-document-preview";
import { useDemoStore } from "@/lib/demo/store";
import { useLeaseDocSettings } from "@/lib/demo/use-store";
import type { LeaseDocSettings } from "@/lib/demo/types";
import type { LeaseDocumentData } from "@/templates/leases/lease-document-data";

// Deterministic sample data — never touches Date.now() at module scope.
const SAMPLE_DATA: LeaseDocumentData = {
  id: "lease_sample_lucky_seven",
  isDraft: true,
  agreementTitle: "Indenture of Lease",
  kind: "head",
  purpose: "commercial",
  property: {
    name: "Lucky Seven",
    addressLine: "No. 314, R.A. De Mel Mawatha, Kollupitiya",
    city: "Colombo",
    lotNo: "R",
    planNo: "6434",
    perches: 49.5,
  },
  units: [
    { id: "u1", label: "Whole building", type: "floor", floor: "G–4", areaSqft: 12000 },
  ],
  lessor: {
    id: "p_sample_lessor",
    displayName: "Mr. Saroja Kumara",
    legalName: "Saroja Kumara Wijesekera",
    idNumber: "198030103456",
    address: "12, Galle Road, Colombo 03",
    emails: ["saroja@example.lk"],
    phones: ["+94 77 555 0101"],
    role: "lessor",
  },
  lessee: {
    id: "p_sample_lessee",
    displayName: "Capital Trust Holdings (Pvt) Ltd",
    legalName: "Capital Trust Holdings (Pvt) Ltd",
    idNumber: "PV 12345",
    address: "27, Marine Drive, Colombo 04",
    emails: ["legal@capitaltrust.lk"],
    phones: ["+94 11 555 0190"],
    role: "lessee",
  },
  additionalParties: [
    {
      id: "p_sample_advisor",
      displayName: "Ruvini Weerasinghe",
      role: "advisor",
      emails: ["ruvini@cth-legal.lk"],
    },
  ],
  startDate: "2026-04-09",
  endDate: "2036-04-08",
  advanceMonths: 3,
  lockInEndDate: "2028-04-08",
  paymentCadence: "monthly",
  defaultPaymentMethod: "lkr_transfer",
  securityDeposit: { amount: 18_000_000, currency: "LKR" },
  stampDuty: { amount: 17_582_688, currency: "LKR" },
  legalFees: { amount: 879_134, currency: "LKR" },
  tranches: [
    {
      sequence: 1,
      startDate: "2026-04-09",
      endDate: "2028-04-08",
      monthlyRent: { amount: 6_000_000, currency: "LKR" },
      advanceSetoff: { amount: 600_000, currency: "LKR" },
      dueDayOfMonth: 26,
    },
    {
      sequence: 2,
      startDate: "2028-04-09",
      endDate: "2030-04-08",
      monthlyRent: { amount: 6_300_000, currency: "LKR" },
      dueDayOfMonth: 26,
    },
  ],
  clauses: {
    managementFeesBy: "lessor",
    serviceChargesBy: "lessee",
    sublettingAllowed: "with_consent",
    terminationNoticeMonths: 6,
    renewalNoticeMonths: 6,
    depositRefundTo: "lessee",
  },
  // Stable timestamp so the preview is deterministic.
  generatedAt: "2026-05-15T00:00:00.000Z",
};

const PLACEHOLDERS: Required<LeaseDocSettings> = {
  brandLine: "CAPITAL TRUST",
  brandTagline: "Rental Property Management",
  draftBannerText: "DRAFT — NOT YET EXECUTED. Subject to KYC and final review.",
  footerNote: "",
  agreementTitleOverride: "",
  executionClause:
    "IN WITNESS WHEREOF the parties have hereunto set their hands on the date first above written.",
};

export function LeaseDocumentTemplateCard() {
  const settings = useLeaseDocSettings();
  const isCustomized = Object.values(settings).some(
    (v) => typeof v === "string" && v.trim().length > 0,
  );

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium text-sm">
              Auto-generated lease document
            </span>
            {isCustomized ? (
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-100 text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              >
                <CheckCircle2 className="size-2.5" /> customized
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                default
              </Badge>
            )}
            <Badge variant="outline" className="font-mono text-[10px]">
              .docx (Word)
            </Badge>
          </div>
          <div className="mt-1 font-mono text-muted-foreground text-xs">
            public/lease-templates/{`{`}residential, commercial{`}`}.docx
          </div>
          <div className="mt-2 line-clamp-3 text-muted-foreground text-xs">
            The lease document every party sees, signs, and downloads.
            Auto-filled from each lease&apos;s typed data — fields below override
            the boilerplate copy in the header, banner, and footer.
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PreviewDialog />
        <EditDialog />
      </div>
    </div>
  );
}

function PreviewDialog() {
  const [open, setOpen] = useState(false);
  const settings = useLeaseDocSettings();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="size-3.5" /> View
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Lease document preview</DialogTitle>
          <DialogDescription>
            Rendered with sample data so you can see the layout and any copy
            overrides before they hit a real lease.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-md border">
          {open && <LeaseDocumentPreview data={SAMPLE_DATA} settings={settings} className="h-[640px]" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog() {
  const settings = useLeaseDocSettings();
  const setSettings = useDemoStore((s) => s.setLeaseDocSettings);
  const resetSettings = useDemoStore((s) => s.resetLeaseDocSettings);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LeaseDocSettings>(settings);

  // Reset the form to the latest saved settings whenever the dialog opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setDraft(settings);
  }, [open, settings]);

  const onSave = () => {
    setSettings(draft);
    toast.success("Lease document template updated", {
      description: "Every preview, download, and signed copy will use the new copy.",
    });
    setOpen(false);
  };

  const onReset = () => {
    resetSettings();
    setDraft({});
    toast.success("Reset to template defaults");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lease document copy</DialogTitle>
          <DialogDescription>
            Override the boilerplate header, draft banner, execution clause,
            and footer. Leave a field blank to fall back to the default.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field
            label="Brand line"
            placeholder={PLACEHOLDERS.brandLine}
            value={draft.brandLine ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, brandLine: v }))}
            help="Bold header text — usually your operating entity name."
          />
          <Field
            label="Brand tagline"
            placeholder={PLACEHOLDERS.brandTagline}
            value={draft.brandTagline ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, brandTagline: v }))}
            help="Smaller line beside the brand. Optional."
          />
          <Field
            label="Agreement title override"
            placeholder="e.g. Indenture of Lease (auto)"
            value={draft.agreementTitleOverride ?? ""}
            onChange={(v) =>
              setDraft((d) => ({ ...d, agreementTitleOverride: v }))
            }
            help="Force a specific title regardless of the lease's intake label."
          />
          <Field
            label="Draft banner"
            placeholder={PLACEHOLDERS.draftBannerText}
            value={draft.draftBannerText ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, draftBannerText: v }))}
            help="Shown across the top of unsigned drafts."
            multiline
          />
          <Field
            label="Execution clause"
            placeholder={PLACEHOLDERS.executionClause}
            value={draft.executionClause ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, executionClause: v }))}
            help="Sentence printed above the signature blocks."
            multiline
          />
          <Field
            label="Footer note"
            placeholder="e.g. Confidential — for the parties named herein only."
            value={draft.footerNote ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, footerNote: v }))}
            help="Optional. Prefixes the page footer next to the doc id."
          />
        </div>
        <DialogFooter className="justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="size-3.5" /> Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={onSave}>
              Save copy
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  help,
  multiline = false,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  help?: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      {multiline ? (
        <Textarea
          rows={2}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {help && <p className="text-muted-foreground text-[11px]">{help}</p>}
    </div>
  );
}
