/**
 * Seed runner — populates the Supabase Postgres schema with the canonical
 * dataset (Capital Trust group legal entities + Lucky Seven anchor lease +
 * sample BPO subleases). Idempotent: truncates all `public` tables first.
 *
 * Run via `pnpm db:seed`.
 *
 * Production note: this is meant for dev / staging seeding. Production data
 * arrives through the `/admin/import` XLSX importer + the New-Lease wizard.
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import type { Lease, Party, Property, Unit } from "@/core/types";
import {
  LEASES,
  LEDGER,
  OBLIGATIONS,
  PARTIES,
  PROPERTIES,
  UNITS,
} from "@/server/adapters/mock/seed";
import { db } from "@/server/db/client";
import {
  ledgerEntry,
  lease as leaseTable,
  leasePartyRoleTable,
  leaseUnit,
  legalEntity,
  obligation,
  party as partyTable,
  property as propertyTable,
  rentScheduleTranche,
  unit as unitTable,
} from "@/server/db/schema";

// ──────────────────────────────────────────────────────── Legal entities

const CAPITAL_TRUST_ENTITIES = [
  { code: "CTH", name: "Capital Trust Holdings", registrationNo: "PV 75497PB" },
  { code: "CTP-1", name: "Capital Trust Properties One (Pvt) Ltd", registrationNo: null },
  { code: "CTR", name: "Capital Trust Residencies (Pvt) Ltd", registrationNo: null },
  { code: "CTR-9", name: "Capital Trust Residencies Nine (Pvt) Ltd", registrationNo: "PV 109828" },
  { code: "TCL", name: "Tech City Lanka (Pvt) Ltd", registrationNo: null },
  { code: "CBPO", name: "Capital BPO (Pvt) Ltd", registrationNo: null },
  { code: "ColBPO", name: "Colombo BPO (Pvt) Ltd", registrationNo: null },
] as const;

/** Map a mock party id to the legal_entity code. Unknown ids fall through. */
const PARTY_TO_ENTITY_CODE: Record<string, string> = {
  party_cth: "CTH",
  party_ctp_one: "CTP-1",
  party_ct_residencies: "CTR",
  party_ct_residencies_nine: "CTR-9",
  party_tech_city: "TCL",
};

const DEFAULT_ENTITY_CODE = "CTH";

// ──────────────────────────────────────────────────────── ID translation

function buildIdMap<T extends { id: string }>(items: readonly T[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    if (!map.has(item.id)) map.set(item.id, randomUUID());
  }
  return map;
}

function need(map: Map<string, string>, oldId: string, label: string): string {
  const id = map.get(oldId);
  if (!id) {
    throw new Error(`Seed: missing ${label} for old id "${oldId}"`);
  }
  return id;
}

// ──────────────────────────────────────────────────────── Money / clauses helpers

const moneyValue = (m: { amount: number } | undefined) =>
  m === undefined ? null : String(m.amount);
const moneyCurrency = (m: { currency: "LKR" | "USD" } | undefined) =>
  m === undefined ? null : m.currency;

function deriveLeaseEntityCode(lease: Lease, entityCodeByPartyId: Map<string, string>) {
  return (
    entityCodeByPartyId.get(lease.lesseePartyId) ??
    entityCodeByPartyId.get(lease.lessorPartyId) ??
    DEFAULT_ENTITY_CODE
  );
}

// ──────────────────────────────────────────────────────── Seed runner

