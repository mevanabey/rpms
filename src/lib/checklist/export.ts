/**
 * Checklist **export** — the mirror image of `parse.ts` / `build-lease.ts`.
 *
 *   Lease (+ property, units, parties)
 *     ↓  buildLeaseChecklistWorkbook
 *   .xlsx laid out like the firm's own check lists (docs/new/checklists)
 *
 * Two blocks, exactly as the firm's files:
 *
 *   1. a label → value list, one row per checklist question
 *   2. a rent-schedule table (Period | Monthly Rent | Rent for Period |
 *      Payment method | Total Rent | Refundable Deposit | Stamp Duty |
 *      Legal fees | Exchange rate)
 *
 * Labels come from `FIELD_DEFS` — the same vocabulary the importer matches on
 * — so an exported checklist re-imports cleanly through `/admin/import`.
 *
 * Note: the workbook carries structure (column widths, number cells) but no
 * cell styling — the bundled SheetJS build doesn't write fonts, fills or
 * borders.
 */

import * as XLSX from "xlsx";

import type { Lease, Money, Party, Property, Unit } from "@/core/types";

const RESPONSIBLE: Record<string, string> = {
  lessor: "Lessor",
  lessee: "Lessee",
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
  lessee: "Lessee",
  lessor: "Lessor",
  other: "Other",
};

const AGREEMENT: Record<string, string> = {
  lease_agreement: "Lease Agreement",
  rental_agreement: "Rent Agreement",
  other: "Other",
};

export interface ChecklistExportInput {
  lease: Lease;
  property?: Property;
  units: Unit[];
  parties: Party[];
}

export interface ChecklistExportOutput {
  /** Suggested download name, e.g. "Check List - TRIZEN - 2026-08-23.xlsx". */
  fileName: string;
  /** The workbook, base64-encoded (server action → browser download). */
  base64: string;
}

// ─────────────────────────────────────────────────────── formatting

/** 2026-03-26 → 26.03.2026 — the firm writes every checklist date this way. */
function dmy(iso: string | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

function amountText(m: Money | undefined): string {
  if (!m) return "";
  const n = m.amount.toLocaleString("en-US");
  return m.currency === "USD" ? `USD ${n}` : `Rs. ${n}`;
}

function monthsText(n: number | undefined): string {
  return typeof n === "number" ? `${n} month${n === 1 ? "" : "s"}` : "";
}

function partyText(p: Party | undefined): string {
  if (!p) return "";
  const name = p.legalName?.trim() || p.displayName;
  const id = p.kind === "company" ? p.companyRegNo : p.nicOrPassport;
  return id ? `${name} (${id})` : name;
}

function joinNote(head: string, note: string | undefined): string {
  const tail = note?.trim();
  if (!head) return tail ?? "";
  if (!tail || tail.toLowerCase() === head.toLowerCase()) return head;
  return `${head} — ${tail}`;
}

/** Whole months in [start, end] inclusive, the way the firm counts a period. */
function monthsBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1
  );
}

/**
 * Rent line the firm writes into the single "Monthly Rental" cell: one figure
 * for a flat lease, or "Rs. X/month (a-b); Rs. Y/month (c-d)" when the lease
 * escalates.
 */
function monthlyRentalText(lease: Lease): string {
  if (lease.tranches.length === 0) return "";
  if (lease.tranches.length === 1) {
    return `${amountText(lease.tranches[0].monthlyRent)}/month`;
  }
  return lease.tranches
    .map(
      (t) =>
        `${amountText(t.monthlyRent)}/month (${dmy(t.startDate)}-${dmy(t.endDate)})`,
    )
    .join("; ");
}

// ─────────────────────────────────────────────────────── the checklist rows

type Row = (string | number)[];

