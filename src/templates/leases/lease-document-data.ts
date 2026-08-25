/**
 * Normalised shape that drives the lease document template. The same
 * shape works for both a real `Lease` (persisted) and a draft lease
 * (still in the wizard / demo store), so the template never has to care
 * whether the source is finalised or in-progress.
 */

import type {
  Lease,
  LeaseClauses,
  LeasePartyRole,
  Money,
  Party,
  PartyRole,
  PaymentCadence,
  PaymentMethod,
  Property,
  Unit,
  RentScheduleTranche,
  LeaseKind,
  LeasePurpose,
  AgreementLabel,
} from "@/core/types";

export interface DocumentParty {
  id: string;
  displayName: string;
  legalName?: string;
  idNumber?: string;
  address?: string;
  emails?: string[];
  phones?: string[];
  role: PartyRole | "lessor" | "lessee";
}

export interface DocumentUnit {
  id: string;
  label: string;
  type?: string;
  floor?: string | number;
  areaSqft?: number;
  bedrooms?: number;
}

export interface DocumentTranche {
  sequence: number;
  startDate: string;
  endDate: string;
  monthlyRent: Money;
  advanceSetoff?: Money;
  dueDayOfMonth: number;
  paymentDescription?: string;
}

export interface LeaseDocumentData {
  /** Lease id when finalised; draft id when generated from the wizard. */
  id: string;
  isDraft: boolean;
  agreementTitle: string;
  kind: LeaseKind;
  purpose: LeasePurpose;
  property: { name: string; addressLine: string; city?: string; lotNo?: string; planNo?: string; perches?: number };
  units: DocumentUnit[];
  lessor: DocumentParty;
  lessee: DocumentParty;
  additionalParties: DocumentParty[];
  startDate: string;
  endDate: string;
  advanceMonths?: number;
  occupancyCap?: number;
  lockInEndDate?: string;
  paymentCadence: PaymentCadence;
  defaultPaymentMethod: PaymentMethod;
  securityDeposit?: Money;
  stampDuty?: Money;
  legalFees?: Money;
  tranches: DocumentTranche[];
  clauses?: LeaseClauses;
  generatedAt: string; // ISO timestamp
  /** Optional per-party signature data-URLs (base64 PNG). */
  signatures?: Record<string, { dataUrl: string; signedAt: string }>;
}

// ────────────────────────────────────────────── Lease → DocumentData

export function fromLease(
  lease: Lease,
  property: Property | undefined,
  units: Unit[],
  parties: Map<string, Party>,
  signatures?: Record<string, { dataUrl: string; signedAt: string }>,
): LeaseDocumentData {
  const lessorParty = parties.get(lease.lessorPartyId);
  const lesseeParty = parties.get(lease.lesseePartyId);
  return {
    id: lease.id,
    isDraft: false,
    agreementTitle: agreementTitleFor(lease.agreementLabel, lease.kind, lease.purpose),
    kind: lease.kind,
    purpose: lease.purpose,
    property: property
      ? {
          name: property.name,
          addressLine: property.addressLine,
          city: property.city,
          lotNo: property.lotNo,
          planNo: property.planNo,
          perches: property.perches,
        }
      : { name: "—", addressLine: "—" },
    units: units
      .filter((u) => lease.unitIds.includes(u.id))
      .map<DocumentUnit>((u) => ({
        id: u.id,
        label: u.label,
        type: u.type,
        floor: u.floor,
        areaSqft: u.areaSqft,
        bedrooms: u.bedrooms,
      })),
    lessor: documentPartyFrom(lessorParty, "lessor"),
    lessee: documentPartyFrom(lesseeParty, "lessee"),
    additionalParties: (lease.additionalRoles ?? [])
      .map((r: LeasePartyRole) => documentPartyFrom(parties.get(r.partyId), r.role))
      .filter((p): p is DocumentParty => Boolean(p)),
    startDate: lease.startDate,
    endDate: lease.endDate,
    advanceMonths: lease.advanceMonths,
    occupancyCap: lease.occupancyCap,
    lockInEndDate: lease.lockInEndDate,
    paymentCadence: lease.paymentCadence,
    defaultPaymentMethod: lease.defaultPaymentMethod,
    securityDeposit: lease.securityDeposit,
    stampDuty: lease.stampDuty,
    legalFees: lease.legalFees,
    tranches: lease.tranches.map<DocumentTranche>((t: RentScheduleTranche) => ({
      sequence: t.sequence,
      startDate: t.startDate,
      endDate: t.endDate,
      monthlyRent: t.monthlyRent,
      advanceSetoff: t.advanceSetoff,
      dueDayOfMonth: t.dueDayOfMonth,
      paymentDescription: t.paymentDescription,
    })),
    clauses: lease.clauses,
    generatedAt: new Date().toISOString(),
    signatures,
  };
}

