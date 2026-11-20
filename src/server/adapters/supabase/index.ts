import "server-only";
import { validateChecklistApproval } from "@/lib/checklist/review";
import { checklistReviewVersion } from "@/server/checklist-review-version";
import { readSavedChecklist } from "@/lib/checklist/source-schema";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type { Backend } from "@/core/services";
import type {
  LeaseCreateIntent,
  LeaseDetails,
  LeaseListFilter,
  LeaseOverview,
  LeaseUpdateInput,
  MarkPaidInput,
  PartyCreateInput,
  PartyUpdateInput,
  PropertyCreateInput,
  PropertyUpdateInput,
  TrancheUpdateInput,
  UnitCreateInput,
} from "@/core/services";
import type {
  LedgerEntry,
  LedgerKind,
  Lease,
  Notification,
  Obligation,
  Party,
  Property,
  Unit,
} from "@/core/types";

import { db } from "@/server/db/client";
import {
  ledgerEntry as ledgerEntryTable,
  lease as leaseTable,
  leasePartyRoleTable,
  leaseUnit as leaseUnitTable,
  legalEntity as legalEntityTable,
  obligation as obligationTable,
  party as partyTable,
  property as propertyTable,
  rentScheduleTranche as rentScheduleTrancheTable,
  unit as unitTable,
} from "@/server/db/schema";

import { mergeLeaseClauses } from "@/server/validation/lease-clauses";

import {
  toLease,
  toLedgerEntry,
  toObligation,
  toParty,
  toProperty,
  toUnit,
} from "./mappers";

/**
 * Supabase backend adapter — implements the same `Backend` contract as the
 * mock. Picked up by `getBackend()` when `BACKEND=supabase`.
 *
 * Conventions:
 * - Read methods return [] (lists) or null (single-get) on no match — never throw.
 * - Writes throw on validation/uniqueness failures so callers can surface the
 *   error to the user.
 * - Filters are pushed into SQL (`where` clauses), never applied in JS, to
 *   keep response time bounded as the dataset grows.
 * - All cross-table writes run inside `db.transaction(...)` for atomicity.
 */

// ──────────────────────────────────────────────────────── Helpers

const escapeLike = (s: string) => s.replace(/[%_\\]/g, (m) => `\\${m}`);

async function loadLeaseChildren(leaseIds: string[]) {
  if (leaseIds.length === 0) {
    return { tranches: [], partyRoles: [], units: [] };
  }
  const [tranches, partyRoles, units] = await Promise.all([
    db
      .select()
      .from(rentScheduleTrancheTable)
      .where(inArray(rentScheduleTrancheTable.leaseId, leaseIds)),
    db
      .select()
      .from(leasePartyRoleTable)
      .where(inArray(leasePartyRoleTable.leaseId, leaseIds)),
    db
      .select()
      .from(leaseUnitTable)
      .where(inArray(leaseUnitTable.leaseId, leaseIds)),
  ]);
  return { tranches, partyRoles, units };
}

function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

const moneyStr = (m: { amount: number } | undefined) =>
  m === undefined ? null : String(m.amount);
const moneyCur = (m: { currency: "LKR" | "USD" } | undefined) =>
  m === undefined ? null : m.currency;

const DEFAULT_ENTITY_CODE = "CTH";

/**
 * Resolve a legal_entity row id by its code. Caches a per-process map so
 * server-action calls aren't a join per insert. Falls back to the default
 * entity (CTH) when the code is unknown.
 */
let entityCache: Map<string, string> | null = null;

async function resolveLegalEntityId(code: string | undefined): Promise<string> {
  if (!entityCache) {
    const rows = await db.select().from(legalEntityTable);
    // Don't memoise an empty map — otherwise seeding entities after a fresh
    // clear would require a server restart to be picked up.
    if (rows.length > 0) {
      entityCache = new Map(rows.map((r) => [r.code, r.id]));
    }
  }
  const lookup = entityCache ?? new Map<string, string>();
  const target = code ?? DEFAULT_ENTITY_CODE;
  const id = lookup.get(target) ?? lookup.get(DEFAULT_ENTITY_CODE);
  if (!id) {
    throw new Error(
      `No legal_entity row found (looked for "${target}" and default "${DEFAULT_ENTITY_CODE}"). Did the seed run?`,
    );
  }
  return id;
}

async function loadLease(id: string): Promise<Lease> {
  const [row] = await db
    .select()
    .from(leaseTable)
    .where(eq(leaseTable.id, id))
    .limit(1);
  if (!row) {
    throw new Error(`Lease ${id} not found after write`);
  }
  const children = await loadLeaseChildren([id]);
  return toLease({
    lease: row,
    tranches: children.tranches,
    partyRoles: children.partyRoles,
    units: children.units,
  });
}

async function loadLedgerEntry(id: string): Promise<LedgerEntry> {
  const [row] = await db
    .select()
    .from(ledgerEntryTable)
    .where(eq(ledgerEntryTable.id, id))
    .limit(1);
  if (!row) {
    throw new Error(`Ledger entry ${id} not found`);
  }
  return toLedgerEntry(row);
}

// Relational reads use lateral joins/JSON aggregation to return one row per
// lease in one SQL statement, avoiding a round trip for each child table.
// Project only workflow provenance, never the original workbook or raw fields.
const importSummary = { importSummary: sql`jsonb_build_object('source', ${leaseTable.importMeta}->'source', 'review', ${leaseTable.importMeta}->'review')`.as("import_summary") };
const leaseChildren = { tranches: true, partyRoles: true, units: true } as const;
type LeaseJoinedRow = Omit<typeof leaseTable.$inferSelect, "importMeta"> & { importMeta?: unknown; importSummary?: unknown } & Omit<Parameters<typeof toLease>[0], "lease">;

