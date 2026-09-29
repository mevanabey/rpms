/**
 * Compact "details view" — a two-column list of every captured field on a
 * lease, mirroring the firm's intake checklist.
 *
 * This is also the **only** place a lease is edited: turning on edit mode
 * forces this view and swaps each value for the matching control (see
 * `lease-field-cell.tsx`), which saves on change. Every row is editable, and
 * each one declares where its value goes — the lease row, its clause bag, the
 * first rent tranche, the lease's unit set / role assignments, or the shared
 * party / property record.
 *
 * Rows for values that aren't captured yet are hidden until edit mode is on
 * (`editOnly`), so an empty lease can still be filled in field by field
 * without the read view turning into a wall of dashes.
 */
import type { ReactNode } from "react";

import { LeaseStatusBadge } from "@/components/app/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Lease, Party, Property, Unit } from "@/core/types";
import { partyMap } from "@/lib/lookup";
import { formatCurrency, formatDate } from "@/lib/utils";

import { LeaseDetailsRows, type LeaseDetailRow } from "./lease-details-rows";
import { LeaseFieldCell, type LeaseFieldSpec } from "./lease-field-cell";
import {
  agreementLabelOptions,
  cadenceOptions,
  depositRefundOptions,
  paymentMethodOptions,
  purposeOptions,
  responsibleOptions,
  statusOptions,
  sublettingOptions,
} from "./lease-field-options";

const RESPONSIBLE: Record<string, string> = {
  lessor: "Landlord",
  lessee: "Tenant",
  shared: "Shared",
  other: "Other",
};

const SUBLETTING: Record<string, string> = {
  no: "Not permitted",
  with_consent: "Permitted with consent",
  to_group: "Permitted to group / affiliates",
  yes: "Permitted",
};

const DEPOSIT_REFUND: Record<string, string> = {
  lessee: "Refunded to Tenant",
  lessor: "Refunded to Landlord",
  other: "Other",
};

const AGREEMENT: Record<string, string> = {
  lease_agreement: "Lease Agreement",
  rental_agreement: "Rental Agreement",
  other: "Other",
};

/** Roles a lease can carry beyond landlord + tenant, in checklist order. */
const EXTRA_ROLES = [
  { role: "advisor", label: "Property Investment Advisor" },
  { role: "lessor_lawyer", label: "Landlord's Lawyer" },
  { role: "lessee_lawyer", label: "Tenant's Lawyer" },
  { role: "introducer", label: "Introducer" },
  { role: "accountant_handler", label: "Accountant / Handler" },
  { role: "witness", label: "Witness" },
] as const;

function moneyText(m?: { amount: number; currency: "LKR" | "USD" }): string {
  if (!m) return "—";
  return formatCurrency(m.amount, { currency: m.currency, noDecimals: true });
}

function monthsText(n: number): string {
  return `${n} month${n === 1 ? "" : "s"}`;
}

