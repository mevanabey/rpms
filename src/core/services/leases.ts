import type { ChecklistApprovalInput } from "@/lib/checklist/review";
import type { SavedChecklist } from "../checklists";
import type {
  AgreementLabel,
  Lease,
  LeaseClauses,
  LeaseKind,
  LeasePartyRole,
  LeasePurpose,
  LeaseStatus,
  Money,
  OnboardingStage,
  PaymentCadence,
  PaymentMethod,
  Party,
  Property,
  Unit,
  Obligation,
  LedgerEntry,
  RentScheduleTranche,
} from "../types";

export interface LeaseListFilter {
  /** Explicit server-side scope. An empty array matches no leases. */
  ids?: string[];
  status?: LeaseStatus[];
  propertyId?: string;
  cadence?: PaymentCadence;
  search?: string;
}

/** Data needed by the lease table, loaded together by the database adapter. */
export interface LeaseOverview {
  lease: Lease;
  property?: Property;
  lessor?: Party;
  lessee?: Party;
  advisor?: Party;
  nextRentEntry?: LedgerEntry;
}

/** A lease and its own relations; relatedLeases contains only its parent
 * and direct children. Authorization removes inaccessible related leases. */
export interface LeaseDetails {
  lease: Lease;
  property: Property | null;
  units: Unit[];
  parties: Party[];
  obligations: Obligation[];
  ledger: LedgerEntry[];
  relatedLeases: Lease[];
}

/**
 * Intent shape accepted by `leases.create` — mirrors the new-lease wizard
 * output. Each tranche is provided without an `id` (the adapter assigns one).
 */
export interface LeaseCreateIntent {
  propertyId: string;
  unitIds: string[];
  lessorPartyId: string;
  lesseePartyId: string;
  parentLeaseId?: string;
  kind: LeaseKind;
  purpose: LeasePurpose;
  agreementLabel?: AgreementLabel;
  agreementLabelOther?: string;
  status?: LeaseStatus;
  paymentCadence: PaymentCadence;
  defaultPaymentMethod: PaymentMethod;
  startDate: string;
  endDate: string;
  graceEndDate?: string;
  lockInEndDate?: string;
  advanceMonths?: number;
  occupancyCap?: number;
  securityDeposit?: Money;
  stampDuty?: Money;
  legalFees?: Money;
  clauses?: LeaseClauses;
  additionalRoles?: LeasePartyRole[];
  tranches: Array<Omit<RentScheduleTranche, "id">>;
  /** Optional legal_entity code (e.g. "CTH"). Falls back to the default. */
  legalEntityCode?: string;
  /** Server-supplied provenance; public lease actions reject this field. */
  importMeta?: Record<string, unknown>;
}

/**
 * Patch over the checklist clause bag. Every key is optional; `null` clears
 * the clause, an omitted key leaves it untouched. Adapters merge this into the
 * stored `clauses` object rather than replacing it.
 */
export type LeaseClausesPatch = {
  [K in keyof LeaseClauses]?: LeaseClauses[K] | null;
};

/**
 * Editable subset of a lease. Every field is optional — only the keys present
 * are written. Use `null` to clear a nullable field; omit it to leave it
 * unchanged.
 *
 * `unitIds` and `additionalRoles` replace the whole relation when present
 * (they're small sets, and partial diffs would be ambiguous). `clauses` is
 * merged key-by-key.
 */
export interface LeaseUpdateInput {
  lessorPartyId?: string;
  lesseePartyId?: string;
  purpose?: LeasePurpose;
  agreementLabel?: AgreementLabel | null;
  agreementLabelOther?: string | null;
  status?: LeaseStatus;
  paymentCadence?: PaymentCadence;
  defaultPaymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  graceEndDate?: string | null;
  lockInEndDate?: string | null;
  advanceMonths?: number | null;
  occupancyCap?: number | null;
  securityDeposit?: Money | null;
  stampDuty?: Money | null;
  legalFees?: Money | null;
  clauses?: LeaseClausesPatch;
  /** Replaces the lease's unit set. Every unit must belong to the lease's
   *  property. */
  unitIds?: string[];
  /** Replaces the lease's non-lessor/lessee role assignments. */
  additionalRoles?: LeasePartyRole[];
}

/**
 * Editable subset of one rent-schedule tranche. Same rules as
 * `LeaseUpdateInput` — present keys are written, `null` clears.
 */
export interface TrancheUpdateInput {
  startDate?: string;
  endDate?: string;
  monthlyRent?: Money;
  advanceSetoff?: Money | null;
  dueDayOfMonth?: number;
  paymentDescription?: string | null;
  fxRateLkrPerUsd?: number | null;
}

export interface ILeaseService {
  approveChecklist(id: string, input: ChecklistApprovalInput): Promise<Lease>;
  getChecklist(id: string): Promise<SavedChecklist | null>;
  saveChecklist(id: string, checklist: SavedChecklist): Promise<void>;
  list(filter?: LeaseListFilter): Promise<Lease[]>;
  listOverview(filter?: LeaseListFilter): Promise<LeaseOverview[]>;
  get(id: string): Promise<Lease | null>;
  getDetails(id: string): Promise<LeaseDetails | null>;
  create(intent: LeaseCreateIntent): Promise<Lease>;
  updateStatus(id: string, status: LeaseStatus): Promise<Lease>;
  /** Patch a lease's own fields. Throws if the lease doesn't exist. */
  update(id: string, patch: LeaseUpdateInput): Promise<Lease>;
  /** Patch one rent-schedule tranche. Throws if the lease or tranche is
   *  unknown, or the tranche doesn't belong to the lease. */
  updateTranche(
    leaseId: string,
    trancheId: string,
    patch: TrancheUpdateInput,
  ): Promise<Lease>;
  /** Soft delete — sets deletedAt; the row stays in the DB but is hidden from
   *  every read (list/get return as if it were gone). */
  softDelete(id: string): Promise<void>;
  /** Record the path of an uploaded signed lease and atomically flip the
   *  lease's legal status to `active`. */
  attachSignedLease(id: string, storagePath: string): Promise<Lease>;
  /** Advance the pre-signing onboarding stage. Pass `null` to reset to Draft. */
  setOnboardingStage(id: string, stage: OnboardingStage | null): Promise<Lease>;
  /** Record that the draft lease agreement has been generated or uploaded to
   *  the given storage path. If the lease is still Draft, also advance the
   *  onboarding stage to `agreement_ready` (Send Emails). */
  markAgreementGenerated(id: string, storagePath: string): Promise<Lease>;
  /** Record an email send for the lease. `lawyer`/`advisor` advance to
   *  `emails_sent` once both are sent. `accounts` advances to `at_accounts`. */
  markLeaseEmailSent(id: string, kind: "lawyer" | "advisor" | "accounts"): Promise<Lease>;
  /** Flip the legal status to `active`. */
  markLeaseActive(id: string): Promise<Lease>;
  /**
   * Materialise one unpaid `rent` ledger entry per month for the lease's full
   * term. Idempotent — entries are keyed by `(leaseId, kind=rent, dueDate)`,
   * so re-running skips months that already have an entry.
   *
   * Returns the count of entries created (excluding skips).
   */
  generateRentSchedule(id: string): Promise<{ created: number; skipped: number }>;
}
