"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileSignature,
  Gavel,
  ListChecks,
  Plus,
  Receipt,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  useFieldArray,
  useForm,
  type Control,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiveDot } from "@/components/ui/live-dot";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Lease, Party, Property, Unit } from "@/core/types";
import type { DraftParty } from "@/lib/demo/types";
import { useDemoStore } from "@/lib/demo/store";
import {
  useDraftParties,
  useDraftProperties,
  useDraftUnits,
  usePartyAddresses,
} from "@/lib/demo/use-store";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

import { DraftLeaseDocumentDialog } from "@/components/app/draft-lease-document-dialog";
import { NewUnitButton } from "@/components/app/forms/new-unit-button";
import { PartyPicker } from "@/components/app/forms/party-picker";
import { PropertyPicker } from "@/components/app/forms/property-picker";

// ───────────────────────────────────────────────────── Zod schema

const currency = z.enum(["LKR", "USD"]);
const responsible = z.enum(["lessor", "lessee", "shared", "other"]);
const subletting = z.enum(["no", "with_consent", "to_group", "yes"]);
const agreementLabel = z.enum(["lease_agreement", "rental_agreement", "other"]);
const depositRefundTo = z.enum(["lessee", "lessor", "other"]);
const kind = z.enum(["head", "sub"]);
const purpose = z.enum(["commercial", "residential", "bpo"]);
const cadence = z.enum(["monthly", "quarterly", "biannual"]);
const paymentMethod = z.enum([
  "lkr_cash",
  "lkr_transfer",
  "usd_transfer",
  "bank_draft",
  "cheque",
]);

const trancheSchema = z.object({
  startDate: z.string().min(1, "Required"),
  endDate: z.string().min(1, "Required"),
  monthlyRent: z.coerce.number().positive("Must be > 0"),
  currency: currency,
  advanceSetoffAmount: z.coerce.number().nonnegative().optional(),
  dueDayOfMonth: z.coerce.number().int().min(1).max(31),
  paymentDescription: z.string().optional(),
  fxRateLkrPerUsd: z.coerce.number().positive().optional(),
});

const subSchema = z.object({
  tenantPartyId: z.string().min(1, "Pick a tenant"),
  tenantAddress: z.string().optional(),
  purpose: purpose,
  cadence: cadence,
  paymentMethod: paymentMethod,
  securityDepositAmount: z.coerce.number().nonnegative().optional(),
  securityDepositCurrency: currency,
  tranches: z.array(trancheSchema).min(1, "At least one tranche"),
});

