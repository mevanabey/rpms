import type { Lease, LeaseStatus, PaymentCadence } from "../types";

export interface LeaseListFilter {
  status?: LeaseStatus[];
  propertyId?: string;
  cadence?: PaymentCadence;
  search?: string;
}

export interface ILeaseService {
  list(filter?: LeaseListFilter): Promise<Lease[]>;
  get(id: string): Promise<Lease | null>;
  // Mutations land in Phase 02 — listed here as the contract:
  // create(intent: NewLeaseIntent): Promise<Lease>;
  // updateStatus(id: string, status: LeaseStatus): Promise<Lease>;
}