export function LeaseDetailsTable({
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
  const byId = partyMap(parties);
  const lessor = byId.get(lease.lessorPartyId);
  const lessee = byId.get(lease.lesseePartyId);
  const c = lease.clauses;
  const roles = lease.additionalRoles ?? [];
  const perUnitSuffix = lease.unitIds.length > 1 ? " per unit" : "";
  const firstTranche = lease.tranches[0];

  /** An editable value cell — display node outside edit mode, control inside. */
  const editable = (
    label: string,
    spec: LeaseFieldSpec,
    display: ReactNode,
  ): ReactNode => (
    <LeaseFieldCell leaseId={lease.id} label={label} field={spec}>
      {display}
    </LeaseFieldCell>
  );

  const sortedParties = [...parties].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
  const partyOptions = sortedParties.map((p) => ({
    value: p.id,
    label: p.displayName,
  }));
  // Landlord and tenant pickers each exclude the other side, so an inline
  // swap can't collapse both roles onto one party.
  const lessorOptions = partyOptions.filter((o) => o.value !== lease.lesseePartyId);
  const lesseeOptions = partyOptions.filter((o) => o.value !== lease.lessorPartyId);
  const unitOptions = units
    .filter((u) => !property || u.propertyId === property.id)
    .map((u) => ({ value: u.id, label: u.label }));

  const unitLabels = lease.unitIds
    .map((id) => units.find((u) => u.id === id)?.label ?? id)
    .join(", ");

  /** Party ID row — NIC/passport for individuals, company reg for companies. */
  const partyIdRow = (label: string, p: Party | undefined): LeaseDetailRow => {
    const isCompany = p?.kind === "company";
    const value = isCompany ? p?.companyRegNo : p?.nicOrPassport;
    if (!p) return { label, value: "—" };
    return {
      label,
      editOnly: !value,
      value: editable(
        label,
        {
          control: { kind: "text", value: value ?? null },
          save: {
            on: "party",
            partyId: p.id,
            field: isCompany ? "companyRegNo" : "nicOrPassport",
          },
        },
        value ?? "—",
      ),
    };
  };

  const partyAddressRow = (label: string, p: Party | undefined): LeaseDetailRow => {
    if (!p) return { label, value: "—" };
    return {
      label,
      editOnly: !p.address,
      value: editable(
        label,
        {
          control: { kind: "text", value: p.address ?? null, wide: true },
          save: { on: "party", partyId: p.id, field: "address" },
        },
        p.address ?? "—",
      ),
    };
  };

  /** A clause row that renders "Responsible party · free-text note". */
  const responsibleRows = (
    label: string,
    byField: "managementFeesBy" | "serviceChargesBy" | "acServiceBy" | "taxApplicabilityBy",
    noteField: "managementFeesNote" | "serviceChargesNote" | "acServiceNote" | "taxApplicabilityNote",
    by: string | undefined,
    note: string | undefined,
  ): LeaseDetailRow[] => [
    {
      label,
      editOnly: !by,
      value: editable(
        label,
        {
          control: {
            kind: "select",
            value: by ?? null,
            options: responsibleOptions,
            clearable: true,
          },
          save: { on: "clause", field: byField },
        },
        by ? RESPONSIBLE[by] : "—",
      ),
    },
    {
      label: `${label} — note`,
      editOnly: !note,
      value: editable(
        `${label} note`,
        {
          control: { kind: "text", value: note ?? null, wide: true },
          save: { on: "clause", field: noteField },
        },
        note ?? "—",
      ),
    },
  ];

  const rows: LeaseDetailRow[] = [
    // ── Premises
    {
      label: "Property Name",
      value: property
        ? editable(
            "Property name",
            {
              control: { kind: "text", value: property.name, required: true },
              save: { on: "property", propertyId: property.id, field: "name" },
            },
            property.name,
          )
        : "—",
    },
    {
      label: "Premises address",
      value: property
        ? editable(
            "Premises address",
            {
              control: {
                kind: "text",
                value: property.addressLine,
                required: true,
                wide: true,
              },
              save: { on: "property", propertyId: property.id, field: "addressLine" },
            },
            property.addressLine,
          )
        : "—",
    },
    {
      label: "City",
      value: property
        ? editable(
            "City",
            {
              control: { kind: "text", value: property.city, required: true },
              save: { on: "property", propertyId: property.id, field: "city" },
            },
            property.city,
          )
        : "—",
    },
    {
      label: "Unit Nos.",
      value: editable(
        "Units",
        {
          control: { kind: "multi", value: lease.unitIds, options: unitOptions },
          save: { on: "units" },
        },
        unitLabels || "—",
      ),
    },
    {
      label: "Occupancy cap",
      editOnly: typeof lease.occupancyCap !== "number",
      value: editable(
        "Occupancy cap",
        {
          control: {
            kind: "int",
            value: lease.occupancyCap ?? null,
            unit: "persons",
            min: 1,
          },
          save: { on: "lease", field: "occupancyCap" },
        },
        typeof lease.occupancyCap === "number"
          ? `Not more than ${lease.occupancyCap} persons`
          : "—",
      ),
    },

    // ── Parties
    {
      label: "Lessor's Name & ID",
      value: editable(
        "Landlord",
        {
          control: {
            kind: "select",
            value: lease.lessorPartyId,
            options: lessorOptions,
          },
          save: { on: "lease", field: "lessorPartyId" },
        },
        lessor?.displayName ?? "—",
      ),
    },
    partyIdRow("Lessor ID / Reg", lessor),
    partyAddressRow("Lessor's Address", lessor),
    {
      label: "Lessee's Name & ID",
      value: editable(
        "Tenant",
        {
          control: {
            kind: "select",
            value: lease.lesseePartyId,
            options: lesseeOptions,
          },
          save: { on: "lease", field: "lesseePartyId" },
        },
        lessee?.displayName ?? "—",
      ),
    },
    partyIdRow("Lessee ID / Passport", lessee),
    partyAddressRow("Lessee's Address", lessee),
    {
      label: "Lessee's Current Employer",
      editOnly: !c?.lesseeEmployer,
      value: editable(
        "Lessee's current employer",
        {
          control: { kind: "text", value: c?.lesseeEmployer ?? null, wide: true },
          save: { on: "clause", field: "lesseeEmployer" },
        },
        c?.lesseeEmployer ?? "—",
      ),
    },
    ...EXTRA_ROLES.map(({ role, label }): LeaseDetailRow => {
      const assigned = roles.filter((r) => r.role === role);
      return {
        label,
        value: assigned.map((person) => byId.get(person.partyId)?.displayName ?? "Contact").join(", ") || "—",
      };
    }),
    {
      label: "CTP Lawyer",
      editOnly: !c?.ctpLawyerName,
      value: editable(
        "CTP Lawyer",
        {
          control: { kind: "text", value: c?.ctpLawyerName ?? null },
          save: { on: "clause", field: "ctpLawyerName" },
        },
        c?.ctpLawyerName ?? "—",
      ),
    },

    // ── Lease body
    {
      label: "Status",
      value: editable(
        "Status",
        {
          control: { kind: "select", value: lease.status, options: statusOptions },
          save: { on: "lease", field: "status" },
        },
        <LeaseStatusBadge status={lease.status} />,
      ),
    },
    {
      label: "Purpose",
      value: editable(
        "Purpose",
        {
          control: { kind: "select", value: lease.purpose, options: purposeOptions },
          save: { on: "lease", field: "purpose" },
        },
        <span className="capitalize">{lease.purpose}</span>,
      ),
    },
    {
      label: "Lease / Rent Period",
      value: (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {editable(
            "Start date",
            {
              control: { kind: "date", value: lease.startDate, required: true },
              save: { on: "lease", field: "startDate" },
            },
            formatDate(lease.startDate),
          )}
          <span aria-hidden>→</span>
          {editable(
            "End date",
            {
              control: { kind: "date", value: lease.endDate, required: true },
              save: { on: "lease", field: "endDate" },
            },
            formatDate(lease.endDate),
          )}
        </span>
      ),
    },
    {
      label: "Grace ends",
      editOnly: !lease.graceEndDate,
      value: editable(
        "Grace ends",
        {
          control: { kind: "date", value: lease.graceEndDate ?? null },
          save: { on: "lease", field: "graceEndDate" },
        },
        lease.graceEndDate ? formatDate(lease.graceEndDate) : "—",
      ),
    },
    {
      label: "Locking period ends",
      editOnly: !lease.lockInEndDate,
      value: editable(
        "Locking period ends",
        {
          control: { kind: "date", value: lease.lockInEndDate ?? null },
          save: { on: "lease", field: "lockInEndDate" },
        },
        lease.lockInEndDate ? formatDate(lease.lockInEndDate) : "—",
      ),
    },
    {
      label: "Agreement type",
      value: editable(
        "Agreement type",
        {
          control: {
            kind: "select",
            value: lease.agreementLabel ?? null,
            options: agreementLabelOptions,
            clearable: true,
          },
          save: { on: "lease", field: "agreementLabel" },
        },
        lease.agreementLabel ? AGREEMENT[lease.agreementLabel] : "—",
      ),
    },
    {
      label: "Agreement type (other)",
      editOnly: lease.agreementLabel !== "other",
      value: editable(
        "Agreement type (other)",
        {
          control: { kind: "text", value: lease.agreementLabelOther ?? null },
          save: { on: "lease", field: "agreementLabelOther" },
        },
        lease.agreementLabelOther ?? "—",
      ),
    },
    {
      label: "Monthly Rental",
      value: firstTranche
        ? editable(
            "Monthly rental",
            {
              control: { kind: "money", value: firstTranche.monthlyRent },
              save: { on: "tranche", trancheId: firstTranche.id },
            },
            <span>
              {moneyText(firstTranche.monthlyRent)}
              {lease.tranches.length > 1 && (
                <span className="ml-1 text-muted-foreground text-xs">
                  (first of {lease.tranches.length} periods)
                </span>
              )}
            </span>,
          )
        : "—",
    },
    {
      label: "Advance payment",
      value: editable(
        "Advance payment",
        {
          control: {
            kind: "int",
            value: lease.advanceMonths ?? null,
            unit: "months",
          },
          save: { on: "lease", field: "advanceMonths" },
        },
        typeof lease.advanceMonths === "number" ? monthsText(lease.advanceMonths) : "—",
      ),
    },
    {
      label: "Advance payment amount",
      editOnly: !c?.advancePaymentAmount,
      value: editable(
        "Advance payment amount",
        {
          control: { kind: "money", value: c?.advancePaymentAmount ?? null },
          save: { on: "clause", field: "advancePaymentAmount" },
        },
        moneyText(c?.advancePaymentAmount),
      ),
    },
    {
      label: "Refundable deposit",
      value: editable(
        "Refundable deposit",
        {
          control: { kind: "money", value: lease.securityDeposit ?? null },
          save: { on: "lease", field: "securityDeposit" },
        },
        moneyText(lease.securityDeposit),
      ),
    },

    // ── Money & tax
    ...responsibleRows(
      "Applicability of WHT & other taxes",
      "taxApplicabilityBy",
      "taxApplicabilityNote",
      c?.taxApplicabilityBy,
      c?.taxApplicabilityNote,
    ),
    {
      label: "FX rate basis (USD)",
      editOnly: !c?.fxBasis,
      value: editable(
        "FX rate basis",
        {
          control: { kind: "text", value: c?.fxBasis ?? null },
          save: { on: "clause", field: "fxBasis" },
        },
        c?.fxBasis ?? "—",
      ),
    },
    {
      label: "First exchange rate",
      editOnly: typeof c?.firstFxRate !== "number",
      value: editable(
        "First exchange rate",
        {
          control: {
            kind: "decimal",
            value: c?.firstFxRate ?? null,
            unit: "LKR / USD",
          },
          save: { on: "clause", field: "firstFxRate" },
        },
        typeof c?.firstFxRate === "number"
          ? `LKR ${c.firstFxRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} / USD`
          : "—",
      ),
    },
    {
      label: "First exchange rate — note",
      editOnly: !c?.firstFxRateNote,
      value: editable(
        "First exchange rate note",
        {
          control: { kind: "text", value: c?.firstFxRateNote ?? null, wide: true },
          save: { on: "clause", field: "firstFxRateNote" },
        },
        c?.firstFxRateNote ?? "—",
      ),
    },

    // ── Occupancy / fit-out
    {
      label: "Minor repairs",
      editOnly: !c?.minorRepairsThreshold,
      value: editable(
        "Minor repairs threshold",
        {
          control: { kind: "money", value: c?.minorRepairsThreshold ?? null },
          save: { on: "clause", field: "minorRepairsThreshold" },
        },
        c?.minorRepairsThreshold
          ? `${moneyText(c.minorRepairsThreshold)} / job${perUnitSuffix}`
          : "—",
      ),
    },
    {
      label: "Penalty for delay handover",
      editOnly: !c?.handoverDelayPenalty,
      value: editable(
        "Penalty for delay handover",
        {
          control: { kind: "money", value: c?.handoverDelayPenalty ?? null },
          save: { on: "clause", field: "handoverDelayPenalty" },
        },
        c?.handoverDelayPenalty
          ? `${moneyText(c.handoverDelayPenalty)} / day${perUnitSuffix}`
          : "—",
      ),
    },
    {
      label: "Maintenance & cleanliness",
      editOnly: !c?.maintenanceText,
      value: editable(
        "Maintenance & cleanliness",
        {
          control: { kind: "textarea", value: c?.maintenanceText ?? null },
          save: { on: "clause", field: "maintenanceText" },
        },
        <span className="whitespace-pre-line">{c?.maintenanceText ?? "—"}</span>,
      ),
    },
    ...responsibleRows(
      "Management fees paid by",
      "managementFeesBy",
      "managementFeesNote",
      c?.managementFeesBy,
      c?.managementFeesNote,
    ),
    ...responsibleRows(
      "Service charges paid by",
      "serviceChargesBy",
      "serviceChargesNote",
      c?.serviceChargesBy,
      c?.serviceChargesNote,
    ),
    ...responsibleRows(
      "A/C service by",
      "acServiceBy",
      "acServiceNote",
      c?.acServiceBy,
      c?.acServiceNote,
    ),
    {
      label: "A/C service period",
      editOnly: !c?.acServicePeriod,
      value: editable(
        "A/C service period",
        {
          control: { kind: "text", value: c?.acServicePeriod ?? null },
          save: { on: "clause", field: "acServicePeriod" },
        },
        c?.acServicePeriod ?? "—",
      ),
    },
    {
      label: "Additional charges",
      editOnly: !c?.additionalCharges,
      value: editable(
        "Additional charges",
        {
          control: { kind: "text", value: c?.additionalCharges ?? null, wide: true },
          save: { on: "clause", field: "additionalCharges" },
        },
        c?.additionalCharges ?? "—",
      ),
    },

    // ── Term controls
    {
      label: "Sub-letting",
      editOnly: !c?.sublettingAllowed,
      value: editable(
        "Sub-letting",
        {
          control: {
            kind: "select",
            value: c?.sublettingAllowed ?? null,
            options: sublettingOptions,
            clearable: true,
          },
          save: { on: "clause", field: "sublettingAllowed" },
        },
        c?.sublettingAllowed ? SUBLETTING[c.sublettingAllowed] : "—",
      ),
    },
    {
      label: "Sub-letting — note",
      editOnly: !c?.sublettingNote,
      value: editable(
        "Sub-letting note",
        {
          control: { kind: "text", value: c?.sublettingNote ?? null, wide: true },
          save: { on: "clause", field: "sublettingNote" },
        },
        c?.sublettingNote ?? "—",
      ),
    },
    {
      label: "Refundable deposit credited to",
      editOnly: !c?.depositRefundTo,
      value: editable(
        "Refundable deposit credited to",
        {
          control: {
            kind: "select",
            value: c?.depositRefundTo ?? null,
            options: depositRefundOptions,
            clearable: true,
          },
          save: { on: "clause", field: "depositRefundTo" },
        },
        c?.depositRefundTo ? DEPOSIT_REFUND[c.depositRefundTo] : "—",
      ),
    },
    {
      label: "Refundable deposit credited to (other)",
      editOnly: c?.depositRefundTo !== "other",
      value: editable(
        "Refundable deposit credited to (other)",
        {
          control: { kind: "text", value: c?.depositRefundOther ?? null },
          save: { on: "clause", field: "depositRefundOther" },
        },
        c?.depositRefundOther ?? "—",
      ),
    },
    {
      label: "Prior notice of termination",
      editOnly: typeof c?.terminationNoticeMonths !== "number",
      value: editable(
        "Prior notice of termination",
        {
          control: {
            kind: "int",
            value: c?.terminationNoticeMonths ?? null,
            unit: "months",
          },
          save: { on: "clause", field: "terminationNoticeMonths" },
        },
        typeof c?.terminationNoticeMonths === "number"
          ? monthsText(c.terminationNoticeMonths)
          : "—",
      ),
    },
    {
      label: "Locking period",
      editOnly: !c?.lockInPeriodText,
      value: editable(
        "Locking period",
        {
          control: { kind: "text", value: c?.lockInPeriodText ?? null, wide: true },
          save: { on: "clause", field: "lockInPeriodText" },
        },
        c?.lockInPeriodText ?? "—",
      ),
    },
    {
      label: "Penalty for early termination",
      editOnly: !c?.earlyTerminationPenalty,
      value: editable(
        "Penalty for early termination",
        {
          control: {
            kind: "text",
            value: c?.earlyTerminationPenalty ?? null,
            wide: true,
          },
          save: { on: "clause", field: "earlyTerminationPenalty" },
        },
        c?.earlyTerminationPenalty ?? "—",
      ),
    },
    {
      label: "Notice of renewal",
      editOnly: typeof c?.renewalNoticeMonths !== "number",
      value: editable(
        "Notice of renewal",
        {
          control: {
            kind: "int",
            value: c?.renewalNoticeMonths ?? null,
            unit: "months",
          },
          save: { on: "clause", field: "renewalNoticeMonths" },
        },
        typeof c?.renewalNoticeMonths === "number"
          ? monthsText(c.renewalNoticeMonths)
          : "—",
      ),
    },

    // ── Money headline
    {
      label: "Legal fees",
      value: editable(
        "Legal fees",
        {
          control: { kind: "money", value: lease.legalFees ?? null },
          save: { on: "lease", field: "legalFees" },
        },
        moneyText(lease.legalFees),
      ),
    },
    {
      label: "Legal fees — note",
      editOnly: !c?.legalFeesNote,
      value: editable(
        "Legal fees note",
        {
          control: { kind: "text", value: c?.legalFeesNote ?? null, wide: true },
          save: { on: "clause", field: "legalFeesNote" },
        },
        c?.legalFeesNote ?? "—",
      ),
    },
    {
      label: "Stamp duty",
      value: editable(
        "Stamp duty",
        {
          control: { kind: "money", value: lease.stampDuty ?? null },
          save: { on: "lease", field: "stampDuty" },
        },
        moneyText(lease.stampDuty),
      ),
    },
    {
      label: "Stamp duty — note",
      editOnly: !c?.stampDutyNote,
      value: editable(
        "Stamp duty note",
        {
          control: { kind: "text", value: c?.stampDutyNote ?? null, wide: true },
          save: { on: "clause", field: "stampDutyNote" },
        },
        c?.stampDutyNote ?? "—",
      ),
    },

    // ── Operational
    {
      label: "Payment frequency",
      value: editable(
        "Payment frequency",
        {
          control: {
            kind: "select",
            value: lease.paymentCadence,
            options: cadenceOptions,
          },
          save: { on: "lease", field: "paymentCadence" },
        },
        <span className="capitalize">{lease.paymentCadence}</span>,
      ),
    },
    {
      label: "Default payment method",
      value: editable(
        "Default payment method",
        {
          control: {
            kind: "select",
            value: lease.defaultPaymentMethod,
            options: paymentMethodOptions,
          },
          save: { on: "lease", field: "defaultPaymentMethod" },
        },
        <span className="capitalize">
          {lease.defaultPaymentMethod.replace(/_/g, " ")}
        </span>,
      ),
    },
  ];

  return (
    <Card>
      <CardContent className="px-0">
        <LeaseDetailsRows leaseId={lease.id} rows={rows} />
      </CardContent>
    </Card>
  );
}