function mapLeaseRow(row: LeaseJoinedRow): Lease {
  return toLease({ lease: { ...row, importMeta: row.importSummary ?? row.importMeta ?? null }, tranches: row.tranches, partyRoles: row.partyRoles, units: row.units });
}

function leaseWhere(filter?: LeaseListFilter) {
  const conditions = [isNull(leaseTable.deletedAt)];
  if (filter?.ids) conditions.push(filter.ids.length ? inArray(leaseTable.id, filter.ids) : sql`false`);
  if (filter?.status?.length) conditions.push(inArray(leaseTable.status, filter.status));
  if (filter?.propertyId) conditions.push(eq(leaseTable.propertyId, filter.propertyId));
  if (filter?.cadence) conditions.push(eq(leaseTable.paymentCadence, filter.cadence));
  if (filter?.search) {
    const needle = `%${escapeLike(filter.search)}%`;
    conditions.push(or(ilike(leaseTable.id, needle), ilike(leaseTable.propertyId, needle))!);
  }
  return and(...conditions);
}

// ──────────────────────────────────────────────────────── Adapter

export const supabaseBackend: Backend = {
  leases: {
    async approveChecklist(id, input) {
      return db.transaction(async (tx) => {
        const [locked] = await tx.select().from(leaseTable).where(and(eq(leaseTable.id, id), isNull(leaseTable.deletedAt))).for("update");
        if (!locked) throw new Error("Lease not found.");
        const children = await loadLeaseChildren([id]);
        const lease = toLease({ lease: locked, ...children });
        const existing = await tx.select().from(ledgerEntryTable).where(eq(ledgerEntryTable.leaseId, id)).for("update");
        const ledger = existing.map(toLedgerEntry);
        if (checklistReviewVersion(lease, ledger) !== input.version) throw new Error("The lease or rent ledger changed. Close this dialog, review the latest values and try again.");
        const rows = validateChecklistApproval(lease, ledger, input);
        const receipts = new Map(input.receipts.map((receipt) => [receipt.dueDate, receipt]));
        const inserts: Array<typeof ledgerEntryTable.$inferInsert> = [];
        const updates: Array<{ id: string; paid_date: string; amount: number; method: string; reference: string }> = [];
        for (const row of rows) {
          const receipt = receipts.get(row.dueDate);
          const paid = receipt ? { paidDate: receipt.paidDate, amountValue: String(receipt.amount), paymentMethod: receipt.paymentMethod, reference: receipt.reference || null, notes: "Historical rent recorded at checklist sign-off" } : {};
          if (row.entryId) {
            if (receipt) updates.push({ id: row.entryId, paid_date: receipt.paidDate, amount: receipt.amount, method: receipt.paymentMethod, reference: receipt.reference });
          } else {
            inserts.push({ leaseId: id, kind: "rent", direction: "in", counterpartyPartyId: lease.lesseePartyId, dueDate: row.dueDate, amountValue: String(row.amount.amount), amountCurrency: row.amount.currency, ...paid });
          }
        }
        // One insert and one update even for years of historical collections.
        if (inserts.length) await tx.insert(ledgerEntryTable).values(inserts);
        if (updates.length) await tx.execute(sql`update ledger_entry as entry
          set paid_date = receipt.paid_date, amount_value = receipt.amount,
              payment_method = receipt.method::payment_method, reference = nullif(receipt.reference, ''),
              notes = concat_ws(E'\n', nullif(entry.notes, ''), 'Historical rent recorded at checklist sign-off')
          from jsonb_to_recordset(${JSON.stringify(updates)}::jsonb) as receipt(id uuid, paid_date date, amount numeric, method text, reference text)
          where entry.id = receipt.id and entry.lease_id = ${id}`);
        const review = { status: "approved", approvedAt: input.approvedAt, approvedById: input.approvedById, approvedByName: input.approvedByName, notes: input.notes, recordedPayments: input.receipts.length };
        const [updated] = await tx.update(leaseTable).set({ status: "active", onboardingStage: null,
          signedLeasePath: input.signedLeasePath, signedLeaseUploadedAt: lease.signedLeasePath === input.signedLeasePath ? locked.signedLeaseUploadedAt : new Date(input.approvedAt),
          importMeta: sql`jsonb_set(${leaseTable.importMeta}, '{review}', ${JSON.stringify(review)}::jsonb, true)`, updatedAt: new Date(input.approvedAt),
        }).where(eq(leaseTable.id, id)).returning();
        return toLease({ lease: updated, ...children });
      });
    },
    async getChecklist(id) {
      const [row] = await db.select({ checklist: sql<unknown>`${leaseTable.importMeta}->'checklist'` })
        .from(leaseTable).where(and(eq(leaseTable.id, id), isNull(leaseTable.deletedAt))).limit(1);
      return readSavedChecklist(row?.checklist);
    },
    async saveChecklist(id, checklist) {
      const [row] = await db.update(leaseTable).set({
        importMeta: sql`jsonb_set(coalesce(${leaseTable.importMeta}, '{}'::jsonb), '{checklist}', ${JSON.stringify(checklist)}::jsonb, true)`,
      }).where(and(eq(leaseTable.id, id), isNull(leaseTable.deletedAt), sql`${leaseTable.importMeta}->'checklist' is null`)).returning({ id: leaseTable.id });
      if (!row) throw new Error("The agreement is missing or already has its original checklist.");
    },
    async list(filter): Promise<Lease[]> {
      const rows = await db.query.lease.findMany({
        columns: { importMeta: false }, extras: importSummary,
        where: leaseWhere(filter),
        orderBy: desc(leaseTable.startDate),
        with: leaseChildren,
      });
      return rows.map(mapLeaseRow);
    },

    async listOverview(filter): Promise<LeaseOverview[]> {
      // One statement includes the table's labels and just the next unpaid
      // incoming rent line per lease, rather than the complete rent ledger.
      const rows = await db.query.lease.findMany({
        columns: { importMeta: false }, extras: importSummary,
        where: leaseWhere(filter),
        orderBy: desc(leaseTable.startDate),
        with: {
          ...leaseChildren,
          property: true,
          lessor: true,
          lessee: true,
          partyRoles: { with: { party: true } },
          ledger: {
            where: (entry) => and(eq(entry.kind, "rent"), eq(entry.direction, "in"), isNull(entry.paidDate)),
            orderBy: (entry) => asc(entry.dueDate),
            limit: 1,
          },
        },
      });
      return rows.map((row) => {
        const advisor = row.partyRoles.find((role) => role.role === "advisor")?.party;
        return {
          lease: mapLeaseRow(row),
          property: row.property ? toProperty(row.property) : undefined,
          lessor: row.lessor ? toParty(row.lessor) : undefined,
          lessee: row.lessee ? toParty(row.lessee) : undefined,
          advisor: advisor ? toParty(advisor) : undefined,
          nextRentEntry: row.ledger[0] ? toLedgerEntry(row.ledger[0]) : undefined,
        };
      });
    },

    async get(id): Promise<Lease | null> {
      const row = await db.query.lease.findFirst({
        columns: { importMeta: false }, extras: importSummary,
        where: and(eq(leaseTable.id, id), isNull(leaseTable.deletedAt)),
        with: leaseChildren,
      });
      return row ? mapLeaseRow(row) : null;
    },

    async getDetails(id): Promise<LeaseDetails | null> {
      const row = await db.query.lease.findFirst({
        columns: { importMeta: false }, extras: importSummary,
        where: and(eq(leaseTable.id, id), isNull(leaseTable.deletedAt)),
        with: {
          ...leaseChildren,
          property: { with: { units: true } },
          lessor: true,
          lessee: true,
          partyRoles: { with: { party: true } },
          obligations: { orderBy: (entry) => asc(entry.dueDate) },
          ledger: { orderBy: (entry) => asc(entry.dueDate) },
          parent: { columns: { importMeta: false }, extras: importSummary, with: { ...leaseChildren, lessee: true } },
          children: {
            columns: { importMeta: false }, extras: importSummary,
            where: (child) => isNull(child.deletedAt),
            orderBy: (child) => desc(child.startDate),
            with: { ...leaseChildren, lessee: true },
          },
        },
      });
      if (!row) return null;
      const relatives = [
        ...(row.parent && !row.parent.deletedAt ? [row.parent] : []),
        ...row.children,
      ];
      const parties = [row.lessor, row.lessee,
        ...row.partyRoles.map((role) => role.party),
        ...relatives.map((relative) => relative.lessee),
      ].flatMap((party) => party ? [toParty(party)] : []);
      return {
        lease: mapLeaseRow(row),
        property: row.property ? toProperty(row.property) : null,
        units: row.property?.units.map(toUnit) ?? [],
        parties: [...new Map(parties.map((party) => [party.id, party])).values()],
        obligations: row.obligations.map(toObligation),
        ledger: row.ledger.map(toLedgerEntry),
        relatedLeases: relatives.map(mapLeaseRow),
      };
    },

    async create(intent: LeaseCreateIntent): Promise<Lease> {
      // Basic input validation — fail fast with a useful message.
      if (!intent.tranches?.length) {
        throw new Error("Cannot create a lease with zero tranches.");
      }
      if (
        intent.lessorPartyId === intent.lesseePartyId &&
        intent.lessorPartyId
      ) {
        throw new Error("Lessor and lessee must be different parties.");
      }
      if (!intent.startDate || !intent.endDate) {
        throw new Error("Lease must have a start_date and end_date.");
      }

      const legalEntityId = await resolveLegalEntityId(intent.legalEntityCode);

      const leaseId = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(leaseTable)
          .values({
            legalEntityId,
            propertyId: intent.propertyId,
            lessorPartyId: intent.lessorPartyId,
            lesseePartyId: intent.lesseePartyId,
            parentLeaseId: intent.parentLeaseId ?? null,
            kind: intent.kind,
            purpose: intent.purpose,
            agreementLabel: intent.agreementLabel ?? null,
            agreementLabelOther: intent.agreementLabelOther ?? null,
            status: intent.status ?? "draft",
            paymentCadence: intent.paymentCadence,
            defaultPaymentMethod: intent.defaultPaymentMethod,
            startDate: intent.startDate,
            endDate: intent.endDate,
            graceEndDate: intent.graceEndDate ?? null,
            lockInEndDate: intent.lockInEndDate ?? null,
            advanceMonths: intent.advanceMonths ?? null,
            occupancyCap: intent.occupancyCap ?? null,
            securityDepositAmount: moneyStr(intent.securityDeposit),
            securityDepositCurrency: moneyCur(intent.securityDeposit),
            stampDutyAmount: moneyStr(intent.stampDuty),
            stampDutyCurrency: moneyCur(intent.stampDuty),
            legalFeesAmount: moneyStr(intent.legalFees),
            legalFeesCurrency: moneyCur(intent.legalFees),
            clauses: intent.clauses ?? null,
            importMeta: intent.importMeta ?? null,
          })
          .returning({ id: leaseTable.id });

        if (!inserted) {
          throw new Error("Lease insert returned no row.");
        }

        if (intent.unitIds.length > 0) {
          await tx.insert(leaseUnitTable).values(
            intent.unitIds.map((unitId) => ({
              leaseId: inserted.id,
              unitId,
            })),
          );
        }

        if (intent.additionalRoles?.length) {
          await tx.insert(leasePartyRoleTable).values(
            intent.additionalRoles.map((r) => ({
              leaseId: inserted.id,
              partyId: r.partyId,
              userId: r.userId ?? null,
              role: r.role,
            })),
          );
        }

        await tx.insert(rentScheduleTrancheTable).values(
          intent.tranches.map((t) => ({
            leaseId: inserted.id,
            sequence: t.sequence,
            startDate: t.startDate,
            endDate: t.endDate,
            monthlyRentAmount: String(t.monthlyRent.amount),
            monthlyRentCurrency: t.monthlyRent.currency,
            advanceSetoffAmount: moneyStr(t.advanceSetoff),
            advanceSetoffCurrency: moneyCur(t.advanceSetoff),
            dueDayOfMonth: t.dueDayOfMonth,
            paymentDescription: t.paymentDescription ?? null,
            fxRateLkrPerUsd:
              t.fxRateLkrPerUsd !== undefined ? String(t.fxRateLkrPerUsd) : null,
          })),
        );

        return inserted.id;
      });

      return loadLease(leaseId);
    },

    async updateStatus(id, status): Promise<Lease> {
      const [updated] = await db
        .update(leaseTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(leaseTable.id, id))
        .returning({ id: leaseTable.id });
      if (!updated) {
        throw new Error(`Lease ${id} not found`);
      }
      return loadLease(id);
    },

    async update(id, patch: LeaseUpdateInput): Promise<Lease> {
      const set: Partial<typeof leaseTable.$inferInsert> = { updatedAt: new Date() };
      if (patch.lessorPartyId !== undefined) set.lessorPartyId = patch.lessorPartyId;
      if (patch.lesseePartyId !== undefined) set.lesseePartyId = patch.lesseePartyId;
      if (patch.purpose !== undefined) set.purpose = patch.purpose;
      if (patch.agreementLabel !== undefined) set.agreementLabel = patch.agreementLabel;
      if (patch.agreementLabelOther !== undefined) {
        set.agreementLabelOther = patch.agreementLabelOther;
      }
      if (patch.status !== undefined) set.status = patch.status;
      if (patch.paymentCadence !== undefined) set.paymentCadence = patch.paymentCadence;
      if (patch.defaultPaymentMethod !== undefined) {
        set.defaultPaymentMethod = patch.defaultPaymentMethod;
      }
      if (patch.startDate !== undefined) set.startDate = patch.startDate;
      if (patch.endDate !== undefined) set.endDate = patch.endDate;
      if (patch.graceEndDate !== undefined) set.graceEndDate = patch.graceEndDate;
      if (patch.lockInEndDate !== undefined) set.lockInEndDate = patch.lockInEndDate;
      if (patch.advanceMonths !== undefined) set.advanceMonths = patch.advanceMonths;
      if (patch.occupancyCap !== undefined) set.occupancyCap = patch.occupancyCap;
      if (patch.securityDeposit !== undefined) {
        set.securityDepositAmount = moneyStr(patch.securityDeposit ?? undefined);
        set.securityDepositCurrency = moneyCur(patch.securityDeposit ?? undefined);
      }
      if (patch.stampDuty !== undefined) {
        set.stampDutyAmount = moneyStr(patch.stampDuty ?? undefined);
        set.stampDutyCurrency = moneyCur(patch.stampDuty ?? undefined);
      }
      if (patch.legalFees !== undefined) {
        set.legalFeesAmount = moneyStr(patch.legalFees ?? undefined);
        set.legalFeesCurrency = moneyCur(patch.legalFees ?? undefined);
      }

      // Everything below touches more than one table, so the whole patch is
      // applied inside a single transaction — a lease is never left with new
      // units but old roles.
      await db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(leaseTable)
          .where(and(eq(leaseTable.id, id), isNull(leaseTable.deletedAt)))
          .limit(1);
        if (!row) throw new Error(`Lease ${id} not found`);

        // Cross-field guard: whichever side was patched, the pair must differ.
        const nextLessor = patch.lessorPartyId ?? row.lessorPartyId;
        const nextLessee = patch.lesseePartyId ?? row.lesseePartyId;
        if (nextLessor === nextLessee) {
          throw new Error("Lessor and lessee must be different parties.");
        }

        if (patch.clauses !== undefined) {
          set.clauses = mergeLeaseClauses(row.clauses, patch.clauses) ?? null;
        }

        await tx.update(leaseTable).set(set).where(eq(leaseTable.id, id));

        if (patch.unitIds !== undefined) {
          const wanted = [...new Set(patch.unitIds)];
          if (wanted.length > 0) {
            const owned = await tx
              .select({ id: unitTable.id })
              .from(unitTable)
              .where(
                and(inArray(unitTable.id, wanted), eq(unitTable.propertyId, row.propertyId)),
              );
            if (owned.length !== wanted.length) {
              throw new Error("Every unit must belong to the lease's property.");
            }
          }
          await tx.delete(leaseUnitTable).where(eq(leaseUnitTable.leaseId, id));
          if (wanted.length > 0) {
            await tx
              .insert(leaseUnitTable)
              .values(wanted.map((unitId) => ({ leaseId: id, unitId })));
          }
        }

        if (patch.additionalRoles !== undefined) {
          await tx.delete(leasePartyRoleTable).where(eq(leasePartyRoleTable.leaseId, id));
          // (partyId, role) is the primary key — dedupe before insert.
          const seen = new Set<string>();
          const values = patch.additionalRoles
            .filter((r) => {
              const key = `${r.partyId}:${r.role}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .map((r) => ({ leaseId: id, partyId: r.partyId, userId: r.userId ?? null, role: r.role }));
          if (values.length > 0) await tx.insert(leasePartyRoleTable).values(values);
        }
      });

      return loadLease(id);
    },

    async updateTranche(
      leaseId,
      trancheId,
      patch: TrancheUpdateInput,
    ): Promise<Lease> {
      await db.execute(sql`select id from lease where id = ${leaseId} for update`);
      const [lease] = await db
        .select({ id: leaseTable.id })
        .from(leaseTable)
        .where(and(eq(leaseTable.id, leaseId), isNull(leaseTable.deletedAt)))
        .limit(1);
      if (!lease) throw new Error(`Lease ${leaseId} not found`);

      const [current] = await db
        .select()
        .from(rentScheduleTrancheTable)
        .where(
          and(
            eq(rentScheduleTrancheTable.id, trancheId),
            eq(rentScheduleTrancheTable.leaseId, leaseId),
          ),
        )
        .limit(1);
      if (!current) {
        throw new Error(`Tranche ${trancheId} not found on lease ${leaseId}`);
      }

      const set: Partial<typeof rentScheduleTrancheTable.$inferInsert> = {};
      if (patch.startDate !== undefined) set.startDate = patch.startDate;
      if (patch.endDate !== undefined) set.endDate = patch.endDate;
      if (patch.monthlyRent !== undefined) {
        set.monthlyRentAmount = String(patch.monthlyRent.amount);
        set.monthlyRentCurrency = patch.monthlyRent.currency;
      }
      if (patch.advanceSetoff !== undefined) {
        set.advanceSetoffAmount = moneyStr(patch.advanceSetoff ?? undefined);
        set.advanceSetoffCurrency = moneyCur(patch.advanceSetoff ?? undefined);
      }
      if (patch.dueDayOfMonth !== undefined) set.dueDayOfMonth = patch.dueDayOfMonth;
      if (patch.paymentDescription !== undefined) {
        set.paymentDescription = patch.paymentDescription;
      }
      if (patch.fxRateLkrPerUsd !== undefined) {
        set.fxRateLkrPerUsd =
          patch.fxRateLkrPerUsd === null ? null : String(patch.fxRateLkrPerUsd);
      }

      const startDate = patch.startDate ?? current.startDate;
      const endDate = patch.endDate ?? current.endDate;
      if (startDate > endDate) {
        throw new Error("Tranche start date must fall on or before its end date.");
      }

      await db
        .update(rentScheduleTrancheTable)
        .set(set)
        .where(eq(rentScheduleTrancheTable.id, trancheId));
      await db
        .update(leaseTable)
        .set({ updatedAt: new Date() })
        .where(eq(leaseTable.id, leaseId));
      return loadLease(leaseId);
    },

    async softDelete(id): Promise<void> {
      const [row] = await db
        .update(leaseTable)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(leaseTable.id, id), isNull(leaseTable.deletedAt)))
        .returning({ id: leaseTable.id });
      if (!row) {
        throw new Error(`Lease ${id} not found`);
      }
    },

    async markAgreementGenerated(id, storagePath): Promise<Lease> {
      const [row] = await db
        .select()
        .from(leaseTable)
        .where(and(eq(leaseTable.id, id), isNull(leaseTable.deletedAt)))
        .limit(1);
      if (!row) throw new Error(`Lease ${id} not found`);
      const now = new Date();
      const set: Partial<typeof leaseTable.$inferInsert> = {
        agreementPath: storagePath,
        agreementGeneratedAt: now,
        updatedAt: now,
      };
      if (!row.onboardingStage && row.status === "draft") {
        set.onboardingStage = "agreement_ready";
      }
      await db.update(leaseTable).set(set).where(eq(leaseTable.id, id));
      return loadLease(id);
    },

    async markLeaseEmailSent(id, kind): Promise<Lease> {
      // Serialise concurrent lawyer/advisor confirmations so neither loses
      // the other's timestamp or leaves the workflow stuck at Send Emails.
      await db.execute(sql`select id from lease where id = ${id} for update`);
      const [row] = await db
        .select()
        .from(leaseTable)
        .where(and(eq(leaseTable.id, id), isNull(leaseTable.deletedAt)))
        .limit(1);
      if (!row) throw new Error(`Lease ${id} not found`);
      if (row.status !== "draft") throw new Error("Email workflow steps apply to draft leases only.");
      const sentAt = kind === "lawyer" ? row.lawyerEmailSentAt : kind === "advisor" ? row.advisorEmailSentAt : row.accountsEmailSentAt;
      if (sentAt) return loadLease(id);
      if (kind === "accounts" ? row.onboardingStage !== "emails_sent" : row.onboardingStage !== "agreement_ready") {
        throw new Error(kind === "accounts" ? "Notify the lawyer and advisors before sending to accounts." : "Generate or upload the agreement before confirming emails.");
      }
      const now = new Date();
      const set: Partial<typeof leaseTable.$inferInsert> = { updatedAt: now };
      const lawyerSet = kind === "lawyer" || Boolean(row.lawyerEmailSentAt);
      const advisorSet = kind === "advisor" || Boolean(row.advisorEmailSentAt);
      if (kind === "lawyer") set.lawyerEmailSentAt = now;
      else if (kind === "advisor") set.advisorEmailSentAt = now;
      else set.accountsEmailSentAt = now;
      if (kind === "accounts") {
        if (row.onboardingStage === "emails_sent") set.onboardingStage = "at_accounts";
      } else if (lawyerSet && advisorSet && row.onboardingStage === "agreement_ready") {
        set.onboardingStage = "emails_sent";
      }
      await db.update(leaseTable).set(set).where(eq(leaseTable.id, id));
      return loadLease(id);
    },

    async markLeaseActive(id): Promise<Lease> {
      const [updated] = await db
        .update(leaseTable)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(leaseTable.id, id), isNull(leaseTable.deletedAt)))
        .returning({ id: leaseTable.id });
      if (!updated) throw new Error(`Lease ${id} not found`);
      return loadLease(id);
    },

    async setOnboardingStage(id, stage): Promise<Lease> {
      const [updated] = await db
        .update(leaseTable)
        .set({ onboardingStage: stage, updatedAt: new Date(), ...(stage === null ? {
          lawyerEmailSentAt: null, advisorEmailSentAt: null, accountsEmailSentAt: null,
        } : {}) })
        .where(and(eq(leaseTable.id, id), isNull(leaseTable.deletedAt)))
        .returning({ id: leaseTable.id });
      if (!updated) {
        throw new Error(`Lease ${id} not found`);
      }
      return loadLease(id);
    },

    async attachSignedLease(id, storagePath): Promise<Lease> {
      const now = new Date();
      const [updated] = await db
        .update(leaseTable)
        .set({
          signedLeasePath: storagePath,
          signedLeaseUploadedAt: now,
          status: "active",
          updatedAt: now,
        })
        .where(and(eq(leaseTable.id, id), isNull(leaseTable.deletedAt)))
        .returning({ id: leaseTable.id });
      if (!updated) {
        throw new Error(`Lease ${id} not found`);
      }
      return loadLease(id);
    },

    async generateRentSchedule(id): Promise<{ created: number; skipped: number }> {
      await db.execute(sql`select id from lease where id = ${id} for update`);
      const [leaseRow] = await db
        .select()
        .from(leaseTable)
        .where(and(eq(leaseTable.id, id), isNull(leaseTable.deletedAt)))
        .limit(1);
      if (!leaseRow) throw new Error(`Lease ${id} not found`);

      const tranches = await db
        .select()
        .from(rentScheduleTrancheTable)
        .where(eq(rentScheduleTrancheTable.leaseId, id))
        .orderBy(asc(rentScheduleTrancheTable.sequence));
      if (tranches.length === 0) {
        return { created: 0, skipped: 0 };
      }

      // Existing rent dueDates → set, so we can skip without a unique index.
      const existing = await db
        .select({ dueDate: ledgerEntryTable.dueDate })
        .from(ledgerEntryTable)
        .where(
          and(
            eq(ledgerEntryTable.leaseId, id),
            eq(ledgerEntryTable.kind, "rent"),
            eq(ledgerEntryTable.direction, "in"),
          ),
        );
      const taken = new Set(existing.map((e) => e.dueDate));

      type NewEntry = typeof ledgerEntryTable.$inferInsert;
      const rows: NewEntry[] = [];
      for (const t of tranches) {
        const cursorEnd = t.endDate;
        let due = t.startDate;
        // Walk month-by-month while the cursor is still inside the tranche.
        // Cap at 120 iterations as a safety belt for malformed dates.
        for (let i = 0; i < 120 && due <= cursorEnd; i++) {
          if (!taken.has(due)) {
            rows.push({
              leaseId: id,
              counterpartyPartyId: leaseRow.lesseePartyId,
              kind: "rent",
              direction: "in",
              amountValue: t.monthlyRentAmount,
              amountCurrency: t.monthlyRentCurrency,
              dueDate: due,
            });
            taken.add(due);
          }
          due = addMonthsIso(due, 1);
        }
      }

      if (rows.length === 0) return { created: 0, skipped: existing.length };
      await db.insert(ledgerEntryTable).values(rows);
      return { created: rows.length, skipped: existing.length };
    },
  },

  parties: {
    async list(filter): Promise<Party[]> {
      const conditions = [];
      if (filter?.search) {
        const needle = `%${escapeLike(filter.search)}%`;
        conditions.push(
          or(
            ilike(partyTable.displayName, needle),
            ilike(partyTable.legalName, needle),
            sql`exists (
              select 1 from unnest(${partyTable.emails}) as e
              where e ilike ${needle}
            )`,
          )!,
        );
      }
      const rows = await db
        .select()
        .from(partyTable)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(partyTable.displayName));

      if (!filter?.role) return rows.map(toParty);

      const partyIds = await db
        .selectDistinct({ partyId: leasePartyRoleTable.partyId })
        .from(leasePartyRoleTable)
        .where(eq(leasePartyRoleTable.role, filter.role));
      const allowed = new Set(partyIds.map((p) => p.partyId));
      return rows.filter((r) => allowed.has(r.id)).map(toParty);
    },

    async get(id): Promise<Party | null> {
      const [row] = await db
        .select()
        .from(partyTable)
        .where(eq(partyTable.id, id))
        .limit(1);
      return row ? toParty(row) : null;
    },

    async create(input: PartyCreateInput): Promise<Party> {
      const trimmed = input.displayName.trim();
      if (trimmed.length < 1) {
        throw new Error("Party display name is required.");
      }
      const legalEntityId = await resolveLegalEntityId(input.legalEntityCode);
      const [row] = await db
        .insert(partyTable)
        .values({
          legalEntityId,
          kind: input.kind,
          displayName: trimmed,
          legalName: input.legalName?.trim() || null,
          nicOrPassport: input.nicOrPassport?.trim() || null,
          companyRegNo: input.companyRegNo?.trim() || null,
          emails: input.emails ?? [],
          phones: input.phones ?? [],
          address: input.address?.trim() || null,
          notes: input.notes?.trim() || null,
        })
        .returning();
      if (!row) throw new Error("Party insert returned no row.");
      return toParty(row);
    },

    async update(id, patch: PartyUpdateInput): Promise<Party> {
      const set: Partial<typeof partyTable.$inferInsert> = {};
      if (patch.kind !== undefined) set.kind = patch.kind;
      if (patch.displayName !== undefined) {
        const trimmed = patch.displayName.trim();
        if (!trimmed) throw new Error("Party display name is required.");
        set.displayName = trimmed;
      }
      if (patch.legalName !== undefined) set.legalName = patch.legalName?.trim() || null;
      if (patch.nicOrPassport !== undefined) {
        set.nicOrPassport = patch.nicOrPassport?.trim() || null;
      }
      if (patch.companyRegNo !== undefined) {
        set.companyRegNo = patch.companyRegNo?.trim() || null;
      }
      if (patch.emails !== undefined) set.emails = patch.emails;
      if (patch.phones !== undefined) set.phones = patch.phones;
      if (patch.address !== undefined) set.address = patch.address?.trim() || null;
      if (patch.notes !== undefined) set.notes = patch.notes?.trim() || null;

      const [row] = await db
        .update(partyTable)
        .set(set)
        .where(eq(partyTable.id, id))
        .returning();
      if (!row) throw new Error(`Party ${id} not found`);
      return toParty(row);
    },
  },

  properties: {
    async listProperties(): Promise<Property[]> {
      const rows = await db
        .select()
        .from(propertyTable)
        .orderBy(asc(propertyTable.name));
      return rows.map(toProperty);
    },

    async getProperty(id): Promise<Property | null> {
      const [row] = await db
        .select()
        .from(propertyTable)
        .where(eq(propertyTable.id, id))
        .limit(1);
      return row ? toProperty(row) : null;
    },

    async listUnits(propertyId): Promise<Unit[]> {
      const rows = propertyId
        ? await db
            .select()
            .from(unitTable)
            .where(eq(unitTable.propertyId, propertyId))
            .orderBy(asc(unitTable.label))
        : await db.select().from(unitTable).orderBy(asc(unitTable.label));
      return rows.map(toUnit);
    },

    async createProperty(input: PropertyCreateInput): Promise<Property> {
      const name = input.name.trim();
      const addressLine = input.addressLine.trim();
      const city = input.city.trim();
      if (!name || !addressLine || !city) {
        throw new Error("Property name, addressLine, and city are required.");
      }
      const legalEntityId = await resolveLegalEntityId(input.legalEntityCode);
      const [row] = await db
        .insert(propertyTable)
        .values({
          legalEntityId,
          ownerPartyId: input.ownerPartyId ?? null,
          name,
          addressLine,
          city,
          district: input.district?.trim() || null,
          lotNo: input.lotNo?.trim() || null,
          planNo: input.planNo?.trim() || null,
          perches: input.perches !== undefined ? String(input.perches) : null,
          asstNo: input.asstNo?.trim() || null,
        })
        .returning();
      if (!row) throw new Error("Property insert returned no row.");
      return toProperty(row);
    },

    async createUnit(input: UnitCreateInput): Promise<Unit> {
      const label = input.label.trim();
      if (!label) {
        throw new Error("Unit label is required.");
      }
      const [row] = await db
        .insert(unitTable)
        .values({
          propertyId: input.propertyId,
          label,
          type: input.type,
          floor: input.floor?.trim() || null,
          areaSqft: input.areaSqft ?? null,
          bedrooms: input.bedrooms ?? null,
          status: input.status ?? "vacant",
        })
        .returning();
      if (!row) throw new Error("Unit insert returned no row.");
      return toUnit(row);
    },

    async updateProperty(id, patch: PropertyUpdateInput): Promise<Property> {
      const set: Partial<typeof propertyTable.$inferInsert> = {};
      if (patch.name !== undefined) {
        const trimmed = patch.name.trim();
        if (!trimmed) throw new Error("Property name is required.");
        set.name = trimmed;
      }
      if (patch.addressLine !== undefined) {
        const trimmed = patch.addressLine.trim();
        if (!trimmed) throw new Error("Property address is required.");
        set.addressLine = trimmed;
      }
      if (patch.city !== undefined) {
        const trimmed = patch.city.trim();
        if (!trimmed) throw new Error("Property city is required.");
        set.city = trimmed;
      }
      if (patch.district !== undefined) set.district = patch.district?.trim() || null;
      if (patch.lotNo !== undefined) set.lotNo = patch.lotNo?.trim() || null;
      if (patch.planNo !== undefined) set.planNo = patch.planNo?.trim() || null;
      if (patch.perches !== undefined) {
        set.perches = patch.perches === null ? null : String(patch.perches);
      }
      if (patch.asstNo !== undefined) set.asstNo = patch.asstNo?.trim() || null;

      const [row] = await db
        .update(propertyTable)
        .set(set)
        .where(eq(propertyTable.id, id))
        .returning();
      if (!row) throw new Error(`Property ${id} not found`);
      return toProperty(row);
    },

  },

  payments: {
    async listLedger(filter): Promise<LedgerEntry[]> {
      const conditions = [];
      if (filter?.leaseId) {
        conditions.push(eq(ledgerEntryTable.leaseId, filter.leaseId));
      }
      if (filter?.leaseIds) {
        conditions.push(filter.leaseIds.length ? inArray(ledgerEntryTable.leaseId, filter.leaseIds) : sql`false`);
      }
      if (filter?.kind?.length) {
        conditions.push(
          inArray(ledgerEntryTable.kind, filter.kind as LedgerKind[]),
        );
      }
      if (filter?.paid !== undefined) {
        conditions.push(
          filter.paid
            ? isNotNull(ledgerEntryTable.paidDate)
            : isNull(ledgerEntryTable.paidDate),
        );
      }
      if (filter?.from) conditions.push(gte(ledgerEntryTable.dueDate, filter.from));
      if (filter?.to) conditions.push(lte(ledgerEntryTable.dueDate, filter.to));

      const rows = await db
        .select()
        .from(ledgerEntryTable)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(ledgerEntryTable.dueDate));
      return rows.map(toLedgerEntry);
    },

    async listObligations(leaseId): Promise<Obligation[]> {
      const rows = leaseId
        ? await db
            .select()
            .from(obligationTable)
            .where(eq(obligationTable.leaseId, leaseId))
            .orderBy(asc(obligationTable.dueDate))
        : await db
            .select()
            .from(obligationTable)
            .orderBy(asc(obligationTable.dueDate));
      return rows.map(toObligation);
    },

    async inboxQueue(): Promise<LedgerEntry[]> {
      return [];
    },

    async markPaid(id: string, input: MarkPaidInput): Promise<LedgerEntry> {
      await db.execute(sql`select id from ledger_entry where id = ${id} for update`);
      const [current] = await db.select().from(ledgerEntryTable).where(eq(ledgerEntryTable.id, id)).limit(1);
      if (!current) throw new Error("Ledger entry not found.");
      if (current.paidDate) throw new Error("This rent entry is already paid. Reverse it before recording a correction.");
      const [updated] = await db
        .update(ledgerEntryTable)
        .set({
          paidDate: input.paidDate,
          paymentMethod: input.paymentMethod,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
        })
        .where(eq(ledgerEntryTable.id, id))
        .returning({ id: ledgerEntryTable.id });
      if (!updated) {
        throw new Error(`Ledger entry ${id} not found`);
      }
      return loadLedgerEntry(updated.id);
    },

    async markNextRentPaid(leaseId: string, input: MarkPaidInput): Promise<LedgerEntry> {
      await db.execute(sql`select id from lease where id = ${leaseId} for update`);
      // Load lease (must exist + not deleted).
      const [leaseRow] = await db
        .select()
        .from(leaseTable)
        .where(and(eq(leaseTable.id, leaseId), isNull(leaseTable.deletedAt)))
        .limit(1);
      if (!leaseRow) throw new Error(`Lease ${leaseId} not found`);

      const entries = await db
        .select()
        .from(ledgerEntryTable)
        .where(
          and(
            eq(ledgerEntryTable.leaseId, leaseId),
            eq(ledgerEntryTable.kind, "rent"),
            eq(ledgerEntryTable.direction, "in"),
          ),
        )
        .orderBy(asc(ledgerEntryTable.dueDate));

      const unpaid = entries.find((e) => !e.paidDate);
      if (unpaid) {
        const overrideAmount = input.amount?.amount !== undefined;
        const [updated] = await db
          .update(ledgerEntryTable)
          .set({
            paidDate: input.paidDate,
            paymentMethod: input.paymentMethod,
            reference: input.reference ?? null,
            notes: input.notes ?? null,
            ...(overrideAmount
              ? {
                  amountValue: String(input.amount!.amount),
                  amountCurrency: input.amount!.currency,
                }
              : {}),
          })
          .where(eq(ledgerEntryTable.id, unpaid.id))
          .returning({ id: ledgerEntryTable.id });
        if (!updated) throw new Error("Could not update rent entry");
        return loadLedgerEntry(updated.id);
      }

      // No unpaid → create the next rent entry using tranches.
      const trancheRows = await db
        .select()
        .from(rentScheduleTrancheTable)
        .where(eq(rentScheduleTrancheTable.leaseId, leaseId))
        .orderBy(asc(rentScheduleTrancheTable.sequence));
      if (trancheRows.length === 0) {
        throw new Error("Lease has no rent tranches.");
      }

      const lastDue = entries[entries.length - 1]?.dueDate;
      const nextDue = lastDue ? addMonthsIso(lastDue, 1) : trancheRows[0].startDate;
      const tranche =
        trancheRows.find((t) => t.startDate <= nextDue && nextDue <= t.endDate) ??
        trancheRows[trancheRows.length - 1];

      const amountValue =
        input.amount?.amount !== undefined
          ? String(input.amount.amount)
          : tranche.monthlyRentAmount;
      const amountCurrency = input.amount?.currency ?? tranche.monthlyRentCurrency;
      const [inserted] = await db
        .insert(ledgerEntryTable)
        .values({
          leaseId,
          counterpartyPartyId: leaseRow.lesseePartyId,
          kind: "rent",
          direction: "in",
          amountValue,
          amountCurrency,
          dueDate: nextDue,
          paidDate: input.paidDate,
          paymentMethod: input.paymentMethod,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
        })
        .returning({ id: ledgerEntryTable.id });
      if (!inserted) throw new Error("Could not create rent entry");
      return loadLedgerEntry(inserted.id);
    },

    async unmarkPaid(id: string): Promise<LedgerEntry> {
      const [updated] = await db
        .update(ledgerEntryTable)
        .set({
          paidDate: null,
          paymentMethod: null,
          reference: null,
          notes: null,
        })
        .where(eq(ledgerEntryTable.id, id))
        .returning({ id: ledgerEntryTable.id });
      if (!updated) {
        throw new Error(`Ledger entry ${id} not found`);
      }
      return loadLedgerEntry(updated.id);
    },
  },

  reminders: {
    async listQueue(_filter): Promise<Notification[]> {
      // Notification table not yet modelled — see SPEC §5. Empty until the
      // schema slice for /reminders lands.
      void _filter;
      return [];
    },

    async enqueue(): Promise<Notification> {
      throw new Error(
        "reminders.enqueue is not yet implemented — the notification table " +
          "isn't in the schema yet (SPEC §5). Send via Resend/Twilio directly " +
          "for now, or land the schema slice before persisting.",
      );
    },
  },

  onboarding: {
    async initiate(): Promise<never> {
      throw new Error(
        "onboarding.initiate is not yet implemented — see SPEC §7. Use " +
          "backend.leases.create() to persist the lease today; the workflow " +
          "engine (Vercel Workflows / AgentFabriq) lands later.",
      );
    },
    async status(): Promise<null> {
      return null;
    },
  },
};
