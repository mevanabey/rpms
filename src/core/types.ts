// Core domain types for RPMS. This module is the inner ring of ports-and-adapters
// (CLAUDE.md §6) — it must NEVER import from next, drizzle, clerk, vercel, or any
// IO library. Every adapter (mock / vercel-workflows / agent-fabriq) speaks these
// types.

export type Currency = "LKR" | "USD";

export interface Money {
  amount: number;
  currency: Currency;
}

// ───────────────────────────────────────────────────────── Parties

export type PartyKind = "individual" | "company";

export type PartyRole =
  | "lessor"
  | "lessee"
  | "client"
  | "tenant"
  | "introducer"
  | "advisor"
  | "lessor_lawyer"
  | "lessee_lawyer"
  | "accountant_handler"
  | "witness";

export interface Party {
  id: string;
  kind: PartyKind;
  displayName: string;
  legalName?: string;
  nicOrPassport?: string;
  companyRegNo?: string;
  emails: string[];
  phones: string[];
  /** Full postal address (single-line OK). Captured by the lease intake. */
  address?: string;
  notes?: string;
}

// ───────────────────────────────────────────────────────── Estate

export interface Property {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  district?: string;
  lotNo?: string;
  planNo?: string;
  perches?: number;
  asstNo?: string;
}

export type UnitType = "office" | "apartment" | "storage" | "penthouse" | "floor";
export type UnitStatus = "vacant" | "occupied" | "reserved";

export interface Unit {
  id: string;
  propertyId: string;
  label: string;
  type: UnitType;
  floor?: number | string;
  areaSqft?: number;
  bedrooms?: number;
  status: UnitStatus;
}

// ───────────────────────────────────────────────────────── Leases

export type LeaseKind = "head" | "sub";
export type LeasePurpose = "commercial" | "residential" | "bpo";
export type LeaseStatus =
  | "draft"
  | "signed"
  | "active"
  | "grace"
  | "terminated"
  | "expired"
  | "renewed";

export type PaymentCadence = "monthly" | "quarterly" | "biannual";
export type PaymentMethod =
  | "lkr_cash"
  | "lkr_transfer"
  | "usd_transfer"
  | "bank_draft"
  | "cheque";

export interface RentScheduleTranche {
  id: string;
  sequence: number;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;
  monthlyRent: Money;
  advanceSetoff?: Money;
  dueDayOfMonth: number;
  /** Free-text describing how the tranche is paid — e.g. "Advance set-off
   *  Rs. 600,000/month; balance Rs. 5,400,000/month by 26th". */
  paymentDescription?: string;
  /** For USD-denominated tranches that need an LKR equivalent at intake. */
  fxRateLkrPerUsd?: number;
}

export interface LeasePartyRole {
  partyId: string;
  role: PartyRole;
}

/** Which side of the lease is responsible for an operational expense. */
export type ResponsibleParty = "lessor" | "lessee" | "shared" | "other";

/** Subletting permission (lease clause). */
export type SublettingMode = "no" | "with_consent" | "to_group" | "yes";

/** The label the lawyer/handler put on the instrument at intake. */
export type AgreementLabel = "lease_agreement" | "rental_agreement" | "other";

/** Who the security deposit gets refunded to at end-of-term. */
export type DepositRefundTo = "lessee" | "lessor" | "other";

/**
 * Clause-level data captured by the handler checklist. Each field is optional
 * because both checklist samples (Lucky Seven head, Wijemuni residential sub)
 * leave different rows blank. The lease detail page hides empty entries.
 */