const schema = z
  .object({
    // Agreement
    kind: kind,
    purpose: purpose,
    agreementLabel: agreementLabel,
    agreementLabelOther: z.string().optional(),
    parentLeaseId: z.string().optional(),

    // Premises
    propertyId: z.string().min(1, "Pick a property"),
    unitIds: z.array(z.string()).min(1, "Pick at least one unit"),

    // Parties
    lessorPartyId: z.string().min(1, "Required"),
    lessorAddress: z.string().optional(),
    lesseePartyId: z.string().min(1, "Required"),
    lesseeAddress: z.string().optional(),
    tenantPartyId: z.string().optional(),
    advisorPartyId: z.string().optional(),
    lessorLawyerPartyId: z.string().optional(),
    lesseeLawyerPartyId: z.string().optional(),

    // Term & notice
    startDate: z.string().min(1, "Required"),
    endDate: z.string().min(1, "Required"),
    advanceMonths: z.coerce.number().int().min(0).max(36).optional(),
    lockInSpecified: z.boolean(),
    lockInYears: z.coerce.number().int().min(0).max(20).optional(),
    terminationNoticeMonths: z.coerce.number().int().min(0).max(36).optional(),
    renewalNoticeMonths: z.coerce.number().int().min(0).max(36).optional(),

    // Money
    securityDepositAmount: z.coerce.number().nonnegative().optional(),
    securityDepositCurrency: currency,
    depositRefundTo: depositRefundTo.optional(),
    depositRefundOther: z.string().optional(),
    legalFeesAmount: z.coerce.number().nonnegative().optional(),
    legalFeesCurrency: currency,
    stampDutyApplicable: z.boolean(),
    stampDutyAmount: z.coerce.number().nonnegative().optional(),
    stampDutyCurrency: currency,
    paymentCadence: cadence,
    defaultPaymentMethod: paymentMethod,

    // Operations & clauses
    occupancyCap: z.coerce.number().int().min(0).max(999).optional(),
    minorRepairsThresholdAmount: z.coerce.number().nonnegative().optional(),
    minorRepairsThresholdCurrency: currency,
    handoverDelayPenaltyAmount: z.coerce.number().nonnegative().optional(),
    handoverDelayPenaltyCurrency: currency,
    managementFeesBy: responsible.optional(),
    managementFeesNote: z.string().optional(),
    serviceChargesBy: responsible.optional(),
    serviceChargesNote: z.string().optional(),
    acServiceBy: responsible.optional(),
    acServiceNote: z.string().optional(),
    sublettingAllowed: subletting.optional(),
    sublettingNote: z.string().optional(),
    maintenanceText: z.string().optional(),
    earlyTerminationPenalty: z.string().optional(),

    // Master rent schedule
    tranches: z.array(trancheSchema).min(1, "At least one tranche"),

    // Sub-tenancy
    hasSubtenancy: z.boolean(),
    sub: subSchema.optional(),

    // Internal (off-checklist)
    introducerPartyId: z.string().optional(),
    handlerPartyId: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.hasSubtenancy && !v.sub) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sub"],
        message: "Sub-tenancy is on — fill in tenant + tranches.",
      });
    }
    if (v.kind === "sub" && !v.parentLeaseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentLeaseId"],
        message: "Pick the parent head lease.",
      });
    }
    if (v.agreementLabel === "other" && !v.agreementLabelOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["agreementLabelOther"],
        message: "Name the agreement type.",
      });
    }
    if (v.stampDutyApplicable && (v.stampDutyAmount ?? 0) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stampDutyAmount"],
        message: "Enter the stamp duty amount or toggle off.",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

// ───────────────────────────────────────────────────── Static options

const RESPONSIBLE_OPTIONS: { value: FormValues["managementFeesBy"]; label: string }[] = [
  { value: "lessor", label: "Lessor / Landlord" },
  { value: "lessee", label: "Lessee / Tenant" },
  { value: "shared", label: "Shared" },
  { value: "other", label: "Other" },
];

const SUBLETTING_OPTIONS: { value: FormValues["sublettingAllowed"]; label: string }[] = [
  { value: "no", label: "Not permitted" },
  { value: "with_consent", label: "With written consent" },
  { value: "to_group", label: "To group / affiliates only" },
  { value: "yes", label: "Permitted" },
];

const DEPOSIT_REFUND_OPTIONS: { value: FormValues["depositRefundTo"]; label: string }[] = [
  { value: "lessee", label: "Lessee (Tenant)" },
  { value: "lessor", label: "Lessor (Landlord)" },
  { value: "other", label: "Other" },
];

// ───────────────────────────────────────────────────── Component

export function NewLeaseForm({
  properties,
  units,
  parties,
  headLeases,
}: {
  properties: Property[];
  units: Unit[];
  parties: Party[];
  headLeases: Lease[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<{
    masterDraftId: string;
    subDraftId?: string;
    propertyName: string;
    lesseeName: string;
    masterIntent: Record<string, unknown>;
    property?: Property;
    draftProperty?: import("@/lib/demo/types").DraftProperty;
    recipients: string[];
  } | null>(null);

  const partyAddressOverlay = usePartyAddresses();
  const draftProperties = useDraftProperties();
  const draftUnits = useDraftUnits();
  const draftParties = useDraftParties();
  const partyById = useMemo(
    () => new Map(parties.map((p) => [p.id, p])),
    [parties],
  );
  const draftPartyById = useMemo(
    () => new Map(draftParties.map((p) => [p.id, p])),
    [draftParties],
  );

  const resolveAddress = (partyId: string | undefined): string => {
    if (!partyId) return "";
    if (partyAddressOverlay[partyId]) return partyAddressOverlay[partyId];
    const existing = partyById.get(partyId);
    if (existing?.address) return existing.address;
    return "";
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues: {
      kind: "head",
      purpose: "residential",
      agreementLabel: "lease_agreement",
      agreementLabelOther: "",
      parentLeaseId: "",
      propertyId: "",
      unitIds: [],
      lessorPartyId: "",
      lessorAddress: "",
      lesseePartyId: "",
      lesseeAddress: "",
      tenantPartyId: "",
      advisorPartyId: "",
      lessorLawyerPartyId: "",
      lesseeLawyerPartyId: "",
      startDate: "",
      endDate: "",
      advanceMonths: undefined,
      lockInSpecified: false,
      lockInYears: undefined,
      terminationNoticeMonths: undefined,
      renewalNoticeMonths: undefined,
      securityDepositAmount: 0,
      securityDepositCurrency: "LKR",
      depositRefundTo: "lessee",
      depositRefundOther: "",
      legalFeesAmount: 0,
      legalFeesCurrency: "LKR",
      stampDutyApplicable: true,
      stampDutyAmount: 0,
      stampDutyCurrency: "LKR",
      paymentCadence: "monthly",
      defaultPaymentMethod: "lkr_transfer",
      occupancyCap: undefined,
      minorRepairsThresholdAmount: undefined,
      minorRepairsThresholdCurrency: "LKR",
      handoverDelayPenaltyAmount: undefined,
      handoverDelayPenaltyCurrency: "LKR",
      managementFeesBy: undefined,
      managementFeesNote: "",
      serviceChargesBy: undefined,
      serviceChargesNote: "",
      acServiceBy: undefined,
      acServiceNote: "",
      sublettingAllowed: undefined,
      sublettingNote: "",
      maintenanceText: "",
      earlyTerminationPenalty: "",
      tranches: [
        {
          startDate: "",
          endDate: "",
          monthlyRent: 0,
          currency: "LKR",
          advanceSetoffAmount: undefined,
          dueDayOfMonth: 1,
          paymentDescription: "",
        },
      ],
      hasSubtenancy: false,
      sub: undefined,
      introducerPartyId: "",
      handlerPartyId: "",
    },
    mode: "onTouched",
  });

  // Watch a few fields for conditional UX.
  const watchedKind = form.watch("kind");
  const watchedPropertyId = form.watch("propertyId");
  const watchedLessorId = form.watch("lessorPartyId");
  const watchedLesseeId = form.watch("lesseePartyId");
  const watchedAgreementLabel = form.watch("agreementLabel");
  const watchedDepositRefundTo = form.watch("depositRefundTo");
  const watchedHasSubtenancy = form.watch("hasSubtenancy");
  const watchedSubTenantId = form.watch("sub.tenantPartyId");
  const watchedLockInSpecified = form.watch("lockInSpecified");
  const watchedStampDutyApplicable = form.watch("stampDutyApplicable");

  // Auto-fill lessor / lessee addresses when picking a party that has one.
  useEffect(() => {
    if (!watchedLessorId) return;
    const cur = form.getValues("lessorAddress");
    if (cur) return;
    const addr = resolveAddress(watchedLessorId);
    if (addr) form.setValue("lessorAddress", addr, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedLessorId]);
  useEffect(() => {
    if (!watchedLesseeId) return;
    const cur = form.getValues("lesseeAddress");
    if (cur) return;
    const addr = resolveAddress(watchedLesseeId);
    if (addr) form.setValue("lesseeAddress", addr, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedLesseeId]);
  useEffect(() => {
    if (!watchedHasSubtenancy || !watchedSubTenantId) return;
    const cur = form.getValues("sub.tenantAddress");
    if (cur) return;
    const addr = resolveAddress(watchedSubTenantId);
    if (addr) form.setValue("sub.tenantAddress", addr, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedSubTenantId, watchedHasSubtenancy]);

  const allUnits = useMemo<Unit[]>(
    () => [...units, ...(draftUnits as unknown as Unit[])],
    [units, draftUnits],
  );
  const propertyUnits = useMemo(
    () => allUnits.filter((u) => u.propertyId === watchedPropertyId),
    [allUnits, watchedPropertyId],
  );
  const selectedProperty = useMemo(
    () =>
      properties.find((p) => p.id === watchedPropertyId) ??
      draftProperties.find((p) => p.id === watchedPropertyId),
    [properties, draftProperties, watchedPropertyId],
  );

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "tranches",
  });

  // When the sub-tenancy toggle goes on, ensure `sub` is initialized.
  useEffect(() => {
    if (watchedHasSubtenancy && !form.getValues("sub")) {
      form.setValue("sub", {
        tenantPartyId: "",
        tenantAddress: "",
        purpose: "residential",
        cadence: "monthly",
        paymentMethod: "usd_transfer",
        securityDepositAmount: 0,
        securityDepositCurrency: "USD",
        tranches: [
          {
            startDate: "",
            endDate: "",
            monthlyRent: 0,
            currency: "USD",
            advanceSetoffAmount: undefined,
            dueDayOfMonth: 1,
            paymentDescription: "",
            fxRateLkrPerUsd: undefined,
          },
        ],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedHasSubtenancy]);

  // Helpers for the action-bar summary.
  const watchedTranches = form.watch("tranches");
  const watchedKindForSummary = watchedKind;
  const watchedPurpose = form.watch("purpose");
  const summary = [
    watchedKindForSummary === "head" ? "Head lease" : "Sublease",
    watchedPurpose,
    `${watchedTranches?.length ?? 0} tranche${(watchedTranches?.length ?? 0) === 1 ? "" : "s"}`,
    watchedHasSubtenancy ? "+ paired sub-tenancy" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      const store = useDemoStore.getState();

      // Persist any new addresses to the client overlay so they pre-fill
      // next time the form opens.
      if (values.lessorAddress?.trim()) {
        store.setPartyAddress(values.lessorPartyId, values.lessorAddress);
      }
      if (values.lesseeAddress?.trim()) {
        store.setPartyAddress(values.lesseePartyId, values.lesseeAddress);
      }
      if (values.hasSubtenancy && values.sub?.tenantAddress?.trim()) {
        store.setPartyAddress(values.sub.tenantPartyId, values.sub.tenantAddress);
      }

      const masterIntent = buildMasterIntent(values);
      const master = store.addDraftLease(masterIntent);
      let sub: { id: string } | undefined;
      if (values.hasSubtenancy && values.sub) {
        sub = store.addDraftLease(buildSubIntent(values, master.id));
      }

      const realProperty = properties.find((p) => p.id === values.propertyId);
      const draftProperty = draftProperties.find((p) => p.id === values.propertyId);
      const property = realProperty ?? draftProperty;
      const lessee =
        partyById.get(values.lesseePartyId) ??
        draftPartyById.get(values.lesseePartyId);
      const lessor =
        partyById.get(values.lessorPartyId) ??
        draftPartyById.get(values.lessorPartyId);
      const subTenant =
        values.hasSubtenancy && values.sub
          ? (partyById.get(values.sub.tenantPartyId) ??
            draftPartyById.get(values.sub.tenantPartyId))
          : undefined;

      // Activity log + KYC approval workflow disabled — app simplified.
      // store.pushActivity({
      //   workflow: "onboard-tenant",
      //   severity: "success",
      //   title: `Lease draft queued · ${property?.name ?? "—"}`,
      //   body: sub
      //     ? `Wizard submitted. Master: ${lessee?.displayName ?? "—"}. Paired sub-tenancy: ${subTenant?.displayName ?? "—"}.`
      //     : `Wizard submitted. Tenant: ${lessee?.displayName ?? "—"}.`,
      // });
      // const approval = store.requestApproval({ … });
      void store;

      const recipients = Array.from(
        new Set(
          [
            ...(lessor?.emails ?? []),
            ...(lessee?.emails ?? []),
            ...(subTenant?.emails ?? []),
          ].filter(Boolean),
        ),
      );

      toast.success("Lease draft generated", {
        description:
          recipients.length > 0
            ? `Auto-sent for signature to ${recipients.join(", ")}.`
            : "Saved as draft. No party emails on file — send manually.",
        duration: 7000,
      });

      setOutcome({
        masterDraftId: master.id,
        subDraftId: sub?.id,
        propertyName: property?.name ?? "—",
        lesseeName: subTenant?.displayName ?? lessee?.displayName ?? "—",
        masterIntent,
        property: realProperty,
        draftProperty,
        recipients,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome)
    return (
      <OutcomePanel
        outcome={outcome}
        properties={properties}
        units={units}
        parties={parties}
      />
    );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4 md:gap-6 pb-24 md:pb-6"
      >
        {/* ───── 1. Agreement basics */}
        <SectionCard
          icon={ClipboardList}
          title="Agreement basics"
          description="Kind, purpose, and the label the lawyer put on the instrument."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kind</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="head">Head lease</SelectItem>
                      <SelectItem value="sub">Sublease</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="residential">Residential</SelectItem>
                      <SelectItem value="bpo">BPO</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="agreementLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agreement label</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="lease_agreement">Lease Agreement</SelectItem>
                      <SelectItem value="rental_agreement">Rental Agreement</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {watchedAgreementLabel === "other" && (
              <FormField
                control={form.control}
                name="agreementLabelOther"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-3">
                    <FormLabel>Other agreement type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Memorandum of understanding" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {watchedKind === "sub" && (
              <FormField
                control={form.control}
                name="parentLeaseId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-3">
                    <FormLabel>Parent head lease</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick the head lease this sublease attaches to" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {headLeases.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </SectionCard>

        {/* ───── 2. Premises */}
        <SectionCard
          icon={Building2}
          title="Premises"
          description="The building and unit(s) the lease covers."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="propertyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property</FormLabel>
                  <FormControl>
                    <PropertyPicker
                      value={field.value}
                      onChange={(id) => {
                        field.onChange(id);
                        // Clear unit selection when the property changes.
                        form.setValue("unitIds", [], { shouldDirty: true });
                      }}
                      properties={properties}
                      draftProperties={draftProperties}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Address</Label>
              <div className="rounded-md border bg-muted/30 px-2.5 py-2 text-sm text-muted-foreground">
                {selectedProperty?.addressLine ?? "—"}
              </div>
            </div>
          </div>
          <FormField
            control={form.control}
            name="unitIds"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel>Units</FormLabel>
                  {watchedPropertyId && (
                    <NewUnitButton
                      properties={properties}
                      defaultPropertyId={watchedPropertyId}
                      lockProperty
                      onCreated={(draft) => {
                        const current = (field.value as string[]) ?? [];
                        if (!current.includes(draft.id)) {
                          field.onChange([...current, draft.id]);
                        }
                      }}
                      trigger={
                        <Button type="button" size="sm" variant="outline">
                          <Plus className="size-3.5" /> New unit
                        </Button>
                      }
                    />
                  )}
                </div>
                <FormControl>
                  <div className="flex min-h-[60px] flex-wrap gap-2 rounded-md border p-3">
                    {propertyUnits.length === 0 && (
                      <p className="text-muted-foreground text-sm">
                        {watchedPropertyId
                          ? "No units on this property yet — click “New unit” to add one."
                          : "Pick a property first to see its units."}
                      </p>
                    )}
                    {propertyUnits.map((u) => {
                      const checked = (field.value as string[]).includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            const next = checked
                              ? (field.value as string[]).filter((x) => x !== u.id)
                              : [...(field.value as string[]), u.id];
                            field.onChange(next);
                          }}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs transition-colors",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-muted",
                          )}
                        >
                          {u.label}
                          {u.bedrooms && (
                            <span
                              className={cn(
                                "ml-1 text-[10px]",
                                checked ? "text-primary-foreground/80" : "text-muted-foreground",
                              )}
                            >
                              · {u.bedrooms} bed
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SectionCard>

        {/* ───── 3. Parties */}
        <SectionCard
          icon={Users}
          title="Parties"
          description="Lessor (landlord) and Lessee (tenant) — both required."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <PartyBlock
              label="Lessor (Landlord)"
              partyIdName="lessorPartyId"
              addressName="lessorAddress"
              parties={parties}
              draftParties={draftParties}
              form={form}
            />
            <PartyBlock
              label="Lessee (Tenant)"
              partyIdName="lesseePartyId"
              addressName="lesseeAddress"
              parties={parties}
              draftParties={draftParties}
              form={form}
            />
          </div>
          {watchedKind === "sub" && (
            <FormField
              control={form.control}
              name="tenantPartyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Occupying tenant{" "}
                    <span className="font-normal text-muted-foreground text-xs">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <PartyPicker
                      value={(field.value as string) ?? ""}
                      onChange={field.onChange}
                      parties={parties}
                      draftParties={draftParties}
                      placeholder="Pick a tenant"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </SectionCard>

        {/* ───── 4. Advisors & lawyers */}
        <SectionCard
          icon={Gavel}
          title="Advisors & lawyers"
          description="All optional. Roll into the lease as additional roles."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <OptionalPartySelect
              control={form.control}
              name="advisorPartyId"
              label="Property Investment Advisor"
              parties={parties}
              draftParties={draftParties}
            />
            <OptionalPartySelect
              control={form.control}
              name="lessorLawyerPartyId"
              label="Landlord's Lawyer"
              parties={parties}
              draftParties={draftParties}
            />
            <OptionalPartySelect
              control={form.control}
              name="lesseeLawyerPartyId"
              label="CTP (Tenant's) Lawyer"
              parties={parties}
              draftParties={draftParties}
            />
          </div>
        </SectionCard>

        {/* ───── 5. Term & notice */}
        <SectionCard
          icon={ClipboardList}
          title="Term & notice"
          description="Dates and the notice / lock-in clauses."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DateField control={form.control} name="startDate" label="Start date" />
            <DateField control={form.control} name="endDate" label="End date" />
            <NumberField
              control={form.control}
              name="advanceMonths"
              label="Advance payment (months)"
              placeholder="e.g. 3"
            />
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Lock-in (years)</Label>
              <div className="flex items-center gap-2">
                <FormField
                  control={form.control}
                  name="lockInYears"
                  render={({ field }) => (
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="e.g. 5"
                        disabled={!watchedLockInSpecified}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lockInSpecified"
                  render={({ field }) => (
                    <label className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
                      <Switch
                        checked={field.value}
                        onCheckedChange={(v) => {
                          field.onChange(v);
                          if (!v) form.setValue("lockInYears", undefined);
                        }}
                        size="sm"
                      />
                      Specified
                    </label>
                  )}
                />
              </div>
            </div>
            <NumberField
              control={form.control}
              name="terminationNoticeMonths"
              label="Termination notice (months)"
              placeholder="e.g. 12"
            />
            <NumberField
              control={form.control}
              name="renewalNoticeMonths"
              label="Renewal notice (months)"
              placeholder="e.g. 12"
            />
          </div>
        </SectionCard>

        {/* ───── 6. Money */}
        <SectionCard
          icon={Receipt}
          title="Money"
          description="Deposit, legal fees, stamp duty, cadence, and payment method."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MoneyField
              control={form.control}
              amountName="securityDepositAmount"
              currencyName="securityDepositCurrency"
              label="Refundable deposit"
            />
            <FormField
              control={form.control}
              name="depositRefundTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deposit credited to</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a side" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DEPOSIT_REFUND_OPTIONS.map((o) =>
                        o.value ? (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ) : null,
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {watchedDepositRefundTo === "other" && (
              <FormField
                control={form.control}
                name="depositRefundOther"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Other (credited to)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <MoneyField
              control={form.control}
              amountName="legalFeesAmount"
              currencyName="legalFeesCurrency"
              label="Legal fees (1%)"
            />
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Stamp duty (2%)</Label>
              <div className="flex items-center gap-2">
                <FormField
                  control={form.control}
                  name="stampDutyAmount"
                  render={({ field }) => (
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Amount"
                        disabled={!watchedStampDutyApplicable}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                        }
                      />
                    </FormControl>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stampDutyCurrency"
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!watchedStampDutyApplicable}
                    >
                      <SelectTrigger className="w-[88px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LKR">LKR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="stampDutyApplicable"
                render={({ field }) => (
                  <label className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <Switch
                      checked={field.value}
                      onCheckedChange={(v) => {
                        field.onChange(v);
                        if (!v) form.setValue("stampDutyAmount", 0);
                      }}
                      size="sm"
                    />
                    Applicable (toggle off for N/A)
                  </label>
                )}
              />
              <FormMessage>
                {form.formState.errors.stampDutyAmount?.message ?? ""}
              </FormMessage>
            </div>
            <FormField
              control={form.control}
              name="paymentCadence"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cadence</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="biannual">Bi-annual</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultPaymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default payment method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="lkr_cash">LKR cash</SelectItem>
                      <SelectItem value="lkr_transfer">LKR transfer</SelectItem>
                      <SelectItem value="usd_transfer">USD transfer</SelectItem>
                      <SelectItem value="bank_draft">Bank draft</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SectionCard>

        {/* ───── 7. Operations & clauses */}
        <SectionCard
          icon={ShieldCheck}
          title="Operations & clauses"
          description="Maintenance, responsibility splits, subletting, and termination penalties — from the checklist."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              control={form.control}
              name="occupancyCap"
              label="Occupancy cap (persons)"
              placeholder="e.g. 5"
            />
            <MoneyField
              control={form.control}
              amountName="minorRepairsThresholdAmount"
              currencyName="minorRepairsThresholdCurrency"
              label="Minor repairs threshold / job"
            />
            <MoneyField
              control={form.control}
              amountName="handoverDelayPenaltyAmount"
              currencyName="handoverDelayPenaltyCurrency"
              label="Handover delay penalty / day"
            />
          </div>
          <Separator className="my-2" />
          <ResponsibilityRow
            form={form}
            byName="managementFeesBy"
            noteName="managementFeesNote"
            label="Management fees paid by"
          />
          <ResponsibilityRow
            form={form}
            byName="serviceChargesBy"
            noteName="serviceChargesNote"
            label="Service charges paid by"
          />
          <ResponsibilityRow
            form={form}
            byName="acServiceBy"
            noteName="acServiceNote"
            label="A/C service paid by"
          />
          <Separator className="my-2" />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="sublettingAllowed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subletting</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                      className="gap-1.5"
                    >
                      {SUBLETTING_OPTIONS.map((o) =>
                        o.value ? (
                          <label
                            key={o.value}
                            className="flex items-center gap-2 text-sm"
                          >
                            <RadioGroupItem value={o.value} />
                            {o.label}
                          </label>
                        ) : null,
                      )}
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sublettingNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Subletting note{" "}
                    <span className="font-normal text-muted-foreground text-xs">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="e.g. Permitted to assign or sub-let to group companies, affiliates, or employees."
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="maintenanceText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maintenance & cleanliness clause</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder="Paste the clause body verbatim."
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="earlyTerminationPenalty"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Early-termination penalty</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="e.g. 6 months' rent as liquidated damages by the party in breach."
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </SectionCard>

        {/* ───── 8. Master rent schedule */}
        <SectionCard
          icon={FileSignature}
          title="Master rent schedule"
          description="One tranche per flat-rent window. Add more for escalations."
        >
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  startDate: "",
                  endDate: "",
                  monthlyRent: 0,
                  currency: "LKR",
                  advanceSetoffAmount: undefined,
                  dueDayOfMonth: 1,
                  paymentDescription: "",
                })
              }
            >
              <Plus className="size-4" /> Add tranche
            </Button>
          </div>
          <div className="space-y-3">
            {fields.map((f, i) => (
              <TrancheBlock
                key={f.id}
                index={i}
                fieldPath="tranches"
                form={form}
                canRemove={fields.length > 1}
                onRemove={() => remove(i)}
                showFxRate={false}
              />
            ))}
          </div>
        </SectionCard>

        {/* ───── 9. Sub-tenancy */}
        <SectionCard
          icon={FileSignature}
          title="Paired sub-tenancy"
          description="Toggle on if this intake also captures a Master-and-Sub pair on one document."
          headerAction={
            <FormField
              control={form.control}
              name="hasSubtenancy"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  Add sub-tenancy
                </label>
              )}
            />
          }
        >
          {watchedHasSubtenancy && <SubTenancyBlock form={form} parties={parties} />}
          {!watchedHasSubtenancy && (
            <p className="text-muted-foreground text-sm">
              Off. Toggle the switch above to capture a USD-denominated sub-tenancy with FX rate.
            </p>
          )}
        </SectionCard>

        {/* ───── 10. Internal (off-checklist) */}
        <Collapsible>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="size-4" />
                    Internal
                  </CardTitle>
                  <CardDescription>
                    Off-checklist — for internal commission / accounting workflows.
                  </CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm">
                    <ChevronDown className="size-4 data-[state=open]:hidden" />
                    <ChevronUp className="size-4 hidden data-[state=open]:inline" />
                    Toggle
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
                <OptionalPartySelect
                  control={form.control}
                  name="introducerPartyId"
                  label="Introducer"
                  parties={parties}
                  draftParties={draftParties}
                />
                <OptionalPartySelect
                  control={form.control}
                  name="handlerPartyId"
                  label="Accountant / handler"
                  parties={parties}
                  draftParties={draftParties}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ───── Action bar */}
        <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">{summary}</p>
            <div className="flex items-center gap-2">
              <Button asChild type="button" variant="ghost" size="sm">
                <Link href="/leases">Cancel</Link>
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit (mock)"}
              </Button>
            </div>
          </div>
        </div>

        {/* What the system does next */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4" />
              What the system does next
            </CardTitle>
            <CardDescription>
              Submitting kicks off the onboarding workflow. Each step shows up as an Activity;
              gated steps (KYC, lawyer review) wait for you in Tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              <NextStep
                n={1}
                icon={FileSignature}
                label="Save draft lease"
                detail="Stored against draft id · visible on /leases as a draft."
              />
              {watchedHasSubtenancy && (
                <NextStep
                  n={2}
                  icon={FileSignature}
                  label="Save paired sub-tenancy"
                  detail="Second draft links to the master via parentLeaseId."
                />
              )}
              <NextStep
                n={watchedHasSubtenancy ? 3 : 2}
                icon={ShieldCheck}
                label="Queue KYC review"
                detail="Bundle goes to Tasks for human approval."
              />
              <NextStep
                n={watchedHasSubtenancy ? 4 : 3}
                icon={Bot}
                label="Generate draft on KYC approval"
                detail="Templated DOCX → PDF auto-built; lawyer review fires next."
              />
              <NextStep
                n={watchedHasSubtenancy ? 5 : 4}
                icon={ListChecks}
                label="Materialize obligations"
                detail="Tranches → monthly rent + deposit + stamp duty rows on activation."
              />
            </ol>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

// ───────────────────────────────────────────────────── Submit helpers

function buildMasterIntent(values: FormValues): Record<string, unknown> {
  return {
    propertyId: values.propertyId,
    unitIds: values.unitIds,
    lessorPartyId: values.lessorPartyId,
    lesseePartyId: values.lesseePartyId,
    tenantPartyId: values.tenantPartyId || undefined,
    kind: values.kind,
    purpose: values.purpose,
    agreementLabel: values.agreementLabel,
    agreementLabelOther:
      values.agreementLabel === "other" ? values.agreementLabelOther : undefined,
    parentLeaseId: values.kind === "sub" ? values.parentLeaseId : undefined,
    startDate: values.startDate,
    endDate: values.endDate,
    advanceMonths: values.advanceMonths,
    occupancyCap: values.occupancyCap,
    lockInYears: values.lockInSpecified ? values.lockInYears : undefined,
    paymentCadence: values.paymentCadence,
    defaultPaymentMethod: values.defaultPaymentMethod,
    securityDeposit:
      values.securityDepositAmount && values.securityDepositAmount > 0
        ? {
            amount: values.securityDepositAmount,
            currency: values.securityDepositCurrency,
          }
        : undefined,
    legalFees:
      values.legalFeesAmount && values.legalFeesAmount > 0
        ? { amount: values.legalFeesAmount, currency: values.legalFeesCurrency }
        : undefined,
    stampDuty:
      values.stampDutyApplicable && values.stampDutyAmount && values.stampDutyAmount > 0
        ? { amount: values.stampDutyAmount, currency: values.stampDutyCurrency }
        : undefined,
    clauses: assembleClauses(values),
    additionalRoles: assembleAdditionalRoles(values),
    tranches: values.tranches.map((t, i) => ({
      sequence: i + 1,
      startDate: t.startDate,
      endDate: t.endDate,
      monthlyRent: { amount: t.monthlyRent, currency: t.currency },
      advanceSetoff:
        t.advanceSetoffAmount && t.advanceSetoffAmount > 0
          ? { amount: t.advanceSetoffAmount, currency: t.currency }
          : undefined,
      dueDayOfMonth: t.dueDayOfMonth,
      paymentDescription: t.paymentDescription || undefined,
    })),
  };
}

function buildSubIntent(values: FormValues, parentDraftId: string): Record<string, unknown> {
  if (!values.sub) return {};
  return {
    propertyId: values.propertyId,
    unitIds: values.unitIds,
    lessorPartyId: values.lesseePartyId, // master's lessee becomes the sub's lessor
    lesseePartyId: values.sub.tenantPartyId,
    parentLeaseId: parentDraftId,
    kind: "sub",
    purpose: values.sub.purpose,
    agreementLabel: values.agreementLabel,
    startDate: values.startDate,
    endDate: values.endDate,
    paymentCadence: values.sub.cadence,
    defaultPaymentMethod: values.sub.paymentMethod,
    securityDeposit:
      values.sub.securityDepositAmount && values.sub.securityDepositAmount > 0
        ? {
            amount: values.sub.securityDepositAmount,
            currency: values.sub.securityDepositCurrency,
          }
        : undefined,
    tranches: values.sub.tranches.map((t, i) => ({
      sequence: i + 1,
      startDate: t.startDate,
      endDate: t.endDate,
      monthlyRent: { amount: t.monthlyRent, currency: t.currency },
      dueDayOfMonth: t.dueDayOfMonth,
      paymentDescription: t.paymentDescription || undefined,
      fxRateLkrPerUsd: t.fxRateLkrPerUsd,
    })),
  };
}

function assembleClauses(values: FormValues) {
  const c: Record<string, unknown> = {};
  if (values.managementFeesBy) c.managementFeesBy = values.managementFeesBy;
  if (values.managementFeesNote) c.managementFeesNote = values.managementFeesNote;
  if (values.serviceChargesBy) c.serviceChargesBy = values.serviceChargesBy;
  if (values.serviceChargesNote) c.serviceChargesNote = values.serviceChargesNote;
  if (values.acServiceBy) c.acServiceBy = values.acServiceBy;
  if (values.acServiceNote) c.acServiceNote = values.acServiceNote;
  if (values.minorRepairsThresholdAmount && values.minorRepairsThresholdAmount > 0) {
    c.minorRepairsThreshold = {
      amount: values.minorRepairsThresholdAmount,
      currency: values.minorRepairsThresholdCurrency,
    };
  }
  if (values.maintenanceText) c.maintenanceText = values.maintenanceText;
  if (values.handoverDelayPenaltyAmount && values.handoverDelayPenaltyAmount > 0) {
    c.handoverDelayPenalty = {
      amount: values.handoverDelayPenaltyAmount,
      currency: values.handoverDelayPenaltyCurrency,
    };
  }
  if (values.earlyTerminationPenalty) c.earlyTerminationPenalty = values.earlyTerminationPenalty;
  if (typeof values.terminationNoticeMonths === "number") {
    c.terminationNoticeMonths = values.terminationNoticeMonths;
  }
  if (typeof values.renewalNoticeMonths === "number") {
    c.renewalNoticeMonths = values.renewalNoticeMonths;
  }
  if (values.sublettingAllowed) c.sublettingAllowed = values.sublettingAllowed;
  if (values.sublettingNote) c.sublettingNote = values.sublettingNote;
  if (values.depositRefundTo) c.depositRefundTo = values.depositRefundTo;
  if (values.depositRefundTo === "other" && values.depositRefundOther) {
    c.depositRefundOther = values.depositRefundOther;
  }
  return Object.keys(c).length > 0 ? c : undefined;
}

function assembleAdditionalRoles(values: FormValues) {
  const out: { partyId: string; role: string }[] = [];
  if (values.advisorPartyId) out.push({ partyId: values.advisorPartyId, role: "advisor" });
  if (values.lessorLawyerPartyId) {
    out.push({ partyId: values.lessorLawyerPartyId, role: "lessor_lawyer" });
  }
  if (values.lesseeLawyerPartyId) {
    out.push({ partyId: values.lesseeLawyerPartyId, role: "lessee_lawyer" });
  }
  if (values.tenantPartyId) out.push({ partyId: values.tenantPartyId, role: "tenant" });
  if (values.introducerPartyId) {
    out.push({ partyId: values.introducerPartyId, role: "introducer" });
  }
  if (values.handlerPartyId) {
    out.push({ partyId: values.handlerPartyId, role: "accountant_handler" });
  }
  return out.length > 0 ? out : undefined;
}

// ───────────────────────────────────────────────────── Reusable section card

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  headerAction,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className="size-4" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

// ───────────────────────────────────────────────────── Sub-components

function PartyBlock({
  label,
  partyIdName,
  addressName,
  parties,
  draftParties,
  form,
}: {
  label: string;
  partyIdName: "lessorPartyId" | "lesseePartyId";
  addressName: "lessorAddress" | "lesseeAddress";
  parties: Party[];
  draftParties: DraftParty[];
  form: UseFormReturn<FormValues>;
}) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="text-muted-foreground text-[11px] uppercase tracking-wider">
        {label}
      </div>
      <FormField
        control={form.control}
        name={partyIdName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Party</FormLabel>
            <FormControl>
              <PartyPicker
                value={field.value}
                onChange={field.onChange}
                parties={parties}
                draftParties={draftParties}
                placeholder={`Pick ${label.toLowerCase()}`}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={addressName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address</FormLabel>
            <FormControl>
              <Textarea
                rows={2}
                placeholder="Full postal address"
                {...field}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}

function OptionalPartySelect({
  control,
  name,
  label,
  parties,
  draftParties,
}: {
  control: Control<FormValues>;
  name:
    | "advisorPartyId"
    | "lessorLawyerPartyId"
    | "lesseeLawyerPartyId"
    | "introducerPartyId"
    | "handlerPartyId";
  label: string;
  parties: Party[];
  draftParties: DraftParty[];
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}{" "}
            <span className="font-normal text-muted-foreground text-xs">(optional)</span>
          </FormLabel>
          <FormControl>
            <PartyPicker
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              parties={parties}
              draftParties={draftParties}
              placeholder="Pick a party"
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

function ResponsibilityRow({
  form,
  byName,
  noteName,
  label,
}: {
  form: UseFormReturn<FormValues>;
  byName: "managementFeesBy" | "serviceChargesBy" | "acServiceBy";
  noteName: "managementFeesNote" | "serviceChargesNote" | "acServiceNote";
  label: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
      <FormField
        control={form.control}
        name={byName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a side" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {RESPONSIBLE_OPTIONS.map((o) =>
                  o.value ? (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ) : null,
                )}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={noteName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Note{" "}
              <span className="font-normal text-muted-foreground text-xs">(optional)</span>
            </FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. Lessee at its cost throughout the tenancy."
                {...field}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}

function DateField({
  control,
  name,
  label,
}: {
  control: Control<FormValues>;
  name: "startDate" | "endDate";
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type="date" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function NumberField({
  control,
  name,
  label,
  placeholder,
}: {
  control: Control<FormValues>;
  name:
    | "advanceMonths"
    | "occupancyCap"
    | "terminationNoticeMonths"
    | "renewalNoticeMonths";
  label: string;
  placeholder?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={0}
              placeholder={placeholder}
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function MoneyField({
  control,
  amountName,
  currencyName,
  label,
}: {
  control: Control<FormValues>;
  amountName:
    | "securityDepositAmount"
    | "legalFeesAmount"
    | "minorRepairsThresholdAmount"
    | "handoverDelayPenaltyAmount";
  currencyName:
    | "securityDepositCurrency"
    | "legalFeesCurrency"
    | "minorRepairsThresholdCurrency"
    | "handoverDelayPenaltyCurrency";
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <FormField
          control={control}
          name={amountName}
          render={({ field }) => (
            <FormControl>
              <Input
                type="number"
                min={0}
                placeholder="Amount"
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                }
              />
            </FormControl>
          )}
        />
        <FormField
          control={control}
          name={currencyName}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger className="w-[88px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LKR">LKR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </div>
  );
}

function TrancheBlock({
  index,
  fieldPath,
  form,
  canRemove,
  onRemove,
  showFxRate,
}: {
  index: number;
  fieldPath: "tranches" | "sub.tranches";
  form: UseFormReturn<FormValues>;
  canRemove: boolean;
  onRemove: () => void;
  showFxRate: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-3 flex items-center justify-between">
        <Badge variant="outline">Tranche {index + 1}</Badge>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label="Remove tranche"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <FormField
          control={form.control}
          name={`${fieldPath}.${index}.startDate` as const}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${fieldPath}.${index}.endDate` as const}
          render={({ field }) => (
            <FormItem>
              <FormLabel>End</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${fieldPath}.${index}.monthlyRent` as const}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monthly rent</FormLabel>
              <FormControl>
                <Input type="number" min={0} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${fieldPath}.${index}.currency` as const}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Currency</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="LKR">LKR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${fieldPath}.${index}.advanceSetoffAmount` as const}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Advance set-off{" "}
                <span className="font-normal text-muted-foreground text-xs">(opt)</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  value={(field.value as number | undefined) ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? undefined : Number(e.target.value),
                    )
                  }
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${fieldPath}.${index}.dueDayOfMonth` as const}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Due day</FormLabel>
              <FormControl>
                <Input type="number" min={1} max={31} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {showFxRate && (
          <FormField
            control={form.control}
            name={`${fieldPath}.${index}.fxRateLkrPerUsd` as const}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  FX rate (LKR per USD){" "}
                  <span className="font-normal text-muted-foreground text-xs">(opt)</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 313.05"
                    value={(field.value as number | undefined) ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value),
                      )
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name={`${fieldPath}.${index}.paymentDescription` as const}
          render={({ field }) => (
            <FormItem className="col-span-2 md:col-span-3 lg:col-span-4">
              <FormLabel>
                Payment description{" "}
                <span className="font-normal text-muted-foreground text-xs">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Advance set-off Rs. 600,000/month; balance Rs. 5,400,000/month by 9th."
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

function SubTenancyBlock({
  form,
  parties,
}: {
  form: UseFormReturn<FormValues>;
  parties: Party[];
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "sub.tranches",
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField
          control={form.control}
          name="sub.tenantPartyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sub-tenant</FormLabel>
              <Select onValueChange={field.onChange} value={(field.value as string) ?? ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a tenant" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {parties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.displayName}
                      <span className="ml-1 text-muted-foreground text-xs">· {p.kind}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sub.purpose"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sub purpose</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="bpo">BPO</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sub.cadence"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cadence</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="biannual">Bi-annual</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sub.paymentMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment method</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="lkr_cash">LKR cash</SelectItem>
                  <SelectItem value="lkr_transfer">LKR transfer</SelectItem>
                  <SelectItem value="usd_transfer">USD transfer</SelectItem>
                  <SelectItem value="bank_draft">Bank draft</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Refundable deposit</Label>
          <div className="flex items-center gap-2">
            <FormField
              control={form.control}
              name="sub.securityDepositAmount"
              render={({ field }) => (
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    value={(field.value as number | undefined) ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value),
                      )
                    }
                  />
                </FormControl>
              )}
            />
            <FormField
              control={form.control}
              name="sub.securityDepositCurrency"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="w-[88px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LKR">LKR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>
      <FormField
        control={form.control}
        name="sub.tenantAddress"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Sub-tenant address</FormLabel>
            <FormControl>
              <Textarea rows={2} placeholder="Full postal address" {...field} />
            </FormControl>
          </FormItem>
        )}
      />
      <Separator />
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Sub-tenancy rent schedule</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              startDate: "",
              endDate: "",
              monthlyRent: 0,
              currency: "USD",
              advanceSetoffAmount: undefined,
              dueDayOfMonth: 1,
              paymentDescription: "",
              fxRateLkrPerUsd: undefined,
            })
          }
        >
          <Plus className="size-4" /> Add tranche
        </Button>
      </div>
      <div className="space-y-3">
        {fields.map((f, i) => (
          <TrancheBlock
            key={f.id}
            index={i}
            fieldPath="sub.tranches"
            form={form}
            canRemove={fields.length > 1}
            onRemove={() => remove(i)}
            showFxRate={true}
          />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────── Outcome panel

function NextStep({
  n,
  icon: Icon,
  label,
  detail,
}: {
  n: number;
  icon: typeof Bot;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-md border bg-muted/40 px-3 py-2">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground tabular-nums text-[11px]">
        {n}
      </div>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-muted-foreground text-xs">{detail}</div>
      </div>
    </li>
  );
}

function OutcomePanel({
  outcome,
  properties,
  units,
  parties,
}: {
  outcome: {
    masterDraftId: string;
    subDraftId?: string;
    propertyName: string;
    lesseeName: string;
    masterIntent: Record<string, unknown>;
    property?: Property;
    draftProperty?: import("@/lib/demo/types").DraftProperty;
    recipients: string[];
  };
  properties: Property[];
  units: Unit[];
  parties: Party[];
}) {
  void properties;
  return (
    <Card className="border-emerald-200 dark:border-emerald-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
          Lease draft generated · {outcome.propertyName}
        </CardTitle>
        <CardDescription>
          Auto-filled, saved as a draft, and dispatched to the parties for signature.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ul className="space-y-2">
          <OutcomeRow
            tone="done"
            title="Master draft saved"
            detail={
              <>
                <span className="font-mono text-xs">{outcome.masterDraftId}</span> · stored
                in browser state · visible on the leases list as <em>draft</em>.
              </>
            }
          />
          {outcome.subDraftId && (
            <OutcomeRow
              tone="done"
              title="Sub-tenancy draft saved"
              detail={
                <>
                  <span className="font-mono text-xs">{outcome.subDraftId}</span> · linked
                  to the master via <code>parentLeaseId</code>.
                </>
              }
            />
          )}
          <OutcomeRow
            tone="done"
            title="Document auto-generated"
            detail="PDF rendered from the wizard inputs. Preview or download below."
          />
          <OutcomeRow
            tone="done"
            title={
              outcome.recipients.length > 0
                ? `Sent to ${outcome.recipients.length} party email(s)`
                : "Ready to send"
            }
            detail={
              outcome.recipients.length > 0
                ? outcome.recipients.join(", ")
                : "No party email on file. Send from the lease document section once added."
            }
          />
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <DraftLeaseDocumentDialog
            draftId={outcome.masterDraftId}
            intent={outcome.masterIntent}
            property={outcome.property}
            draftProperty={outcome.draftProperty}
            units={units}
            parties={parties}
          />
          <Button asChild variant="outline" size="sm">
            <Link href="/leases">
              <FileSignature className="size-4" /> All leases
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href="/leases/new">Start another</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OutcomeRow({
  tone,
  title,
  detail,
}: {
  tone: "done" | "pending" | "next";
  title: string;
  detail: React.ReactNode;
}) {
  const dot =
    tone === "done" ? (
      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
    ) : tone === "pending" ? (
      <LiveDot tone="warning" size="xs" />
    ) : (
      <div className="size-3 rounded-full border border-dashed" />
    );
  return (
    <li className="flex items-start gap-3 rounded-md border bg-background px-3 py-2">
      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center">{dot}</div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-muted-foreground text-xs">{detail}</div>
      </div>
    </li>
  );
}

// helper kept for parity with the old wizard's review block (unused now but
// referenced by formatDate for future date echoes).
void formatCurrency;
void formatDate;
