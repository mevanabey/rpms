/**
 * DB row → core type converters.
 *
 * Postgres `numeric` comes back as `string` (so we don't lose precision on
 * extreme values); the core domain types use `number` for Money.amount, so we
 * cast here at the boundary. Anything beyond IEEE-754 safe range loses
 * precision — fine for rents up to ~9×10¹⁵ LKR, which is several universes.
 */

import type {
  Currency,
  Lease,
  LeasePartyRole,
  LedgerEntry,
  Money,
  Notification,
  Obligation,
  OnboardingStage,
  Party,
  Property,
  RentScheduleTranche,
  Unit,
} from "@/core/types";

import {
  parseAgreementLabel,
  parseLeaseClauses,
} from "@/server/validation/lease-clauses";

import type {
  document as documentTable,
  ledgerEntry as ledgerEntryTable,
  lease as leaseTable,
  leasePartyRoleTable,
  leaseUnit as leaseUnitTable,
  obligation as obligationTable,
  party as partyTable,
  property as propertyTable,
  rentScheduleTranche as rentScheduleTrancheTable,
  unit as unitTable,
} from "@/server/db/schema";

// Drizzle-inferred row types (with `$inferSelect`).
type PropertyRow = typeof propertyTable.$inferSelect;
type UnitRow = typeof unitTable.$inferSelect;
type PartyRow = typeof partyTable.$inferSelect;
type LeaseRow = typeof leaseTable.$inferSelect;
type RentScheduleTrancheRow = typeof rentScheduleTrancheTable.$inferSelect;
type LeasePartyRoleRow = typeof leasePartyRoleTable.$inferSelect;
type LeaseUnitRow = typeof leaseUnitTable.$inferSelect;
type ObligationRow = typeof obligationTable.$inferSelect;
type LedgerEntryRow = typeof ledgerEntryTable.$inferSelect;
type DocumentRow = typeof documentTable.$inferSelect;

const numFromStr = (s: string | null | undefined): number | undefined =>
  s === null || s === undefined ? undefined : Number(s);

function money(amount: string | null, currency: Currency | null): Money | undefined {
  if (amount === null || currency === null) return undefined;
  return { amount: Number(amount), currency };
}

function requireMoney(amount: string, currency: Currency): Money {
  return { amount: Number(amount), currency };
}

export function toProperty(row: PropertyRow): Property {
  return {
    id: row.id,
    name: row.name,
    addressLine: row.addressLine,
    city: row.city,
    district: row.district ?? undefined,
    lotNo: row.lotNo ?? undefined,
    planNo: row.planNo ?? undefined,
    perches: numFromStr(row.perches),
    asstNo: row.asstNo ?? undefined,
  };
}

export function toUnit(row: UnitRow): Unit {
  return {
    id: row.id,
    propertyId: row.propertyId,
    label: row.label,
    type: row.type,
    floor: row.floor ?? undefined,
    areaSqft: row.areaSqft ?? undefined,
    bedrooms: row.bedrooms ?? undefined,
    status: row.status,
  };
}

