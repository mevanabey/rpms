import type { LedgerEntry, LedgerKind, Obligation } from "../types";

export interface PaymentListFilter {
  leaseId?: string;
  kind?: LedgerKind[];
  paid?: boolean;
  from?: string;
  to?: string;
}

export interface IPaymentService {
  listLedger(filter?: PaymentListFilter): Promise<LedgerEntry[]>;
  listObligations(leaseId?: string): Promise<Obligation[]>;
  inboxQueue(): Promise<LedgerEntry[]>; // unmatched bank-advice candidates
}
