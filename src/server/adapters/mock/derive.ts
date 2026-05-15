/**
 * Materialize per-month rent obligations + back-dated ledger entries from
 * `Lease.tranches`. Phase 01 prototype: gives the UI realistic data without
 * a real database.
 */
import type { LedgerEntry, Lease, Obligation } from "@/core/types";

// Pinned to CLAUDE.md global "today". Real backend will use the real clock.
const TODAY = "2026-05-05";

// A handful of leases get a deliberately-unpaid past due, to populate the
// Arrears report with realistic content.
const ARREARS_LEASE_IDS = new Set(["lease_alfred_15", "lease_cap_44bc2"]);

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const targetMonth = date.getUTCMonth() + months;
  date.setUTCMonth(targetMonth);
  // setMonth caps the day correctly for short months (e.g. Jan 31 → Feb 28).
  return date.toISOString().slice(0, 10);
}

function cadenceStep(cadence: Lease["paymentCadence"]): number {
  if (cadence === "monthly") return 1;
  if (cadence === "quarterly") return 3;
  return 6;
}

function inGrace(lease: Lease, dueDate: string): boolean {
  return lease.graceEndDate !== undefined && dueDate <= lease.graceEndDate;
}

export function deriveObligationsAndLedger(leases: Lease[]): {
  obligations: Obligation[];
  ledger: LedgerEntry[];
} {
  const obligations: Obligation[] = [];
  const ledger: LedgerEntry[] = [];
  const step = (l: Lease) => cadenceStep(l.paymentCadence);
  const counterpartyOf = (l: Lease) => l.lesseePartyId;

  for (const lease of leases) {
    if (lease.status === "draft") continue;
    let arrearsBudget = ARREARS_LEASE_IDS.has(lease.id) ? 1 : 0;

    for (const tr of lease.tranches) {
      let dueDate = tr.startDate;
      let i = 0;
      while (dueDate <= tr.endDate && dueDate <= lease.endDate) {
        const isFuture = dueDate > TODAY;
        const skipForGrace = inGrace(lease, dueDate);

        if (!skipForGrace) {
          // Build a per-cycle ledger entry.
          const id = `led_${lease.id}_${tr.id}_${i}`;
          const paid = !isFuture && arrearsBudget === 0;
          if (!isFuture && arrearsBudget > 0) {
            arrearsBudget -= 1;
          }
          ledger.push({
            id,
            leaseId: lease.id,
            kind: "rent",
            amount: tr.monthlyRent,
            direction: "in",
            counterpartyPartyId: counterpartyOf(lease),
            dueDate,
            paidDate: paid ? dueDate : undefined,
            paymentMethod: lease.defaultPaymentMethod,
          });
          // Pending or overdue → emit a rent_due obligation too.
          if (!paid) {
            const isOverdue = dueDate < TODAY;
            obligations.push({
              id: `ob_${lease.id}_${tr.id}_${i}`,
              leaseId: lease.id,
              kind: "rent_due",
              dueDate,
              amount: tr.monthlyRent,
              status: isOverdue ? "overdue" : "pending",
              sourceClause: "§3",
            });
          }
        }

        dueDate = addMonths(dueDate, step(lease));
        i += 1;
        if (i > 240) break; // safety
      }
    }

    // Per-lease one-time obligations beyond the rent stream.
    if (lease.securityDeposit) {
      const paid = lease.startDate <= TODAY;
      ledger.push({
        id: `led_${lease.id}_deposit`,
        leaseId: lease.id,
        kind: "deposit",
        amount: lease.securityDeposit,
        direction: "in",
        counterpartyPartyId: lease.lesseePartyId,
        dueDate: lease.startDate,
        paidDate: paid ? lease.startDate : undefined,
        paymentMethod: lease.defaultPaymentMethod,
      });
    }
  }

  return { obligations, ledger };
}
