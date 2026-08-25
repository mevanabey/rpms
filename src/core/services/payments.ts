import type { LedgerEntry, LedgerKind, Money, Obligation, PaymentMethod } from "../types";

export interface PaymentListFilter {
  leaseId?: string;
  kind?: LedgerKind[];
  paid?: boolean;
  from?: string;
  to?: string;
}

export interface MarkPaidInput {
  paidDate: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  /** Optional override of the recorded amount. When set, replaces the
   *  tranche-derived value for new rent entries and overwrites the amount on
   *  existing unpaid entries. Use when the tenant settled an amount that
   *  differs from the contracted monthly rent (partial payment, FX adjustment,
   *  rounded transfer, etc.). */
  amount?: Money;
}

export interface IPaymentService {
  listLedger(filter?: PaymentListFilter): Promise<LedgerEntry[]>;
  listObligations(leaseId?: string): Promise<Obligation[]>;
  inboxQueue(): Promise<LedgerEntry[]>;
  markPaid(id: string, input: MarkPaidInput): Promise<LedgerEntry>;
  unmarkPaid(id: string): Promise<LedgerEntry>;
  /** Mark the *next* rent line paid for a lease. If there's an existing
   *  unpaid rent ledger entry it gets updated; otherwise a new paid entry is
   *  created using the lease's tranches to compute due date + amount. */
  markNextRentPaid(leaseId: string, input: MarkPaidInput): Promise<LedgerEntry>;
}