function metadataRows(input: ChecklistExportInput): Row[] {
  const { lease, property, units } = input;
  const byId = new Map(input.parties.map((p) => [p.id, p]));
  const c = lease.clauses;
  const roles = lease.additionalRoles ?? [];
  const roleParty = (role: string) => {
    const ref = roles.find((r) => r.role === role);
    return ref ? byId.get(ref.partyId) : undefined;
  };
  const lessor = byId.get(lease.lessorPartyId);
  const lessee = byId.get(lease.lesseePartyId);
  const leaseUnits = lease.unitIds
    .map((id) => units.find((u) => u.id === id))
    .filter((u): u is Unit => Boolean(u));
  const bedrooms = leaseUnits
    .map((u) => u.bedrooms)
    .filter((b): b is number => typeof b === "number");
  const counterpartyLawyer =
    lease.kind === "sub" ? roleParty("lessee_lawyer") : roleParty("lessor_lawyer");
  const perUnit = lease.unitIds.length > 1 ? " per unit" : "";

  const rows: Row[] = [
    [
      "Premises address",
      property ? [property.addressLine, property.city].filter(Boolean).join(", ") : "",
    ],
    ["Property Investment Advisor", roleParty("advisor")?.displayName ?? ""],
    ["CTP Lawyer", c?.ctpLawyerName ?? ""],
    ["Landlord's Lawyer", counterpartyLawyer?.displayName ?? ""],
    [
      "Lease / Rent Agreement",
      lease.agreementLabel === "other"
        ? (lease.agreementLabelOther ?? "Other")
        : lease.agreementLabel
          ? AGREEMENT[lease.agreementLabel]
          : "",
    ],
    ["Lessor's Name & ID", partyText(lessor)],
    ["Lessor's Address", lessor?.address ?? ""],
    ["Lessee's Name & ID", partyText(lessee)],
    ["Lessee's Current Employer", c?.lesseeEmployer ?? ""],
    ["Lessee's Address", lessee?.address ?? ""],
    ["Apartment name", property?.name ?? ""],
    ["Unit Nos.", leaseUnits.map((u) => u.label).join(", ")],
    ["Lease / Rent Period", `${dmy(lease.startDate)} to ${dmy(lease.endDate)}`],
    ["Monthly Rental", monthlyRentalText(lease)],
    [
      "Advance payment",
      typeof lease.advanceMonths === "number"
        ? monthsText(lease.advanceMonths)
        : amountText(c?.advancePaymentAmount),
    ],
    ["Refundable deposit", amountText(lease.securityDeposit)],
    [
      "Applicability of WHT and any other taxes",
      joinNote(
        c?.taxApplicabilityBy ? RESPONSIBLE[c.taxApplicabilityBy] : "",
        c?.taxApplicabilityNote,
      ),
    ],
    ["FX rate basis (USD)", c?.fxBasis ?? ""],
    [
      "First exchange rate (LKR)",
      typeof c?.firstFxRate === "number" ? c.firstFxRate : "",
    ],
    ["No. of bedrooms", bedrooms.length > 0 ? Math.max(...bedrooms) : ""],
    [
      "No. of people can accommodate",
      typeof lease.occupancyCap === "number" ? lease.occupancyCap : "",
    ],
    [
      "Minor repairs",
      c?.minorRepairsThreshold
        ? `${amountText(c.minorRepairsThreshold)} per job${perUnit}`
        : "",
    ],
    [
      "Penalty for delay handover",
      c?.handoverDelayPenalty
        ? `${amountText(c.handoverDelayPenalty)} per day${perUnit}`
        : "",
    ],
    ["Maintenance & cleanliness clause", c?.maintenanceText ?? ""],
    [
      "Management fees paid by",
      joinNote(
        c?.managementFeesBy ? RESPONSIBLE[c.managementFeesBy] : "",
        c?.managementFeesNote,
      ),
    ],
    [
      "Service charges paid by",
      joinNote(
        c?.serviceChargesBy ? RESPONSIBLE[c.serviceChargesBy] : "",
        c?.serviceChargesNote,
      ),
    ],
    [
      "A/C Service by",
      joinNote(c?.acServiceBy ? RESPONSIBLE[c.acServiceBy] : "", c?.acServiceNote),
    ],
    ["A/C service period", c?.acServicePeriod ?? ""],
    ["Additional Charges", c?.additionalCharges ?? ""],
    [
      "Sub-letting",
      joinNote(
        c?.sublettingAllowed ? SUBLETTING[c.sublettingAllowed] : "",
        c?.sublettingNote,
      ),
    ],
    [
      "Refundable deposit credited to",
      c?.depositRefundTo === "other"
        ? (c.depositRefundOther ?? "Other")
        : c?.depositRefundTo
          ? DEPOSIT_REFUND[c.depositRefundTo]
          : "",
    ],
    ["Prior notice of termination", monthsText(c?.terminationNoticeMonths)],
    [
      "Locking period",
      c?.lockInPeriodText ??
        (lease.lockInEndDate ? `Until ${dmy(lease.lockInEndDate)}` : ""),
    ],
    ["Penalty for early termination", c?.earlyTerminationPenalty ?? ""],
    ["Notice of renewal", monthsText(c?.renewalNoticeMonths)],
    ["Legal fees", lease.legalFees ? amountText(lease.legalFees) : (c?.legalFeesNote ?? "")],
    ["Stamp duty", lease.stampDuty ? amountText(lease.stampDuty) : (c?.stampDutyNote ?? "")],
  ];

  return rows;
}