export interface LeaseClauses {
  managementFeesBy?: ResponsibleParty;
  managementFeesNote?: string;
  serviceChargesBy?: ResponsibleParty;
  serviceChargesNote?: string;
  acServiceBy?: ResponsibleParty;
  acServiceNote?: string;
  /** "every 3 months", "quarterly", … — checklist row "A/C service period". */
  acServicePeriod?: string;
  /** Below this LKR amount the lessee handles repairs themselves. */
  minorRepairsThreshold?: Money;
  /** Verbatim clause text (cleanliness / wear-and-tear / sanitary state). */
  maintenanceText?: string;
  /** Per-day penalty if the lessee fails to hand over at end-of-term. */
  handoverDelayPenalty?: Money;
  /** Free-text describing what happens on early termination
   *  (Lucky Seven: 6 months rent as LD; Wijemuni: full deposit forfeit). */
  earlyTerminationPenalty?: string;
  terminationNoticeMonths?: number;
  renewalNoticeMonths?: number;
  sublettingAllowed?: SublettingMode;
  sublettingNote?: string;
  depositRefundTo?: DepositRefundTo;
  depositRefundOther?: string;
  /** Money form of the "Advance payment" checklist row when the cell
   *  carries an amount (e.g. "per unit - 5,250 Two Units- 10,500") rather
   *  than a month count. `lease.advanceMonths` keeps the count-based form
   *  for legacy / commercial checklists; this field carries the figure for
   *  residential sub-lease checklists. */
  advancePaymentAmount?: Money;
  /** Checklist "Locking period" — kept as raw text because the cell often
   *  reads "N/A" / "not applicable" and the parsed `lockInEndDate` (lease
   *  body) is the structured equivalent when present. */
  lockInPeriodText?: string;
  /** Checklist "Additional Charges (if any)" — verbatim text or "N/A". */
  additionalCharges?: string;
  /** Checklist "Lessee's Current Employer". */
  lesseeEmployer?: string;
  /** Checklist "Applicability of WHT and any other taxes" — parsed side. */
  taxApplicabilityBy?: ResponsibleParty;
  /** Same field — raw text so "Lessee", "Both shared", etc. survive verbatim. */
  taxApplicabilityNote?: string;
  /** Checklist "If paid in USD how exchange rate is taken" — "Mid-rate", … */
  fxBasis?: string;
  /** Checklist "First exchange rate taken (LKR)" — LKR per USD as a number. */
  firstFxRate?: number;
  /** Verbatim FX rate cell (carries the "as 2026.04.27" suffix). */
  firstFxRateNote?: string;
  /** Checklist "CTP Lawyer Name" — kept as a name for display; the importer
   *  also creates a Party with the right `*_lawyer` role. */
  ctpLawyerName?: string;
  /** Free-text fallback when "Legal fees" / "Stamp duty" rows don't parse as
   *  money (e.g. "Either party will bear its own legal expenses", "N/A"). */
  legalFeesNote?: string;
  stampDutyNote?: string;
}

export interface Lease {
  id: string;
  propertyId: string;
  unitIds: string[];
  lessorPartyId: string;
  lesseePartyId: string;
  kind: LeaseKind;
  purpose: LeasePurpose;
  /** How the intake labelled the instrument: lease vs rental agreement. */
  agreementLabel?: AgreementLabel;
  agreementLabelOther?: string;
  startDate: string;
  endDate: string;
  graceEndDate?: string;
  lockInEndDate?: string;
  /** Months of rent collected up-front at signing. */
  advanceMonths?: number;
  /** Maximum number of occupants permitted by the clause body. */
  occupancyCap?: number;
  status: LeaseStatus;
  paymentCadence: PaymentCadence;
  defaultPaymentMethod: PaymentMethod;
  securityDeposit?: Money;
  stampDuty?: Money;
  legalFees?: Money;
  tranches: RentScheduleTranche[];
  /** Clause-level intake data captured per the handler checklist. */
  clauses?: LeaseClauses;
  additionalRoles?: LeasePartyRole[];
  parentLeaseId?: string; // sub-leases reference their head lease
  importMeta?: Record<string, unknown>; // raw source row when migrated
  /** Path inside the Supabase Storage `lease-documents` bucket where the
   *  executed (signed) lease is stored. Set means signed + active. */
  signedLeasePath?: string;
  /** ISO timestamp when the signed lease was uploaded. */
  signedLeaseUploadedAt?: string;
  /** Pre-signing onboarding stage. `undefined` = Draft (Step 1).
   *  Once the legal status is `active` the lease is at Step 5. */
  onboardingStage?: OnboardingStage;
  /** Draft (pre-signing) lease agreement stored in Supabase Storage. */
  agreementPath?: string;
  agreementGeneratedAt?: string;
  lawyerEmailSentAt?: string;
  advisorEmailSentAt?: string;
  accountsEmailSentAt?: string;
}