async function main(): Promise<void> {
  const startedAt = Date.now();

  // 1) Reset (atomic) — TRUNCATE CASCADE inside one transaction so the world
  //    is either entirely reseeded or entirely untouched.
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`truncate table
        ${ledgerEntry},
        ${obligation},
        ${rentScheduleTranche},
        ${leasePartyRoleTable},
        ${leaseUnit},
        ${leaseTable},
        ${unitTable},
        ${propertyTable},
        ${partyTable},
        ${legalEntity}
      restart identity cascade`,
    );
  });

  // 2) Legal entities
  const entityRows = CAPITAL_TRUST_ENTITIES.map((e) => ({
    id: randomUUID(),
    code: e.code,
    name: e.name,
    registrationNo: e.registrationNo,
  }));
  await db.insert(legalEntity).values(entityRows);
  const entityIdByCode = new Map<string, string>(
    entityRows.map((e) => [e.code, e.id]),
  );

  // 3) Parties — assign each to a default legal entity for tenancy scoping.
  const partyIdMap = buildIdMap(PARTIES);
  const entityCodeByOldPartyId = new Map<string, string>();
  for (const p of PARTIES) {
    const code = PARTY_TO_ENTITY_CODE[p.id];
    if (code) entityCodeByOldPartyId.set(p.id, code);
  }

  const partyRows = PARTIES.map((p: Party) => ({
    id: need(partyIdMap, p.id, "party"),
    legalEntityId:
      entityIdByCode.get(PARTY_TO_ENTITY_CODE[p.id] ?? DEFAULT_ENTITY_CODE) ?? null,
    kind: p.kind,
    displayName: p.displayName,
    legalName: p.legalName ?? null,
    nicOrPassport: p.nicOrPassport ?? null,
    companyRegNo: p.companyRegNo ?? null,
    emails: p.emails,
    phones: p.phones,
    address: p.address ?? null,
    notes: p.notes ?? null,
  }));
  await db.insert(partyTable).values(partyRows);

  // 4) Properties — owner inferred from the head-lease lessor where possible;
  //    otherwise null and scoped to the default entity.
  const propertyIdMap = buildIdMap(PROPERTIES);
  const ownerByPropertyId = new Map<string, string>();
  for (const lease of LEASES) {
    if (lease.kind === "head") {
      ownerByPropertyId.set(lease.propertyId, lease.lessorPartyId);
    }
  }

  const propertyRows = PROPERTIES.map((p: Property) => ({
    id: need(propertyIdMap, p.id, "property"),
    legalEntityId: entityIdByCode.get(DEFAULT_ENTITY_CODE)!,
    ownerPartyId: ownerByPropertyId.get(p.id)
      ? need(partyIdMap, ownerByPropertyId.get(p.id)!, "owner party")
      : null,
    name: p.name,
    addressLine: p.addressLine,
    city: p.city,
    district: p.district ?? null,
    lotNo: p.lotNo ?? null,
    planNo: p.planNo ?? null,
    perches: p.perches !== undefined ? String(p.perches) : null,
    asstNo: p.asstNo ?? null,
  }));
  await db.insert(propertyTable).values(propertyRows);

  // 5) Units
  const unitIdMap = buildIdMap(UNITS);
  const unitRows = UNITS.map((u: Unit) => ({
    id: need(unitIdMap, u.id, "unit"),
    propertyId: need(propertyIdMap, u.propertyId, "unit→property"),
    label: u.label,
    type: u.type,
    floor: u.floor !== undefined ? String(u.floor) : null,
    areaSqft: u.areaSqft ?? null,
    bedrooms: u.bedrooms ?? null,
    status: u.status,
  }));
  await db.insert(unitTable).values(unitRows);

  // 6) Leases (+ children) — all inside one transaction so children never
  //    orphan if any insert fails.
  const leaseIdMap = buildIdMap(LEASES);

  await db.transaction(async (tx) => {
    const leaseRows = LEASES.map((l: Lease) => {
      const code = deriveLeaseEntityCode(l, entityCodeByOldPartyId);
      return {
        id: need(leaseIdMap, l.id, "lease"),
        legalEntityId: entityIdByCode.get(code)!,
        propertyId: need(propertyIdMap, l.propertyId, "lease→property"),
        lessorPartyId: need(partyIdMap, l.lessorPartyId, "lessor"),
        lesseePartyId: need(partyIdMap, l.lesseePartyId, "lessee"),
        parentLeaseId: l.parentLeaseId
          ? need(leaseIdMap, l.parentLeaseId, "parent lease")
          : null,
        kind: l.kind,
        purpose: l.purpose,
        agreementLabel: l.agreementLabel ?? null,
        agreementLabelOther: l.agreementLabelOther ?? null,
        status: l.status,
        paymentCadence: l.paymentCadence,
        defaultPaymentMethod: l.defaultPaymentMethod,
        startDate: l.startDate,
        endDate: l.endDate,
        graceEndDate: l.graceEndDate ?? null,
        lockInEndDate: l.lockInEndDate ?? null,
        advanceMonths: l.advanceMonths ?? null,
        occupancyCap: l.occupancyCap ?? null,
        securityDepositAmount: moneyValue(l.securityDeposit),
        securityDepositCurrency: moneyCurrency(l.securityDeposit),
        stampDutyAmount: moneyValue(l.stampDuty),
        stampDutyCurrency: moneyCurrency(l.stampDuty),
        legalFeesAmount: moneyValue(l.legalFees),
        legalFeesCurrency: moneyCurrency(l.legalFees),
        clauses: l.clauses ?? null,
        importMeta: l.importMeta ?? null,
      };
    });
    await tx.insert(leaseTable).values(leaseRows);

    // lease_unit join rows
    const leaseUnitRows = LEASES.flatMap((l) =>
      l.unitIds.map((uId) => ({
        leaseId: need(leaseIdMap, l.id, "lease_unit→lease"),
        unitId: need(unitIdMap, uId, "lease_unit→unit"),
      })),
    );
    if (leaseUnitRows.length > 0) {
      await tx.insert(leaseUnit).values(leaseUnitRows);
    }

    // tranches
    const trancheRows = LEASES.flatMap((l) =>
      l.tranches.map((t) => ({
        id: randomUUID(),
        leaseId: need(leaseIdMap, l.id, "tranche→lease"),
        sequence: t.sequence,
        startDate: t.startDate,
        endDate: t.endDate,
        monthlyRentAmount: String(t.monthlyRent.amount),
        monthlyRentCurrency: t.monthlyRent.currency,
        advanceSetoffAmount: moneyValue(t.advanceSetoff),
        advanceSetoffCurrency: moneyCurrency(t.advanceSetoff),
        dueDayOfMonth: t.dueDayOfMonth,
        paymentDescription: t.paymentDescription ?? null,
        fxRateLkrPerUsd:
          t.fxRateLkrPerUsd !== undefined ? String(t.fxRateLkrPerUsd) : null,
      })),
    );
    if (trancheRows.length > 0) {
      await tx.insert(rentScheduleTranche).values(trancheRows);
    }

    // additional party roles
    const partyRoleRows = LEASES.flatMap((l) =>
      (l.additionalRoles ?? []).map((r) => ({
        leaseId: need(leaseIdMap, l.id, "lease_party_role→lease"),
        partyId: need(partyIdMap, r.partyId, "lease_party_role→party"),
        role: r.role,
      })),
    );
    if (partyRoleRows.length > 0) {
      await tx.insert(leasePartyRoleTable).values(partyRoleRows);
    }

    // obligations — from the mock seed array.
    const obligationRows = OBLIGATIONS.map((o) => ({
      id: randomUUID(),
      leaseId: need(leaseIdMap, o.leaseId, "obligation→lease"),
      ownerPartyId: o.ownerPartyId
        ? need(partyIdMap, o.ownerPartyId, "obligation→owner")
        : null,
      kind: o.kind,
      dueDate: o.dueDate,
      amountValue: moneyValue(o.amount),
      amountCurrency: moneyCurrency(o.amount),
      status: o.status,
      sourceClause: o.sourceClause ?? null,
    }));
    if (obligationRows.length > 0) {
      await tx.insert(obligation).values(obligationRows);
    }

    // ledger entries — from the mock seed array (typically empty in mock).
    const ledgerRows = LEDGER.map((entry) => ({
      id: randomUUID(),
      leaseId: need(leaseIdMap, entry.leaseId, "ledger→lease"),
      obligationId: null, // mock obligation→ledger linkage is fuzzy; null out.
      counterpartyPartyId: need(
        partyIdMap,
        entry.counterpartyPartyId,
        "ledger→counterparty",
      ),
      kind: entry.kind,
      direction: entry.direction,
      amountValue: String(entry.amount.amount),
      amountCurrency: entry.amount.currency,
      dueDate: entry.dueDate,
      paidDate: entry.paidDate ?? null,
      paymentMethod: entry.paymentMethod ?? null,
      reference: entry.reference ?? null,
      notes: entry.notes ?? null,
    }));
    if (ledgerRows.length > 0) {
      await tx.insert(ledgerEntry).values(ledgerRows);
    }
  });

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log(
    `✓ Seeded ${entityRows.length} entities, ${partyRows.length} parties, ${propertyRows.length} properties, ${unitRows.length} units, ${LEASES.length} leases in ${elapsed}s`,
  );
}

main()
  .then(async () => {
    // Force close the pg pool so the script exits cleanly.
    if (globalThis.__rpms_pg) {
      await globalThis.__rpms_pg.end({ timeout: 5 });
    }
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    if (globalThis.__rpms_pg) {
      await globalThis.__rpms_pg.end({ timeout: 5 });
    }
    process.exit(1);
  });
