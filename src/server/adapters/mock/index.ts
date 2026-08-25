import type { Backend } from "@/core/services";
import type {
  LedgerEntry,
  Lease,
  LeasePartyRole,
  Notification,
  Obligation,
  Party,
  Property,
  RentScheduleTranche,
  Unit,
} from "@/core/types";
import type { ChecklistIntake } from "@/lib/checklist/build-lease";

import { mergeLeaseClauses } from "@/server/validation/lease-clauses";

import { deriveObligationsAndLedger } from "./derive";
import { LEASES, LEDGER, NOTIFICATIONS, OBLIGATIONS, PARTIES, PROPERTIES, UNITS } from "./seed";

function freshSeedState() {
  const derived = deriveObligationsAndLedger(LEASES);
  return {
    leases: [...LEASES] as Lease[],
    parties: [...PARTIES] as Party[],
    properties: [...PROPERTIES] as Property[],
    units: [...UNITS] as Unit[],
    obligations: [...OBLIGATIONS, ...derived.obligations] as Obligation[],
    ledger: [...LEDGER, ...derived.ledger] as LedgerEntry[],
    notifications: [...NOTIFICATIONS] as Notification[],
    deletedLeaseIds: new Set<string>(),
  };
}

// Module-scoped in-memory state. Resets on server restart — this is Phase 01.
// `mockAdmin.resetAll()` / `clearAll()` mutate this in place from the
// /admin/demo page.
const state = freshSeedState();

const norm = (v: string) => v.toLowerCase();

