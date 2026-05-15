import { DEFAULT_PERMISSIONS, DEFAULT_ROLES } from "./identity";
import type {
  Activity,
  ApprovalRequest,
  AutonomyEntry,
  DemoState,
  MaintenanceTicket,
  WorkflowKind,
} from "./types";

// Pinned baseline so the seed is deterministic on both server and client.
// Real activities created via the store get unique runtime ids; this set is
// only the initial overlay shown before any rehydration.
const SEED_BASE_TS = 1_714_924_800_000; // stable timestamp (2024-05-05)
const NOW = SEED_BASE_TS;
const MIN = 60_000;
const HOUR = 60 * MIN;

function id(prefix: string, n: number): string {
  return `${prefix}_seed_${n}`;
}

const SEED_ACTIVITIES: Activity[] = [
  {
    id: id("act", 1),
    ts: NOW - 2 * MIN,
    workflow: "rent-collection-cycle",
    severity: "success",
    title: "Reminder sent · Trizen T1 32 C3",
    body: "T-7 day pre-bill email + WhatsApp delivered to tenant.",
    leaseId: "lease_trz_t1_32",
    acked: false,
  },
  {
    id: id("act", 2),
    ts: NOW - 11 * MIN,
    workflow: "bank-reconcile",
    severity: "success",
    title: "Payment matched automatically",
    body: "Sampath Bank credit advice → matched to Capitol ET 21 A2b rent. Confidence 96%.",
    leaseId: "lease_cap_et_21",
    amount: { amount: 1400, currency: "USD" },
    acked: false,
  },
  {
    id: id("act", 3),
    ts: NOW - 27 * MIN,
    workflow: "compliance-scheduler",
    severity: "info",
    title: "Lift service scheduled · Lucky Seven",
    body: "Vendor confirmed for 2026-05-12. Lessor-funded.",
    leaseId: "lease_lucky_seven_head",
    acked: true,
  },
  {
    id: id("act", 4),
    ts: NOW - 41 * MIN,
    workflow: "rent-collection-cycle",
    severity: "warning",
    title: "Day-1 late notice queued · Alfred 15",
    body: "Rent unpaid 1 day past due. Notification awaiting send window.",
    leaseId: "lease_alfred_15",
    acked: true,
  },
  {
    id: id("act", 5),
    ts: NOW - 1 * HOUR - 8 * MIN,
    workflow: "esign-resume",
    severity: "success",
    title: "Lease signed · CTR Thimbirigasyaya A2",
    body: "DropboxSign envelope completed. Activated; obligations materialized.",
    leaseId: "lease_ctr_a2",
    acked: true,
  },
  {
    id: id("act", 6),
    ts: NOW - 2 * HOUR - 14 * MIN,
    workflow: "lease-lifecycle-tick",
    severity: "info",
    title: "Renewal window opened · Trizen T3 36 C5",
    body: "12 months until expiry. Renewal workflow queued.",
    leaseId: "lease_trz_t3_36_c5",
    acked: true,
  },
  {
    id: id("act", 7),
    ts: NOW - 3 * HOUR - 5 * MIN,
    workflow: "commission-accrual",
    severity: "success",
    title: "Commission accrued · Stephen",
    body: "$1,400 introducer fee accrued for CTR A1. Payable in next batch.",
    partyId: "party_introducer_stephen",
    amount: { amount: 1400, currency: "USD" },
    acked: true,
  },
];

