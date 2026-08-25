import "server-only";

import type { Backend, LeaseCreateIntent } from "@/core/services";
import type { Lease, LeasePartyRole, Party, Property, Unit } from "@/core/types";

import { dayOfMonthOf } from "./build-lease";
import type { ChecklistIntake, PartyInput, UnitInput } from "./build-lease";
import type { ChecklistImportResult } from "./result";

interface Counters {
  created: number;
  reused: number;
}

const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

async function findOrCreateProperty(
  backend: Backend,
  input: ChecklistIntake["property"],
  c: Counters,
): Promise<Property> {
  const wanted = normName(input.name);
  const existing = (await backend.properties.listProperties()).find(
    (p) => normName(p.name) === wanted,
  );
  if (existing) {
    c.reused++;
    return existing;
  }
  const created = await backend.properties.createProperty({
    name: input.name,
    addressLine: input.addressLine,
    city: input.city,
  });
  c.created++;
  return created;
}

async function findOrCreateUnit(
  backend: Backend,
  propertyId: string,
  input: UnitInput,
  c: Counters,
): Promise<Unit> {
  const wanted = normName(input.label);
  const existing = (await backend.properties.listUnits(propertyId)).find(
    (u) => normName(u.label) === wanted,
  );
  if (existing) {
    c.reused++;
    return existing;
  }
  const created = await backend.properties.createUnit({
    propertyId,
    label: input.label,
    type: input.type,
    bedrooms: input.bedrooms,
    status: "reserved",
  });
  c.created++;
  return created;
}

async function findOrCreateParty(
  backend: Backend,
  input: PartyInput,
  c: Counters,
): Promise<Party> {
  const wanted = normName(input.displayName);
  // `parties.list({ search })` pushes an ILIKE into SQL; the exact (normalised)
  // match is then resolved in JS so we reuse only on a true name match.
  const existing = (await backend.parties.list({ search: input.displayName })).find(
    (p) => normName(p.displayName) === wanted,
  );
  if (existing) {
    c.reused++;
    return existing;
  }
  const created = await backend.parties.create({
    kind: input.kind,
    displayName: input.displayName,
    address: input.address,
  });
  c.created++;
  return created;
}

function trancheIntents(
  tranches: ChecklistIntake["lease"]["tranches"],
): LeaseCreateIntent["tranches"] {
  return tranches.map((t) => ({
    sequence: t.sequence,
    startDate: t.startDate,
    endDate: t.endDate,
    monthlyRent: t.monthlyRent,
    advanceSetoff: t.advanceSetoff,
    dueDayOfMonth: dayOfMonthOf(t.startDate),
    paymentDescription: t.paymentDescription,
  }));
}

/**
 * Materialise a parsed checklist into the active backend (mock or supabase).
 * Properties/units/parties are reused on a case-insensitive name match,
 * otherwise created. A "Sub Tenancy" block produces a paired sub-lease whose
 * lessor is the head lessee and whose lessee is a placeholder party.
 *
 * Backend-agnostic by design (CLAUDE.md §3/§6): it composes the `Backend` port
 * primitives, so the same code persists to whichever adapter `getBackend()`
 * resolves.
 */
export async function importChecklistToBackend(
  backend: Backend,
  intake: ChecklistIntake,
): Promise<ChecklistImportResult> {
  const c: Counters = { created: 0, reused: 0 };

  const property = await findOrCreateProperty(backend, intake.property, c);

  const units: Unit[] = [];
  for (const u of intake.units) {
    units.push(await findOrCreateUnit(backend, property.id, u, c));
  }

  const lessor = await findOrCreateParty(backend, intake.lessor, c);
  const lessee = await findOrCreateParty(backend, intake.lessee, c);

  const additionalRoles: LeasePartyRole[] = [];
  if (intake.advisor) {
    const advisor = await findOrCreateParty(backend, intake.advisor, c);
    additionalRoles.push({ partyId: advisor.id, role: "advisor" });
  }
  if (intake.counterpartyLawyer) {
    const lawyer = await findOrCreateParty(backend, intake.counterpartyLawyer, c);
    additionalRoles.push({ partyId: lawyer.id, role: "lessor_lawyer" });
  }
  // CTP Lawyer = Capital Trust's lawyer. Role flips with which side CT is on:
  //   head lease → CT is the lessee  → lessee_lawyer
  //   sub-lease  → CT is the lessor → lessor_lawyer
  // Dedupe against the counterparty lawyer because residential sub-lease
  // checklists often name the same person in both rows.
  if (intake.ctpLawyer) {
    const sameAsCounterparty =
      intake.counterpartyLawyer &&
      normName(intake.counterpartyLawyer.displayName) === normName(intake.ctpLawyer.displayName);
    if (!sameAsCounterparty) {
      const ctpLawyer = await findOrCreateParty(backend, intake.ctpLawyer, c);
      const role: LeasePartyRole["role"] =
        intake.lease.kind === "sub" ? "lessor_lawyer" : "lessee_lawyer";
      additionalRoles.push({ partyId: ctpLawyer.id, role });
    }
  }

  const unitIds = units.map((u) => u.id);

  const lease = await backend.leases.create({
    propertyId: property.id,
    unitIds,
    lessorPartyId: lessor.id,
    lesseePartyId: lessee.id,
    kind: intake.lease.kind,
    purpose: intake.lease.purpose,
    agreementLabel: intake.lease.agreementLabel,
    status: intake.lease.status,
    paymentCadence: intake.lease.paymentCadence,
    defaultPaymentMethod: intake.lease.defaultPaymentMethod,
    startDate: intake.lease.startDate,
    endDate: intake.lease.endDate,
    advanceMonths: intake.lease.advanceMonths,
    occupancyCap: intake.lease.occupancyCap,
    securityDeposit: intake.lease.securityDeposit,
    stampDuty: intake.lease.stampDuty,
    legalFees: intake.lease.legalFees,
    clauses: intake.lease.clauses,
    additionalRoles: additionalRoles.length > 0 ? additionalRoles : undefined,
    tranches: trancheIntents(intake.lease.tranches),
  });
  c.created++;

  let subLease: Lease | undefined;
  if (intake.subLease) {
    const subLessee = await findOrCreateParty(backend, intake.subLease.lessee, c);
    subLease = await backend.leases.create({
      propertyId: property.id,
      unitIds,
      lessorPartyId: lessee.id, // head lessee → sub lessor
      lesseePartyId: subLessee.id,
      parentLeaseId: lease.id,
      kind: "sub",
      purpose: intake.subLease.lease.purpose,
      status: intake.subLease.lease.status,
      paymentCadence: intake.subLease.lease.paymentCadence,
      defaultPaymentMethod: intake.subLease.lease.defaultPaymentMethod,
      startDate: intake.subLease.lease.startDate,
      endDate: intake.subLease.lease.endDate,
      clauses: intake.subLease.lease.clauses,
      tranches: trancheIntents(intake.subLease.lease.tranches),
    });
    c.created++;
  }

  return {
    ok: true,
    leaseId: lease.id,
    subLeaseId: subLease?.id,
    propertyName: property.name,
    lesseeName: lessee.displayName,
    lessorName: lessor.displayName,
    tranches: lease.tranches.length,
    hasSubLease: !!subLease,
    createdEntities: c.created,
    reusedEntities: c.reused,
    warnings: intake.warnings,
  };
}