/**
 * Pipeline state between Draft and Active:
 *   "agreement_ready" = Step 2 (Send Emails) — agreement generated/uploaded
 *   "emails_sent"     = Step 3 (Advisor Approval) — both lawyer + advisor emailed
 *   "at_accounts"     = Step 4 (Accounts) — accounts emailed
 */
export type OnboardingStage = "agreement_ready" | "emails_sent" | "at_accounts";

// ───────────────────────────────────────────────────────── Money

export type LedgerKind =
  | "rent"
  | "deposit"
  | "stamp_duty"
  | "legal_fees"
  | "vat"
  | "late_fee"
  | "refund"
  | "commission"
  | "adjustment";

export type LedgerDirection = "in" | "out";

export interface LedgerEntry {
  id: string;
  leaseId: string;
  obligationId?: string;
  kind: LedgerKind;
  amount: Money;
  direction: LedgerDirection;
  counterpartyPartyId: string;
  dueDate: string;
  paidDate?: string;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
}

// ───────────────────────────────────────────────────────── Obligations

export type ObligationKind =
  | "rent_due"
  | "deposit_due"
  | "stamp_duty"
  | "legal_fees"
  | "insurance"
  | "lift_service"
  | "generator_service"
  | "fire_inspection"
  | "vat_reimbursement"
  | "colour_wash"
  | "renewal_notice"
  | "termination_notice"
  | "grace_end"
  | "lockin_end"
  | "escalation"
  | "lease_expiry"
  | "statue_inspection";

export type ObligationStatus = "pending" | "done" | "overdue" | "waived";

export interface Obligation {
  id: string;
  leaseId: string;
  kind: ObligationKind;
  dueDate: string;
  amount?: Money;
  ownerPartyId?: string;
  status: ObligationStatus;
  sourceClause?: string; // e.g. "§6(k)" — traceability back to lease
}

// ───────────────────────────────────────────────────────── Notifications

export type NotificationChannel = "email" | "whatsapp" | "sms";
export type NotificationStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "failed";

export interface Notification {
  id: string;
  channel: NotificationChannel;
  templateId: string;
  recipientPartyId: string;
  leaseId?: string;
  obligationId?: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  sentAt?: string;
  openedAt?: string;
  error?: string;
}

// ───────────────────────────────────────────────────────── Documents

export type DocumentKind =
  | "lease_draft"
  | "lease_signed"
  | "invoice"
  | "receipt"
  | "kyc_id"
  | "company_reg"
  | "stamp_duty_receipt"
  | "vat_invoice"
  | "notice"
  | "payment_proof";

export interface Document {
  id: string;
  kind: DocumentKind;
  partyId?: string;
  leaseId?: string;
  blobUrl: string;
  sha256: string;
  filename: string;
  mime: string;
  version: number;
  createdAt: string;
  signedStatus?: "unsigned" | "sent" | "signed" | "declined";
  signedAt?: string;
  esigEnvelopeId?: string;
}

// ───────────────────────────────────────────────────────── Workflow runs

export interface WorkflowRun {
  id: string;
  workflowKind: string;
  leaseId?: string;
  startedAt: string;
  finishedAt?: string;
  status: "queued" | "running" | "succeeded" | "failed" | "compensated";
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}