// ────────────────────────────────────────────── Draft intent → DocumentData

interface DraftIntent {
  propertyId?: string;
  unitIds?: string[];
  lessorPartyId?: string;
  lesseePartyId?: string;
  kind?: LeaseKind;
  purpose?: LeasePurpose;
  agreementLabel?: AgreementLabel;
  agreementLabelOther?: string;
  startDate?: string;
  endDate?: string;
  advanceMonths?: number;
  occupancyCap?: number;
  paymentCadence?: PaymentCadence;
  defaultPaymentMethod?: PaymentMethod;
  securityDeposit?: Money;
  stampDuty?: Money;
  legalFees?: Money;
  tranches?: Array<{
    sequence: number;
    startDate: string;
    endDate: string;
    monthlyRent: Money;
    advanceSetoff?: Money;
    dueDayOfMonth: number;
    paymentDescription?: string;
  }>;
  clauses?: LeaseClauses;
  additionalRoles?: LeasePartyRole[];
}

export function fromDraftIntent(
  draftId: string,
  intent: Record<string, unknown>,
  property: Property | undefined,
  units: Unit[],
  parties: Map<string, Party>,
  signatures?: Record<string, { dataUrl: string; signedAt: string }>,
): LeaseDocumentData {
  const i = intent as DraftIntent;
  const kind = i.kind ?? "head";
  const purpose = i.purpose ?? "residential";
  const lessor = i.lessorPartyId ? parties.get(i.lessorPartyId) : undefined;
  const lessee = i.lesseePartyId ? parties.get(i.lesseePartyId) : undefined;
  const unitIds = i.unitIds ?? [];

  return {
    id: draftId,
    isDraft: true,
    agreementTitle: agreementTitleFor(i.agreementLabel, kind, purpose),
    kind,
    purpose,
    property: property
      ? {
          name: property.name,
          addressLine: property.addressLine,
          city: property.city,
          lotNo: property.lotNo,
          planNo: property.planNo,
          perches: property.perches,
        }
      : { name: "—", addressLine: "—" },
    units: units
      .filter((u) => unitIds.includes(u.id))
      .map<DocumentUnit>((u) => ({
        id: u.id,
        label: u.label,
        type: u.type,
        floor: u.floor,
        areaSqft: u.areaSqft,
        bedrooms: u.bedrooms,
      })),
    lessor: documentPartyFrom(lessor, "lessor"),
    lessee: documentPartyFrom(lessee, "lessee"),
    additionalParties: (i.additionalRoles ?? [])
      .map((r) => documentPartyFrom(parties.get(r.partyId), r.role))
      .filter((p): p is DocumentParty => Boolean(p)),
    startDate: i.startDate ?? "",
    endDate: i.endDate ?? "",
    advanceMonths: i.advanceMonths,
    occupancyCap: i.occupancyCap,
    paymentCadence: i.paymentCadence ?? "monthly",
    defaultPaymentMethod: i.defaultPaymentMethod ?? "lkr_transfer",
    securityDeposit: i.securityDeposit,
    stampDuty: i.stampDuty,
    legalFees: i.legalFees,
    tranches: (i.tranches ?? []).map<DocumentTranche>((t) => ({
      sequence: t.sequence,
      startDate: t.startDate,
      endDate: t.endDate,
      monthlyRent: t.monthlyRent,
      advanceSetoff: t.advanceSetoff,
      dueDayOfMonth: t.dueDayOfMonth,
      paymentDescription: t.paymentDescription,
    })),
    clauses: i.clauses,
    generatedAt: new Date().toISOString(),
    signatures,
  };
}

// ────────────────────────────────────────────── helpers

function documentPartyFrom(p: Party | undefined, role: DocumentParty["role"]): DocumentParty {
  if (!p) {
    return { id: "", displayName: "—", role };
  }
  return {
    id: p.id,
    displayName: p.displayName,
    legalName: p.legalName,
    idNumber: p.nicOrPassport ?? p.companyRegNo,
    address: p.address,
    emails: p.emails,
    phones: p.phones,
    role,
  };
}

function agreementTitleFor(
  label: AgreementLabel | undefined,
  kind: LeaseKind,
  purpose: LeasePurpose,
): string {
  if (label === "rental_agreement") return "Rental Agreement";
  if (label === "other") return "Tenancy Agreement";
  if (kind === "head") return "Indenture of Lease";
  if (purpose === "commercial") return "Commercial Lease Agreement";
  return "Lease Agreement";
}
