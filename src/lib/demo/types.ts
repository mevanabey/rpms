/**
 * Client-side demo state shape. This is the "system is alive" overlay that
 * makes the Phase 01 prototype feel autonomous: activity feed, approval queue,
 * autonomy training matrix, and decisions log.
 *
 * IMPORTANT: this lives in the *client* layer. The mock backend
 * (src/server/adapters/mock) seeds the static world; this store is the live
 * pulse. Phase 02 replaces both with real Vercel Workflows + Postgres.
 */
import type { Currency } from "@/core/types";

export type WorkflowKind =
  | "rent-collection-cycle"
  | "lease-lifecycle-tick"
  | "compliance-scheduler"
  | "bank-reconcile"
  | "commission-accrual"
  | "commission-payout"
  | "esign-resume"
  | "breach-detect"
  | "renewal-open"
  | "move-out"
  | "onboard-tenant";

export type AutonomyLevel = "manual" | "human-gated" | "auto-with-review" | "auto";

export type Severity = "info" | "success" | "warning" | "error";

export interface Money {
  amount: number;
  currency: Currency;
}

export interface Activity {
  id: string;
  ts: number; // Date.now()
  workflow: WorkflowKind | "system" | "human";
  severity: Severity;
  title: string;
  body?: string;
  leaseId?: string;
  partyId?: string;
  amount?: Money;
  acked: boolean;
}

export type ApprovalTone = "primary" | "secondary" | "destructive";

export interface ApprovalOption {
  id: string;
  label: string;
  tone: ApprovalTone;
}

export interface ApprovalDecision {
  ts: number;
  optionId: string;
  by: "human" | "auto";
  note?: string;
}

/**
 * Document kinds — must align with the categories shown on /documents and
 * the SPEC §11 document model. Every attachment carried by an approval / lease /
 * party rolls up into the central Documents vault.
 */
export type DocumentKind =
  | "lease_signed"
  | "lease_draft"
  | "kyc_id"
  | "kyc_employer"
  | "kyc_company_reg"
  | "stamp_duty_receipt"
  | "vat_invoice"
  | "receipt"
  | "intake_checklist"
  | "other";

/**
 * A document reference attached to an approval. The same shape is reused as the
 * canonical "Document" projection across the lease detail page, party detail
 * page, and the /documents vault — so anything attached to a decision is also
 * visible from every relevant business object.
 */
export interface ApprovalAttachment {
  id: string;
  name: string;
  kind: DocumentKind;
  mimeType?: string;
  sizeKb?: number;
  /** Public/blob URL — Phase 02 swaps this for a Vercel Blob signed URL. */
  url?: string;
  uploadedAt?: number;
  uploadedBy?: string;
  /** Free-form note shown next to the file (e.g. "AI confidence 88%"). */
  note?: string;
}

export interface ApprovalRequest {
  id: string;
  ts: number;
  workflow: WorkflowKind;
  title: string;
  question: string;
  context: string[];
  leaseId?: string;
  /** Party this approval relates to (used by party-detail to surface KYC docs). */
  partyId?: string;
  amount?: Money;
  attachments?: ApprovalAttachment[];
  options: ApprovalOption[];
  decision?: ApprovalDecision;
}

export interface AutonomyEntry {
  workflow: WorkflowKind;
  level: AutonomyLevel;
  approvedHuman: number;
  rejectedHuman: number;
  autoExecutions: number;
  confidencePct: number; // 0-100
  lastDecisionTs?: number;
}

export interface DraftLease {
  id: string;
  ts: number;
  /** Free-form intent from the wizard — Phase 02 maps this to a real Lease. */
  intent: Record<string, unknown>;
  status: "draft" | "in_review" | "queued";
}

export interface DraftProperty {
  id: string;
  ts: number;
  name: string;
  addressLine: string;
  city: string;
  lotNo?: string;
  planNo?: string;
  perches?: number;
  asstNo?: string;
}

export type DraftUnitType = "office" | "apartment" | "storage" | "penthouse" | "floor";
export type DraftUnitStatus = "vacant" | "occupied" | "reserved";

export interface DraftUnit {
  id: string;
  ts: number;
  propertyId: string;
  label: string;
  type: DraftUnitType;
  floor?: string;
  areaSqft?: number;
  bedrooms?: number;
  status: DraftUnitStatus;
}

export type DraftPartyKind = "individual" | "company";

export interface DraftParty {
  id: string;
  ts: number;
  kind: DraftPartyKind;
  displayName: string;
  legalName?: string;
  nicOrPassport?: string;
  companyRegNo?: string;
  emails: string[];
  phones: string[];
  notes?: string;
}

export type TicketSeverity = "low" | "medium" | "high" | "urgent";
export type TicketStatus = "open" | "in_progress" | "blocked" | "done" | "cancelled";
export type TicketCategory =
  | "plumbing"
  | "electrical"
  | "structural"
  | "appliance"
  | "lift"
  | "generator"
  | "fire"
  | "cleaning"
  | "other";

export interface TicketComment {
  id: string;
  ts: number;
  author: string;
  body: string;
  kind: "note" | "status_change" | "assign" | "cost_estimate";
}

export interface MaintenanceTicket {
  id: string;
  ts: number;
  propertyId: string;
  unitId?: string;
  leaseId?: string;
  title: string;
  description: string;
  category: TicketCategory;
  severity: TicketSeverity;
  status: TicketStatus;
  reportedBy?: string;
  assignedTo?: string;
  costEstimate?: Money;
  /** Per Lucky Seven §4(m): running maintenance capped Rs. 75,000 / job / floor. */
  costCapApplies?: boolean;
  comments: TicketComment[];
}

// Re-exported lazily through store/use-store to keep types consolidated here.
import type { Resource, Role, RoleDefinition } from "./identity";