function mockId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function addMonthsIsoMock(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export const mockBackend: Backend = {
  leases: {
    async list(filter) {
      let out = state.leases.filter((l) => !state.deletedLeaseIds.has(l.id));
      if (filter?.status?.length) out = out.filter((l) => filter.status!.includes(l.status));
      if (filter?.propertyId) out = out.filter((l) => l.propertyId === filter.propertyId);
      if (filter?.cadence) out = out.filter((l) => l.paymentCadence === filter.cadence);
      if (filter?.search) {
        const q = norm(filter.search);
        out = out.filter((l) => norm(l.id).includes(q) || norm(l.propertyId).includes(q));
      }
      return out;
    },
    async get(id) {
      if (state.deletedLeaseIds.has(id)) return null;
      return state.leases.find((l) => l.id === id) ?? null;
    },
    async create(intent) {
      if (!intent.tranches?.length) {
        throw new Error("Cannot create a lease with zero tranches.");
      }
      const id = mockId("lease");
      const lease: Lease = {
        id,
        propertyId: intent.propertyId,
        unitIds: intent.unitIds,
        lessorPartyId: intent.lessorPartyId,
        lesseePartyId: intent.lesseePartyId,
        parentLeaseId: intent.parentLeaseId,
        kind: intent.kind,
        purpose: intent.purpose,
        agreementLabel: intent.agreementLabel,
        agreementLabelOther: intent.agreementLabelOther,
        status: intent.status ?? "draft",
        paymentCadence: intent.paymentCadence,
        defaultPaymentMethod: intent.defaultPaymentMethod,
        startDate: intent.startDate,
        endDate: intent.endDate,
        graceEndDate: intent.graceEndDate,
        lockInEndDate: intent.lockInEndDate,
        advanceMonths: intent.advanceMonths,
        occupancyCap: intent.occupancyCap,
        securityDeposit: intent.securityDeposit,
        stampDuty: intent.stampDuty,
        legalFees: intent.legalFees,
        clauses: intent.clauses,
        additionalRoles: intent.additionalRoles,
        tranches: intent.tranches.map((t) => ({ ...t, id: mockId("tr") })),
      };
      state.leases.push(lease);
      return lease;
    },
    async updateStatus(id, status) {
      const lease = state.leases.find((l) => l.id === id);
      if (!lease) throw new Error(`Lease ${id} not found`);
      lease.status = status;
      return lease;
    },
    async update(id, patch) {
      const lease = state.leases.find((l) => l.id === id);
      if (!lease || state.deletedLeaseIds.has(id)) throw new Error(`Lease ${id} not found`);
      if (patch.lessorPartyId !== undefined) lease.lessorPartyId = patch.lessorPartyId;
      if (patch.lesseePartyId !== undefined) lease.lesseePartyId = patch.lesseePartyId;
      if (patch.purpose !== undefined) lease.purpose = patch.purpose;
      if (patch.agreementLabel !== undefined) lease.agreementLabel = patch.agreementLabel ?? undefined;
      if (patch.agreementLabelOther !== undefined) lease.agreementLabelOther = patch.agreementLabelOther ?? undefined;
      if (patch.status !== undefined) lease.status = patch.status;
      if (patch.paymentCadence !== undefined) lease.paymentCadence = patch.paymentCadence;
      if (patch.defaultPaymentMethod !== undefined) lease.defaultPaymentMethod = patch.defaultPaymentMethod;
      if (patch.startDate !== undefined) lease.startDate = patch.startDate;
      if (patch.endDate !== undefined) lease.endDate = patch.endDate;
      if (patch.graceEndDate !== undefined) lease.graceEndDate = patch.graceEndDate ?? undefined;
      if (patch.lockInEndDate !== undefined) lease.lockInEndDate = patch.lockInEndDate ?? undefined;
      if (patch.advanceMonths !== undefined) lease.advanceMonths = patch.advanceMonths ?? undefined;
      if (patch.occupancyCap !== undefined) lease.occupancyCap = patch.occupancyCap ?? undefined;
      if (patch.securityDeposit !== undefined) lease.securityDeposit = patch.securityDeposit ?? undefined;
      if (patch.stampDuty !== undefined) lease.stampDuty = patch.stampDuty ?? undefined;
      if (patch.legalFees !== undefined) lease.legalFees = patch.legalFees ?? undefined;
      if (patch.clauses !== undefined) {
        lease.clauses = mergeLeaseClauses(lease.clauses, patch.clauses);
      }
      if (patch.unitIds !== undefined) {
        const unknown = patch.unitIds.filter(
          (uid) => !state.units.some((u) => u.id === uid && u.propertyId === lease.propertyId),
        );
        if (unknown.length > 0) {
          throw new Error(`Unit(s) not on this property: ${unknown.join(", ")}`);
        }
        lease.unitIds = [...patch.unitIds];
      }
      if (patch.additionalRoles !== undefined) {
        lease.additionalRoles = patch.additionalRoles.length
          ? patch.additionalRoles.map((r) => ({ ...r }))
          : undefined;
      }
      if (
        (patch.lessorPartyId !== undefined || patch.lesseePartyId !== undefined) &&
        lease.lessorPartyId === lease.lesseePartyId
      ) {
        throw new Error("Lessor and lessee must be different parties.");
      }
      return lease;
    },
    async updateTranche(leaseId, trancheId, patch) {
      const lease = state.leases.find((l) => l.id === leaseId);
      if (!lease || state.deletedLeaseIds.has(leaseId)) {
        throw new Error(`Lease ${leaseId} not found`);
      }
      const tranche = lease.tranches.find((t) => t.id === trancheId);
      if (!tranche) throw new Error(`Tranche ${trancheId} not found on lease ${leaseId}`);
      if (patch.startDate !== undefined) tranche.startDate = patch.startDate;
      if (patch.endDate !== undefined) tranche.endDate = patch.endDate;
      if (patch.monthlyRent !== undefined) tranche.monthlyRent = patch.monthlyRent;
      if (patch.advanceSetoff !== undefined) {
        tranche.advanceSetoff = patch.advanceSetoff ?? undefined;
      }
      if (patch.dueDayOfMonth !== undefined) tranche.dueDayOfMonth = patch.dueDayOfMonth;
      if (patch.paymentDescription !== undefined) {
        tranche.paymentDescription = patch.paymentDescription ?? undefined;
      }
      if (patch.fxRateLkrPerUsd !== undefined) {
        tranche.fxRateLkrPerUsd = patch.fxRateLkrPerUsd ?? undefined;
      }
      if (tranche.startDate > tranche.endDate) {
        throw new Error("Tranche start date must fall on or before its end date.");
      }
      return lease;
    },
    async softDelete(id) {
      const exists =
        state.leases.some((l) => l.id === id) && !state.deletedLeaseIds.has(id);
      if (!exists) throw new Error(`Lease ${id} not found`);
      state.deletedLeaseIds.add(id);
    },
    async attachSignedLease(id, storagePath) {
      const lease = state.leases.find((l) => l.id === id);
      if (!lease || state.deletedLeaseIds.has(id)) throw new Error(`Lease ${id} not found`);
      lease.signedLeasePath = storagePath;
      lease.signedLeaseUploadedAt = new Date().toISOString();
      lease.status = "active";
      return lease;
    },
    async setOnboardingStage(id, stage) {
      const lease = state.leases.find((l) => l.id === id);
      if (!lease || state.deletedLeaseIds.has(id)) throw new Error(`Lease ${id} not found`);
      lease.onboardingStage = stage ?? undefined;
      return lease;
    },
    async markAgreementGenerated(id, storagePath) {
      const lease = state.leases.find((l) => l.id === id);
      if (!lease || state.deletedLeaseIds.has(id)) throw new Error(`Lease ${id} not found`);
      lease.agreementPath = storagePath;
      lease.agreementGeneratedAt = new Date().toISOString();
      if (!lease.onboardingStage && lease.status === "draft") {
        lease.onboardingStage = "agreement_ready";
      }
      return lease;
    },
    async markLeaseEmailSent(id, kind) {
      const lease = state.leases.find((l) => l.id === id);
      if (!lease || state.deletedLeaseIds.has(id)) throw new Error(`Lease ${id} not found`);
      const now = new Date().toISOString();
      const lawyerSet = kind === "lawyer" || Boolean(lease.lawyerEmailSentAt);
      const advisorSet = kind === "advisor" || Boolean(lease.advisorEmailSentAt);
      if (kind === "lawyer") lease.lawyerEmailSentAt = now;
      else if (kind === "advisor") lease.advisorEmailSentAt = now;
      else lease.accountsEmailSentAt = now;
      if (kind === "accounts") {
        if (lease.onboardingStage === "emails_sent") lease.onboardingStage = "at_accounts";
      } else if (lawyerSet && advisorSet && lease.onboardingStage === "agreement_ready") {
        lease.onboardingStage = "emails_sent";
      }
      return lease;
    },
    async markLeaseActive(id) {
      const lease = state.leases.find((l) => l.id === id);
      if (!lease || state.deletedLeaseIds.has(id)) throw new Error(`Lease ${id} not found`);
      lease.status = "active";
      return lease;
    },
    async generateRentSchedule(id) {
      const lease = state.leases.find((l) => l.id === id);
      if (!lease || state.deletedLeaseIds.has(id)) throw new Error(`Lease ${id} not found`);
      if (lease.tranches.length === 0) return { created: 0, skipped: 0 };
      const existing = state.ledger.filter(
        (e) => e.leaseId === id && e.kind === "rent" && e.direction === "in",
      );
      const taken = new Set(existing.map((e) => e.dueDate));
      let created = 0;
      for (const t of lease.tranches) {
        let due = t.startDate;
        for (let i = 0; i < 120 && due <= t.endDate; i++) {
          if (!taken.has(due)) {
            state.ledger.push({
              id: mockId("led"),
              leaseId: id,
              counterpartyPartyId: lease.lesseePartyId,
              kind: "rent",
              direction: "in",
              amount: t.monthlyRent,
              dueDate: due,
            });
            taken.add(due);
            created++;
          }
          due = addMonthsIsoMock(due, 1);
        }
      }
      return { created, skipped: existing.length };
    },
  },

  parties: {
    async list(filter) {
      let out = state.parties;
      if (filter?.search) {
        const q = norm(filter.search);
        out = out.filter(
          (p) =>
            norm(p.displayName).includes(q) ||
            (p.legalName ? norm(p.legalName).includes(q) : false) ||
            p.emails.some((e) => norm(e).includes(q)),
        );
      }
      // role filter would join through lease.additionalRoles — skipped in mock for now
      return out;
    },
    async get(id) {
      return state.parties.find((p) => p.id === id) ?? null;
    },
    async create(input) {
      const trimmed = input.displayName.trim();
      if (!trimmed) throw new Error("Party display name is required.");
      const party: Party = {
        id: mockId("party"),
        kind: input.kind,
        displayName: trimmed,
        legalName: input.legalName?.trim() || undefined,
        nicOrPassport: input.nicOrPassport?.trim() || undefined,
        companyRegNo: input.companyRegNo?.trim() || undefined,
        emails: input.emails ?? [],
        phones: input.phones ?? [],
        address: input.address?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
      };
      state.parties.push(party);
      return party;
    },
    async update(id, patch) {
      const party = state.parties.find((p) => p.id === id);
      if (!party) throw new Error(`Party ${id} not found`);
      if (patch.kind !== undefined) party.kind = patch.kind;
      if (patch.displayName !== undefined) {
        const trimmed = patch.displayName.trim();
        if (!trimmed) throw new Error("Party display name is required.");
        party.displayName = trimmed;
      }
      if (patch.legalName !== undefined) party.legalName = patch.legalName?.trim() || undefined;
      if (patch.nicOrPassport !== undefined) {
        party.nicOrPassport = patch.nicOrPassport?.trim() || undefined;
      }
      if (patch.companyRegNo !== undefined) {
        party.companyRegNo = patch.companyRegNo?.trim() || undefined;
      }
      if (patch.emails !== undefined) party.emails = [...patch.emails];
      if (patch.phones !== undefined) party.phones = [...patch.phones];
      if (patch.address !== undefined) party.address = patch.address?.trim() || undefined;
      if (patch.notes !== undefined) party.notes = patch.notes?.trim() || undefined;
      return party;
    },
  },

  properties: {
    async listProperties() {
      return state.properties;
    },
    async getProperty(id) {
      return state.properties.find((p) => p.id === id) ?? null;
    },
    async listUnits(propertyId) {
      return propertyId ? state.units.filter((u) => u.propertyId === propertyId) : state.units;
    },
    async createProperty(input) {
      const property: Property = {
        id: mockId("prop"),
        name: input.name.trim(),
        addressLine: input.addressLine.trim(),
        city: input.city.trim(),
        district: input.district?.trim() || undefined,
        lotNo: input.lotNo?.trim() || undefined,
        planNo: input.planNo?.trim() || undefined,
        perches: input.perches,
        asstNo: input.asstNo?.trim() || undefined,
      };
      state.properties.push(property);
      return property;
    },
    async createUnit(input) {
      const unit: Unit = {
        id: mockId("unit"),
        propertyId: input.propertyId,
        label: input.label.trim(),
        type: input.type,
        floor: input.floor?.trim() || undefined,
        areaSqft: input.areaSqft,
        bedrooms: input.bedrooms,
        status: input.status ?? "vacant",
      };
      state.units.push(unit);
      return unit;
    },
    async updateProperty(id, patch) {
      const property = state.properties.find((p) => p.id === id);
      if (!property) throw new Error(`Property ${id} not found`);
      if (patch.name !== undefined) {
        const trimmed = patch.name.trim();
        if (!trimmed) throw new Error("Property name is required.");
        property.name = trimmed;
      }
      if (patch.addressLine !== undefined) {
        const trimmed = patch.addressLine.trim();
        if (!trimmed) throw new Error("Property address is required.");
        property.addressLine = trimmed;
      }
      if (patch.city !== undefined) {
        const trimmed = patch.city.trim();
        if (!trimmed) throw new Error("Property city is required.");
        property.city = trimmed;
      }
      if (patch.district !== undefined) property.district = patch.district?.trim() || undefined;
      if (patch.lotNo !== undefined) property.lotNo = patch.lotNo?.trim() || undefined;
      if (patch.planNo !== undefined) property.planNo = patch.planNo?.trim() || undefined;
      if (patch.perches !== undefined) property.perches = patch.perches ?? undefined;
      if (patch.asstNo !== undefined) property.asstNo = patch.asstNo?.trim() || undefined;
      return property;
    },
  },

  payments: {
    async listLedger(filter) {
      let out = state.ledger;
      if (filter?.leaseId) out = out.filter((e) => e.leaseId === filter.leaseId);
      if (filter?.kind?.length) out = out.filter((e) => filter.kind!.includes(e.kind));
      if (filter?.paid !== undefined) {
        out = out.filter((e) => Boolean(e.paidDate) === filter.paid);
      }
      if (filter?.from) out = out.filter((e) => e.dueDate >= filter.from!);
      if (filter?.to) out = out.filter((e) => e.dueDate <= filter.to!);
      return out;
    },
    async listObligations(leaseId) {
      return leaseId
        ? state.obligations.filter((o) => o.leaseId === leaseId)
        : state.obligations;
    },
    async inboxQueue() {
      return [];
    },
    async markPaid(id, input) {
      const entry = state.ledger.find((e) => e.id === id);
      if (!entry) throw new Error(`Ledger entry ${id} not found`);
      entry.paidDate = input.paidDate;
      entry.paymentMethod = input.paymentMethod;
      entry.reference = input.reference;
      entry.notes = input.notes;
      return entry;
    },
    async unmarkPaid(id) {
      const entry = state.ledger.find((e) => e.id === id);
      if (!entry) throw new Error(`Ledger entry ${id} not found`);
      entry.paidDate = undefined;
      entry.paymentMethod = undefined;
      entry.reference = undefined;
      entry.notes = undefined;
      return entry;
    },
    async markNextRentPaid(leaseId, input) {
      const lease = state.leases.find((l) => l.id === leaseId);
      if (!lease || state.deletedLeaseIds.has(leaseId)) throw new Error(`Lease ${leaseId} not found`);
      const entries = state.ledger
        .filter((e) => e.leaseId === leaseId && e.kind === "rent" && e.direction === "in")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const unpaid = entries.find((e) => !e.paidDate);
      if (unpaid) {
        unpaid.paidDate = input.paidDate;
        unpaid.paymentMethod = input.paymentMethod;
        unpaid.reference = input.reference;
        unpaid.notes = input.notes;
        if (input.amount) unpaid.amount = input.amount;
        return unpaid;
      }
      if (lease.tranches.length === 0) throw new Error("Lease has no rent tranches.");
      const lastDue = entries[entries.length - 1]?.dueDate;
      const nextDue = lastDue ? addMonthsIsoMock(lastDue, 1) : lease.tranches[0].startDate;
      const tranche =
        lease.tranches.find((t) => t.startDate <= nextDue && nextDue <= t.endDate) ??
        lease.tranches[lease.tranches.length - 1];
      const entry: LedgerEntry = {
        id: mockId("led"),
        leaseId,
        counterpartyPartyId: lease.lesseePartyId,
        kind: "rent",
        direction: "in",
        amount: input.amount ?? tranche.monthlyRent,
        dueDate: nextDue,
        paidDate: input.paidDate,
        paymentMethod: input.paymentMethod,
        reference: input.reference,
        notes: input.notes,
      };
      state.ledger.push(entry);
      return entry;
    },
  },

  reminders: {
    async listQueue(filter) {
      let out = state.notifications;
      if (filter?.leaseId) out = out.filter((n) => n.leaseId === filter.leaseId);
      if (filter?.status?.length) out = out.filter((n) => filter.status!.includes(n.status));
      return out;
    },
    async enqueue(input) {
      const n: Notification = {
        ...input,
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        status: "queued",
      };
      state.notifications.push(n);
      return n;
    },
  },

  onboarding: {
    async initiate() {
      throw new Error("onboarding.initiate is not implemented in the mock adapter — Phase 02");
    },
    async status() {
      return null;
    },
  },
};

/**
 * Demo-only admin handles for the in-memory mock backend. Not part of the
 * `Backend` interface — called directly from /admin/demo server actions.
 */
export const mockAdmin = {
  /** Replace every collection with a fresh copy of the seed. */
  resetAll(): void {
    const next = freshSeedState();
    state.leases = next.leases;
    state.parties = next.parties;
    state.properties = next.properties;
    state.units = next.units;
    state.obligations = next.obligations;
    state.ledger = next.ledger;
    state.notifications = next.notifications;
    state.deletedLeaseIds = next.deletedLeaseIds;
  },
  /** Empty every collection. The dashboard / leases / rent pages all render
   *  blank until the page is reloaded or the server restarted. */
  clearAll(): void {
    state.leases = [];
    state.parties = [];
    state.properties = [];
    state.units = [];
    state.obligations = [];
    state.ledger = [];
    state.notifications = [];
    state.deletedLeaseIds = new Set();
  },
  counts(): Record<string, number> {
    return {
      leases: state.leases.length,
      parties: state.parties.length,
      properties: state.properties.length,
      units: state.units.length,
      obligations: state.obligations.length,
      ledger: state.ledger.length,
      notifications: state.notifications.length,
    };
  },

  /**
   * Materialise a parsed checklist into real backend records. Properties and
   * parties are reused if a case-insensitive name match already exists;
   * otherwise they're freshly created and pushed into state.
   *
   * Handles multi-tranche head leases and (when the checklist contains a
   * "Sub Tenancy Agreement payments" block) a paired sub-lease, linked
   * via `parentLeaseId`. Sub-lease lessee defaults to a "Sub-tenant — TBD"
   * placeholder party so the operator can edit it post-import.
   */
  upsertFromChecklist(intake: ChecklistIntake): {
    lease: Lease;
    subLease?: Lease;
    property: Property;
    units: Unit[];
    lessor: Party;
    lessee: Party;
    createdEntities: number;
    reusedEntities: number;
  } {
    let created = 0;
    let reused = 0;

    const property = findOrCreateProperty(intake.property, () => created++, () => reused++);
    const units = intake.units.map((u) =>
      findOrCreateUnit(property.id, u, () => created++, () => reused++),
    );
    const lessor = findOrCreateParty(intake.lessor, () => created++, () => reused++);
    const lessee = findOrCreateParty(intake.lessee, () => created++, () => reused++);
    const additionalRoles: LeasePartyRole[] = [];
    if (intake.advisor) {
      const advisor = findOrCreateParty(intake.advisor, () => created++, () => reused++);
      additionalRoles.push({ partyId: advisor.id, role: "advisor" });
    }
    if (intake.counterpartyLawyer) {
      const lawyer = findOrCreateParty(
        intake.counterpartyLawyer,
        () => created++,
        () => reused++,
      );
      additionalRoles.push({ partyId: lawyer.id, role: "lessor_lawyer" });
    }

    const leaseId = uid("lease", `${property.name}-${lessee.displayName}`);
    const tranches: RentScheduleTranche[] = intake.lease.tranches.map((t) => ({
      id: uid("tr", `${leaseId}-${t.sequence}`),
      sequence: t.sequence,
      startDate: t.startDate,
      endDate: t.endDate,
      monthlyRent: t.monthlyRent,
      advanceSetoff: t.advanceSetoff,
      dueDayOfMonth: dayOfMonth(t.startDate),
      paymentDescription: t.paymentDescription,
    }));

    const lease: Lease = {
      id: leaseId,
      propertyId: property.id,
      unitIds: units.map((u) => u.id),
      lessorPartyId: lessor.id,
      lesseePartyId: lessee.id,
      kind: intake.lease.kind,
      purpose: intake.lease.purpose,
      agreementLabel: intake.lease.agreementLabel,
      startDate: intake.lease.startDate,
      endDate: intake.lease.endDate,
      advanceMonths: intake.lease.advanceMonths,
      occupancyCap: intake.lease.occupancyCap,
      status: intake.lease.status,
      paymentCadence: intake.lease.paymentCadence,
      defaultPaymentMethod: intake.lease.defaultPaymentMethod,
      securityDeposit: intake.lease.securityDeposit,
      stampDuty: intake.lease.stampDuty,
      legalFees: intake.lease.legalFees,
      clauses: intake.lease.clauses,
      additionalRoles: additionalRoles.length > 0 ? additionalRoles : undefined,
      tranches,
      importMeta: {
        source: "checklist-upload",
        fields: intake.rawFields,
        warnings: intake.warnings,
      },
    };
    state.leases.push(lease);
    created++;

    // Sub-tenancy: head lessee (e.g., Capital Trust Residencies) becomes the
    // sub lessor; the BPO sub-tenant is a placeholder party for the operator.
    let subLeaseRecord: Lease | undefined;
    if (intake.subLease) {
      const subLesseeParty = findOrCreateParty(
        intake.subLease.lessee,
        () => created++,
        () => reused++,
      );
      const subLeaseId = uid("lease", `${property.name}-sub-${subLesseeParty.displayName}`);
      const subTranches: RentScheduleTranche[] = intake.subLease.lease.tranches.map((t) => ({
        id: uid("tr", `${subLeaseId}-${t.sequence}`),
        sequence: t.sequence,
        startDate: t.startDate,
        endDate: t.endDate,
        monthlyRent: t.monthlyRent,
        dueDayOfMonth: dayOfMonth(t.startDate),
        paymentDescription: t.paymentDescription,
      }));
      subLeaseRecord = {
        id: subLeaseId,
        propertyId: property.id,
        unitIds: units.map((u) => u.id),
        lessorPartyId: lessee.id, // head lessee → sub lessor
        lesseePartyId: subLesseeParty.id,
        kind: "sub",
        purpose: intake.subLease.lease.purpose,
        startDate: intake.subLease.lease.startDate,
        endDate: intake.subLease.lease.endDate,
        status: intake.subLease.lease.status,
        paymentCadence: intake.subLease.lease.paymentCadence,
        defaultPaymentMethod: intake.subLease.lease.defaultPaymentMethod,
        clauses: intake.subLease.lease.clauses,
        tranches: subTranches,
        parentLeaseId: leaseId,
        importMeta: {
          source: "checklist-upload",
          fields: intake.rawFields,
          paired: true,
        },
      };
      state.leases.push(subLeaseRecord);
      created++;
    }

    return {
      lease,
      subLease: subLeaseRecord,
      property,
      units,
      lessor,
      lessee,
      createdEntities: created,
      reusedEntities: reused,
    };
  },
};

// ─────────────────────────────────────────────────────── upsert helpers

const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "untitled"
  );
}