/** Months of rent covered by one payment at the lease's cadence. */
function monthsPerPayment(cadence: Lease["paymentCadence"]): number {
  switch (cadence) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "biannual":
      return 6;
  }
}

function scheduleRows(input: ChecklistExportInput): Row[] {
  const { lease } = input;
  if (lease.tranches.length === 0) return [];

  const currency = lease.tranches[0].monthlyRent.currency;
  const perPayment = monthsPerPayment(lease.paymentCadence);
  const cadenceText =
    lease.paymentCadence === "monthly"
      ? "Every month"
      : lease.paymentCadence === "quarterly"
        ? "Every three months"
        : "Every six months";

  // Total consideration across the term — only meaningful when every tranche
  // is in the same currency (mixed-currency leases leave the cell blank).
  const sameCurrency = lease.tranches.every(
    (t) => t.monthlyRent.currency === currency,
  );
  const totalRent = sameCurrency
    ? lease.tranches.reduce(
        (sum, t) => sum + t.monthlyRent.amount * monthsBetween(t.startDate, t.endDate),
        0,
      )
    : undefined;

  const heading = lease.kind === "sub" ? "SUB-TENANCY AGREEMENT" : "RENT SCHEDULE";

  // The firm's files name this column after the payment cycle — "Three
  // Months Rent" on quarterly residential checklists, "Rent for Period" on
  // monthly commercial ones. Both spellings are what the importer looks for.
  const periodHeader =
    lease.paymentCadence === "quarterly"
      ? "Three Months Rent"
      : lease.paymentCadence === "biannual"
        ? "Rent for Period (Six Months)"
        : "Rent for Period";

  const header: Row = [
    "Period",
    "Monthly Rent",
    periodHeader,
    "Payment method",
    "Total Rent",
    "Refundable Deposit",
    "Stamp Duty",
    "Legal fees",
    "Exchange rate",
  ];
  // Sub-header carrying the currency of each money column — the importer reads
  // currency from this row when the header itself doesn't state one.
  const units: Row = [
    "",
    currency,
    currency,
    "",
    currency,
    lease.securityDeposit?.currency ?? currency,
    lease.stampDuty?.currency ?? "LKR",
    lease.legalFees?.currency ?? "LKR",
    "LKR / USD",
  ];

  const body: Row[] = lease.tranches.map((t, i) => {
    const months = monthsBetween(t.startDate, t.endDate);
    const paymentNote = t.paymentDescription
      ? t.paymentDescription
      : t.advanceSetoff
        ? `${cadenceText}; advance set-off ${amountText(t.advanceSetoff)}/month`
        : cadenceText;
    return [
      `${dmy(t.startDate)} - ${dmy(t.endDate)}`,
      t.monthlyRent.amount,
      // Monthly cadence → the whole tranche; otherwise one payment cycle.
      t.monthlyRent.amount * (perPayment === 1 ? months : Math.min(perPayment, months)),
      paymentNote,
      i === 0 && totalRent !== undefined ? totalRent : "",
      i === 0 && lease.securityDeposit ? lease.securityDeposit.amount : "",
      i === 0 && lease.stampDuty ? lease.stampDuty.amount : "",
      i === 0 && lease.legalFees ? lease.legalFees.amount : "",
      i === 0 && typeof lease.clauses?.firstFxRate === "number"
        ? lease.clauses.firstFxRate
        : (t.fxRateLkrPerUsd ?? ""),
    ];
  });

  return [[], [heading], header, units, ...body];
}

// ─────────────────────────────────────────────────────── workbook

function safeFileNamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

export function buildLeaseChecklistWorkbook(
  input: ChecklistExportInput,
  /** Stamped into the file name. Pass the caller's clock — this stays pure. */
  today: string,
): ChecklistExportOutput {
  const rows: Row[] = [...metadataRows(input), ...scheduleRows(input)];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 42 },
    { wch: 46 },
    { wch: 22 },
    { wch: 34 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  const base64 = XLSX.write(book, { type: "base64", bookType: "xlsx" });

  const lessee = input.parties.find((p) => p.id === input.lease.lesseePartyId);
  const subject =
    input.property?.name ?? lessee?.displayName ?? input.lease.id.slice(0, 8);
  const kind = input.lease.kind === "sub" ? "Sub Lease" : "Lease";

  return {
    fileName: `Check List - ${kind} - ${safeFileNamePart(subject)} - ${today}.xlsx`,
    base64,
  };
}