const SEED_APPROVALS: ApprovalRequest[] = [
  {
    id: id("ap", 1),
    ts: NOW - 4 * MIN,
    workflow: "rent-collection-cycle",
    title: "Send 14-day overdue notice?",
    question:
      "Alfred 15 rent is 14 days overdue. Send escalation notice with handler CC?",
    context: [
      "Tenant: Alfred 15 — Unit 1",
      "Amount overdue: Rs. 180,000",
      "Days late: 14",
      "Last contact: T-1 day reminder (delivered, not opened)",
    ],
    leaseId: "lease_alfred_15",
    amount: { amount: 180_000, currency: "LKR" },
    options: [
      { id: "approve", label: "Send notice", tone: "primary" },
      { id: "skip", label: "Skip · contact tenant", tone: "secondary" },
      { id: "escalate", label: "Escalate to legal", tone: "destructive" },
    ],
  },
  {
    id: id("ap", 2),
    ts: NOW - 18 * MIN,
    workflow: "bank-reconcile",
    title: "Match this bank advice?",
    question:
      "Commercial Bank credit (LKR 540,000) doesn't match exactly to any obligation. Best candidate confidence 71%.",
    context: [
      "Reference: SLIPS/INV/CT/0428",
      "Closest match: Lucky Seven · partial advance rent",
      "Amount diff: -Rs. 60,000 (likely partial payment)",
      "Date: 2026-05-04",
    ],
    leaseId: "lease_lucky_seven_head",
    amount: { amount: 540_000, currency: "LKR" },
    options: [
      { id: "match_partial", label: "Confirm · partial", tone: "primary" },
      { id: "match_full", label: "Match in full", tone: "secondary" },
      { id: "park", label: "Park in inbox", tone: "destructive" },
    ],
  },
  {
    id: id("ap", 3),
    ts: NOW - 36 * MIN,
    workflow: "onboard-tenant",
    title: "KYC review · Capitol T2 12 B2",
    question:
      "New tenant Ferdy Sugianto submitted passport + employer letter. AI confidence 88%. Approve & continue draft?",
    context: [
      "Property: Capitol TwinPeaks · T2 12 B2",
      "Lessee: MRL · Tenant: Ferdy Sugianto",
      "Auto-checks passed: passport OCR · employer match · sanctions clean",
    ],
    leaseId: "lease_cap_t2_12",
    partyId: "party_tenant_ferdy",
    attachments: [
      {
        id: "doc_seed_kyc_passport",
        name: "Sugianto-Ferdy-Passport-PHL.pdf",
        kind: "kyc_id",
        mimeType: "application/pdf",
        sizeKb: 1840,
        url: "/docs/lucky-seven-signed-lease.pdf",
        uploadedAt: NOW - 48 * MIN,
        uploadedBy: "Tenant intake",
        note: "OCR confidence 96%",
      },
      {
        id: "doc_seed_kyc_employer",
        name: "Tech-City-Employer-Letter-2026.pdf",
        kind: "kyc_employer",
        mimeType: "application/pdf",
        sizeKb: 412,
        url: "/docs/lucky-seven-signed-lease.pdf",
        uploadedAt: NOW - 47 * MIN,
        uploadedBy: "Tenant intake",
        note: "Employer match · sanctions clean",
      },
    ],
    options: [
      { id: "approve", label: "Approve · continue", tone: "primary" },
      { id: "request", label: "Request more info", tone: "secondary" },
      { id: "reject", label: "Reject", tone: "destructive" },
    ],
  },
  {
    id: id("ap", 4),
    ts: NOW - 12 * MIN,
    workflow: "onboard-tenant",
    title: "Draft lease ready · Capitol T2 12 B2",
    question:
      "KYC approved · system generated a 1-year sublease draft from the BPO template (USD 1,250 / month, 3-month deposit). Send for lawyer review & e-signature?",
    context: [
      "Lessor: Mr. Upul · Lessee: MRL · Tenant: Ferdy Sugianto",
      "Term: 2026-09-03 → 2027-09-02 · Cadence: monthly",
      "Rent USD 1,250 · Deposit 3 mo · Stamp duty pre-filled at 2%",
      "Template: BPO sublease v3.2 · No clauses required manual override",
    ],
    leaseId: "lease_cap_t2_12",
    partyId: "party_tenant_ferdy",
    amount: { amount: 1_250, currency: "USD" },
    attachments: [
      {
        id: "doc_seed_lease_draft",
        name: "Capitol-T2-12-B2-Draft-Lease-v1.pdf",
        kind: "lease_draft",
        mimeType: "application/pdf",
        sizeKb: 226,
        url: "/docs/lucky-seven-signed-lease.pdf",
        uploadedAt: NOW - 13 * MIN,
        uploadedBy: "onboard-tenant · auto",
        note: "Generated from BPO template v3.2",
      },
      {
        id: "doc_seed_lease_checklist",
        name: "Capitol-T2-12-B2-Intake-Checklist.pdf",
        kind: "intake_checklist",
        mimeType: "application/pdf",
        sizeKb: 88,
        url: "/docs/lucky-seven-signed-lease.pdf",
        uploadedAt: NOW - 35 * MIN,
        uploadedBy: "Handler",
        note: "All KYC items ticked",
      },
    ],
    options: [
      { id: "approve", label: "Send for lawyer review", tone: "primary" },
      { id: "request", label: "Edit draft", tone: "secondary" },
      { id: "reject", label: "Reject draft", tone: "destructive" },
    ],
  },
];