function uid(prefix: string, label: string): string {
  return `${prefix}_${slug(label)}_${Math.random().toString(36).slice(2, 6)}`;
}

function dayOfMonth(iso: string): number {
  const day = Number(iso.slice(8, 10));
  return Number.isFinite(day) && day >= 1 && day <= 28 ? day : 1;
}

function findOrCreateProperty(
  input: ChecklistIntake["property"],
  onCreate: () => void,
  onReuse: () => void,
): Property {
  const wanted = normName(input.name);
  const existing = state.properties.find((p) => normName(p.name) === wanted);
  if (existing) {
    onReuse();
    return existing;
  }
  const property: Property = {
    id: uid("prop", input.name),
    name: input.name,
    addressLine: input.addressLine,
    city: input.city,
  };
  state.properties.push(property);
  onCreate();
  return property;
}

function findOrCreateUnit(
  propertyId: string,
  input: ChecklistIntake["units"][number],
  onCreate: () => void,
  onReuse: () => void,
): Unit {
  const wanted = normName(input.label);
  const existing = state.units.find(
    (u) => u.propertyId === propertyId && normName(u.label) === wanted,
  );
  if (existing) {
    onReuse();
    return existing;
  }
  const unit: Unit = {
    id: uid("unit", `${propertyId}-${input.label}`),
    propertyId,
    label: input.label,
    type: input.type,
    bedrooms: input.bedrooms,
    status: "reserved",
  };
  state.units.push(unit);
  onCreate();
  return unit;
}

function findOrCreateParty(
  input: { displayName: string; address?: string; kind: "individual" | "company" },
  onCreate: () => void,
  onReuse: () => void,
): Party {
  const wanted = normName(input.displayName);
  const existing = state.parties.find((p) => normName(p.displayName) === wanted);
  if (existing) {
    onReuse();
    return existing;
  }
  const party: Party = {
    id: uid("party", input.displayName),
    kind: input.kind,
    displayName: input.displayName,
    emails: [],
    phones: [],
    address: input.address,
  };
  state.parties.push(party);
  onCreate();
  return party;
}