export function toParty(row: PartyRow): Party {
  return {
    id: row.id,
    kind: row.kind,
    displayName: row.displayName,
    legalName: row.legalName ?? undefined,
    nicOrPassport: row.nicOrPassport ?? undefined,
    companyRegNo: row.companyRegNo ?? undefined,
    emails: row.emails ?? [],
    phones: row.phones ?? [],
    address: row.address ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export function toTranche(row: RentScheduleTrancheRow): RentScheduleTranche {
  return {
    id: row.id,
    sequence: row.sequence,
    startDate: row.startDate,
    endDate: row.endDate,
    monthlyRent: requireMoney(row.monthlyRentAmount, row.monthlyRentCurrency),
    advanceSetoff: money(row.advanceSetoffAmount, row.advanceSetoffCurrency),
    dueDayOfMonth: row.dueDayOfMonth,
    paymentDescription: row.paymentDescription ?? undefined,
    fxRateLkrPerUsd: numFromStr(row.fxRateLkrPerUsd),
  };
}

export function toLeasePartyRole(row: LeasePartyRoleRow): LeasePartyRole {
  return { partyId: row.partyId, role: row.role, userId: row.userId ?? undefined };
}

export function toObligation(row: ObligationRow): Obligation {
  return {
    id: row.id,
    leaseId: row.leaseId,
    ownerPartyId: row.ownerPartyId ?? undefined,
    kind: row.kind,
    dueDate: row.dueDate,
    amount: money(row.amountValue, row.amountCurrency),
    status: row.status,
    sourceClause: row.sourceClause ?? undefined,
  };
}

export function toLedgerEntry(row: LedgerEntryRow): LedgerEntry {
  return {
    id: row.id,
    leaseId: row.leaseId,
    obligationId: row.obligationId ?? undefined,
    kind: row.kind,
    amount: requireMoney(row.amountValue, row.amountCurrency),
    direction: row.direction,
    counterpartyPartyId: row.counterpartyPartyId,
    dueDate: row.dueDate,
    paidDate: row.paidDate ?? undefined,
    paymentMethod: row.paymentMethod ?? undefined,
    reference: row.reference ?? undefined,
    notes: row.notes ?? undefined,
  };
}

/**
 * Lease with its joined children stitched in. Caller passes nested rows from
 * a `db.query.lease.findMany({ with: { ... } })` or assembles via separate
 * queries — either way we expect these collections.
 */
export interface LeaseWithJoins {
  lease: LeaseRow;
  tranches: RentScheduleTrancheRow[];
  partyRoles: LeasePartyRoleRow[];
  units: LeaseUnitRow[];
}

export function toLease({
  lease: row,
  tranches,
  partyRoles,
  units,
}: LeaseWithJoins): Lease {
  // Lessor/lessee filtered out of additionalRoles (those are first-class fields).
  const extraRoles = partyRoles
    .filter((r) => r.role !== "lessor" && r.role !== "lessee")
    .map(toLeasePartyRole);

  return {
    id: row.id,
    propertyId: row.propertyId,
    unitIds: units.map((u) => u.unitId),
    lessorPartyId: row.lessorPartyId,
    lesseePartyId: row.lesseePartyId,
    kind: row.kind,
    purpose: row.purpose,
    agreementLabel: parseAgreementLabel(row.agreementLabel),
    agreementLabelOther: row.agreementLabelOther ?? undefined,
    startDate: row.startDate,
    endDate: row.endDate,
    graceEndDate: row.graceEndDate ?? undefined,
    lockInEndDate: row.lockInEndDate ?? undefined,
    advanceMonths: row.advanceMonths ?? undefined,
    occupancyCap: row.occupancyCap ?? undefined,
    status: row.status,
    paymentCadence: row.paymentCadence,
    defaultPaymentMethod: row.defaultPaymentMethod,
    securityDeposit: money(row.securityDepositAmount, row.securityDepositCurrency),
    stampDuty: money(row.stampDutyAmount, row.stampDutyCurrency),
    legalFees: money(row.legalFeesAmount, row.legalFeesCurrency),
    tranches: tranches
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map(toTranche),
    clauses: parseLeaseClauses(row.clauses),
    additionalRoles: extraRoles.length ? extraRoles : undefined,
    parentLeaseId: row.parentLeaseId ?? undefined,
    importMeta: parseImportMeta(row.importMeta),
    signedLeasePath: row.signedLeasePath ?? undefined,
    signedLeaseUploadedAt: row.signedLeaseUploadedAt
      ? row.signedLeaseUploadedAt.toISOString()
      : undefined,
    onboardingStage: parseOnboardingStage(row.onboardingStage),
    agreementPath: row.agreementPath ?? undefined,
    agreementGeneratedAt: row.agreementGeneratedAt
      ? row.agreementGeneratedAt.toISOString()
      : undefined,
    lawyerEmailSentAt: row.lawyerEmailSentAt
      ? row.lawyerEmailSentAt.toISOString()
      : undefined,
    advisorEmailSentAt: row.advisorEmailSentAt
      ? row.advisorEmailSentAt.toISOString()
      : undefined,
    accountsEmailSentAt: row.accountsEmailSentAt
      ? row.accountsEmailSentAt.toISOString()
      : undefined,
  };
}

function parseOnboardingStage(raw: string | null): OnboardingStage | undefined {
  if (raw === "agreement_ready" || raw === "emails_sent" || raw === "at_accounts") return raw;
  return undefined;
}

/** Notification mapping: deferred — no schema yet. */
export type NotificationStub = Notification;

function parseImportMeta(
  raw: unknown,
): Record<string, unknown> | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return undefined;
}

/** Document mapping (Phase 02). */
export function toDocument(row: DocumentRow) {
  return {
    id: row.id,
    kind: row.kind,
    leaseId: row.leaseId ?? undefined,
    partyId: row.partyId ?? undefined,
    blobUrl: row.blobUrl,
    sha256: row.sha256,
    filename: row.filename,
    mime: row.mime,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    signedStatus: row.signedStatus ?? undefined,
    signedAt: row.signedAt?.toISOString(),
    esigEnvelopeId: row.esigEnvelopeId ?? undefined,
  };
}