const AUTONOMY_DEFAULTS: Array<Omit<AutonomyEntry, "lastDecisionTs">> = [
  { workflow: "rent-collection-cycle", level: "human-gated", approvedHuman: 18, rejectedHuman: 1, autoExecutions: 47, confidencePct: 72 },
  { workflow: "bank-reconcile", level: "human-gated", approvedHuman: 24, rejectedHuman: 2, autoExecutions: 31, confidencePct: 81 },
  { workflow: "compliance-scheduler", level: "auto-with-review", approvedHuman: 42, rejectedHuman: 0, autoExecutions: 89, confidencePct: 96 },
  { workflow: "lease-lifecycle-tick", level: "human-gated", approvedHuman: 8, rejectedHuman: 0, autoExecutions: 12, confidencePct: 64 },
  { workflow: "commission-accrual", level: "auto-with-review", approvedHuman: 31, rejectedHuman: 1, autoExecutions: 56, confidencePct: 92 },
  { workflow: "commission-payout", level: "manual", approvedHuman: 4, rejectedHuman: 0, autoExecutions: 0, confidencePct: 18 },
  { workflow: "esign-resume", level: "auto-with-review", approvedHuman: 15, rejectedHuman: 0, autoExecutions: 22, confidencePct: 88 },
  { workflow: "breach-detect", level: "human-gated", approvedHuman: 3, rejectedHuman: 0, autoExecutions: 5, confidencePct: 41 },
  { workflow: "renewal-open", level: "human-gated", approvedHuman: 6, rejectedHuman: 1, autoExecutions: 4, confidencePct: 52 },
  { workflow: "move-out", level: "manual", approvedHuman: 1, rejectedHuman: 0, autoExecutions: 0, confidencePct: 8 },
  { workflow: "onboard-tenant", level: "human-gated", approvedHuman: 11, rejectedHuman: 2, autoExecutions: 0, confidencePct: 49 },
];

export function buildInitialDemoState(): DemoState {
  const autonomy = Object.fromEntries(
    AUTONOMY_DEFAULTS.map((entry) => [entry.workflow, { ...entry } as AutonomyEntry]),
  ) as Record<WorkflowKind, AutonomyEntry>;

  return {
    activities: SEED_ACTIVITIES,
    approvals: SEED_APPROVALS,
    autonomy,
    draftLeases: [],
    draftProperties: [],
    draftUnits: [],
    draftParties: [],
    tickets: SEED_TICKETS,
    templateOverrides: {},
    rentPayments: {},
    rentReminders: [],
    partyAddresses: {},
    leaseSignatures: {},
    leaseDocSettings: {},
    currentUserId: null,
    roleDefs: DEFAULT_ROLES.map((r) => ({ ...r })),
    permissions: Object.fromEntries(
      Object.entries(DEFAULT_PERMISSIONS).map(([k, v]) => [k, [...v]]),
    ) as Record<string, typeof DEFAULT_PERMISSIONS[string]>,
    simEnabled: true,
    hydrated: false,
  };
}