/**
 * User-edited template content. Keyed by template id. Empty body / missing
 * subject means "use the default from TEMPLATE_DEFS".
 */
export interface TemplateOverride {
  subject?: string;
  body?: string;
  updatedAt: number;
  updatedBy?: string;
}

/**
 * Local "marked paid" overlay for ledger entries. Phase 01 stores these
 * client-side so the demo can persist manual reconciliations across
 * refreshes; Phase 02 replaces this with a real row update on the server.
 */
export interface RentPaymentRecord {
  ts: number;
  paidDate: string; // YYYY-MM-DD
  by: string; // user name
  method: "lkr_transfer" | "usd_transfer" | "lkr_cash" | "bank_draft" | "cheque";
  reference?: string;
}

/** A captured signature for a (lease, party). Base64 PNG data URL. */
export interface LeaseSignatureRecord {
  dataUrl: string;
  signedAt: string; // ISO timestamp
  by: string; // user display name
}

/**
 * Operator-tweakable copy on the auto-generated lease PDF. All fields are
 * optional — falsy values fall back to the template's built-in defaults.
 */
export interface LeaseDocSettings {
  brandLine?: string;
  brandTagline?: string;
  draftBannerText?: string;
  footerNote?: string;
  /** Override the auto-derived agreement title (e.g. "Indenture of Lease"). */
  agreementTitleOverride?: string;
  /** Optional executor clause printed above the signature blocks. */
  executionClause?: string;
}

/** One queued / sent rent reminder click. */
export interface RentReminderRecord {
  id: string;
  ts: number;
  ledgerEntryId: string;
  leaseId: string;
  to: string[]; // recipient emails
  by: string; // user name
}

export interface DemoState {
  activities: Activity[];
  approvals: ApprovalRequest[];
  autonomy: Record<WorkflowKind, AutonomyEntry>;
  draftLeases: DraftLease[];
  draftProperties: DraftProperty[];
  draftUnits: DraftUnit[];
  draftParties: DraftParty[];
  tickets: MaintenanceTicket[];
  templateOverrides: Record<string, TemplateOverride>;
  /** Manually-marked rent payments, keyed by ledger entry id. */
  rentPayments: Record<string, RentPaymentRecord>;
  /** History of reminder emails the operator has sent from /rent. */
  rentReminders: RentReminderRecord[];
  /** Phase 01 overlay: addresses captured by the lease intake form per party.
   *  Phase 02 patches the Party row in Postgres instead. */
  partyAddresses: Record<string, string>;
  /** Phase 01 e-signature overlay: per-lease, per-party signature captures.
   *  Phase 02 replaces this with DropboxSign/DocuSign webhook events. */
  leaseSignatures: Record<string, Record<string, LeaseSignatureRecord>>;
  /** Operator-tweakable copy on the auto-generated lease PDF template. */
  leaseDocSettings: LeaseDocSettings;
  /** Identity — RBAC user simulation. `null` means logged-out → /login. */
  currentUserId: string | null;
  /** Runtime-editable role catalogue. Seeded from DEFAULT_ROLES. */
  roleDefs: RoleDefinition[];
  /** Runtime-editable permissions per role. Seeded from DEFAULT_PERMISSIONS. */
  permissions: Record<Role, Resource[]>;
  /** Tracks tour completion so we don't auto-launch repeatedly. */
  tourCompletedAt?: number;
  /** Last simulated tick — used by the sim engine to throttle. */
  lastTickAt?: number;
  /** When `false`, the sim engine is paused (e.g. during a tour). */
  simEnabled: boolean;
  hydrated: boolean;
}

export const WORKFLOW_LABEL: Record<WorkflowKind, string> = {
  "rent-collection-cycle": "Rent collection",
  "lease-lifecycle-tick": "Lease lifecycle",
  "compliance-scheduler": "Compliance",
  "bank-reconcile": "Bank reconciliation",
  "commission-accrual": "Commission accrual",
  "commission-payout": "Commission payout",
  "esign-resume": "E-signature",
  "breach-detect": "Breach detection",
  "renewal-open": "Renewal",
  "move-out": "Move-out",
  "onboard-tenant": "Tenant onboarding",
};

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  lease_signed: "Signed lease",
  lease_draft: "Draft lease",
  kyc_id: "KYC · ID",
  kyc_employer: "KYC · Employer",
  kyc_company_reg: "KYC · Company reg",
  stamp_duty_receipt: "Stamp duty",
  vat_invoice: "VAT invoice",
  receipt: "Receipt",
  intake_checklist: "Intake checklist",
  other: "Other",
};

export const AUTONOMY_LABEL: Record<AutonomyLevel, string> = {
  manual: "Manual",
  "human-gated": "Human-gated",
  "auto-with-review": "Auto · post-review",
  auto: "Fully automated",
};

export const AUTONOMY_DESCRIPTION: Record<AutonomyLevel, string> = {
  manual: "Every action requires a human to start it.",
  "human-gated": "The system drives, but pauses at key gates for human OK.",
  "auto-with-review": "The system acts on its own; a human reviews after the fact.",
  auto: "Runs end-to-end with no human touch unless something exceptional happens.",
};

export const AUTONOMY_NEXT: Record<AutonomyLevel, AutonomyLevel | null> = {
  manual: "human-gated",
  "human-gated": "auto-with-review",
  "auto-with-review": "auto",
  auto: null,
};

/**
 * Promotion thresholds — confidence pct required to graduate to the next level.
 * The decision matrix view exposes these so non-technical viewers can see
 * "system is X% trained on Y; promotes at Z%".
 */
export const AUTONOMY_THRESHOLD: Record<AutonomyLevel, number> = {
  manual: 25,
  "human-gated": 60,
  "auto-with-review": 90,
  auto: 100,
};