const SEED_TICKETS: MaintenanceTicket[] = [
  {
    id: "ticket_seed_1",
    ts: NOW - 2 * HOUR,
    propertyId: "prop_lucky_seven",
    unitId: "unit_l7_pent",
    leaseId: "lease_lucky_seven_head",
    title: "Penthouse statue No. 7 — visible chip on base",
    description:
      "Tenant reported a small chip on the base of the seventh sculpture during weekly walk-through. Photo attached. Replacement requirement TBD pending vendor inspection.",
    category: "structural",
    severity: "medium",
    status: "open",
    reportedBy: "Capital Trust handler",
    costCapApplies: false,
    comments: [
      {
        id: "tc_seed_1_1",
        ts: NOW - 2 * HOUR,
        author: "Capital Trust handler",
        body: "Logged from morning walk-through.",
        kind: "note",
      },
    ],
  },
  {
    id: "ticket_seed_2",
    ts: NOW - 6 * HOUR,
    propertyId: "prop_trizen",
    unitId: "unit_trz_t1_32_c3",
    leaseId: "lease_trz_t1_32",
    title: "Kitchen sink leaking under cabinet",
    description:
      "Tenant reports water collecting under sink. Likely worn flex connector. Within Rs. 75,000 lessee-side cap; should auto-approve.",
    category: "plumbing",
    severity: "high",
    status: "in_progress",
    reportedBy: "Tenant — Nigin Riya",
    assignedTo: "Plumber on file",
    costEstimate: { amount: 18_000, currency: "LKR" },
    costCapApplies: true,
    comments: [
      {
        id: "tc_seed_2_1",
        ts: NOW - 6 * HOUR,
        author: "Tenant",
        body: "Found this morning. Bucket placed underneath.",
        kind: "note",
      },
      {
        id: "tc_seed_2_2",
        ts: NOW - 5 * HOUR,
        author: "Capital Trust handler",
        body: "Assigned to plumber on file. ETA today afternoon.",
        kind: "assign",
      },
      {
        id: "tc_seed_2_3",
        ts: NOW - 5 * HOUR + 60_000,
        author: "Capital Trust handler",
        body: "Estimate Rs. 18,000 — within lessee-side cap.",
        kind: "cost_estimate",
      },
    ],
  },
  {
    id: "ticket_seed_3",
    ts: NOW - 1 * HOUR - 25 * MIN,
    propertyId: "prop_capitol",
    unitId: "unit_cap_t2_30",
    leaseId: "lease_cap_t2_30",
    title: "AC compressor cycling intermittently",
    description:
      "Reported by tenant. Compressor cycling on/off every few minutes. Could be capacitor or thermostat issue.",
    category: "appliance",
    severity: "medium",
    status: "open",
    reportedBy: "Tenant — Penny",
    costCapApplies: true,
    comments: [],
  },
  {
    id: "ticket_seed_4",
    ts: NOW - 24 * HOUR,
    propertyId: "prop_lucky_seven",
    title: "Lift annual inspection — past due 3 days",
    description:
      "Annual inspection by Colombo Municipal Council overdue. Lessor responsibility. Compliance scheduler raised this automatically.",
    category: "lift",
    severity: "urgent",
    status: "blocked",
    reportedBy: "compliance-scheduler workflow",
    costCapApplies: false,
    comments: [
      {
        id: "tc_seed_4_1",
        ts: NOW - 24 * HOUR,
        author: "compliance-scheduler",
        body: "Auto-raised. Lessor's vendor not yet confirmed.",
        kind: "note",
      },
    ],
  },
];
