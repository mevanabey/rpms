/**
 * Per-workflow human-readable definitions used by /automation, /automation/[kind],
 * and the activity detail pages. Mirrors SPEC §7.9 — the source of truth for
 * what each workflow does, where the human steps in, and what guardrails apply.
 */
import type { WorkflowKind } from "./types";

export interface WorkflowStep {
  id: string;
  name: string;
  type: "auto" | "gate" | "external";
  description: string;
  /** When `type === "gate"`, this is the question shown to the human. */
  gateQuestion?: string;
}

export interface WorkflowGuardrail {
  id: string;
  label: string;
  description: string;
}

export interface WorkflowDef {
  kind: WorkflowKind;
  title: string;
  trigger: string;
  description: string;
  inputs: string[];
  outputs: string[];
  steps: WorkflowStep[];
  guardrails: WorkflowGuardrail[];
  idempotencyKey: string;
  /** Phase in the SPEC rollout when this becomes real. */
  phase: string;
}

export const WORKFLOW_DEFS: Record<WorkflowKind, WorkflowDef> = {
  "rent-collection-cycle": {
    kind: "rent-collection-cycle",
    title: "Rent collection",
    trigger: "Cron daily 06:00 LKT",
    description:
      "Drives every rent obligation from pre-bill reminder to overdue escalation. Sends email + WhatsApp on schedule, matches incoming payments, and pauses for human approval when penalties or escalations are due.",
    inputs: ["Lease", "Active rent obligation", "Tenant contact channels"],
    outputs: ["Notifications sent", "Ledger entries (paid)", "Late-fee accruals", "Breach watch tickets"],
    idempotencyKey: "obligation_id",
    phase: "P2",
    steps: [
      { id: "pre-bill", name: "Pre-bill reminder", type: "auto", description: "T-7 days before due date — email + WhatsApp to tenant + landlord (if head lease)." },
      { id: "due-day", name: "Due-day notice", type: "auto", description: "On the due date — final reminder, no escalation yet." },
      { id: "match", name: "Bank match", type: "auto", description: "Auto-match incoming bank credit advices to this obligation. Confidence ≥ 95% auto-resolves." },
      { id: "day-1-late", name: "Day-1 late notice", type: "auto", description: "+1 day past due — soft notice to tenant + handler CC." },
      { id: "penalty-accrual", name: "Penalty accrual", type: "gate", description: "+7 days past due — Rs. 25,000/day penalty starts accruing.", gateQuestion: "Begin daily penalty accrual?" },
      { id: "day-14-late", name: "Day-14 escalation", type: "gate", description: "Tenant + handler + accountant notified. Legal team CC. Optionally escalate to formal letter.", gateQuestion: "Send 14-day overdue notice?" },
      { id: "breach-watch", name: "Breach watch", type: "gate", description: "If 3 consecutive months unpaid, fire breach-detect workflow.", gateQuestion: "Trigger material-breach workflow?" },
    ],
    guardrails: [
      { id: "send-window", label: "Send window 09:00–18:00 LKT", description: "Reminders never fire outside business hours." },
      { id: "max-channels", label: "Max 3 channels per beat", description: "Email + WhatsApp + SMS — no spam, one of each only." },
      { id: "penalty-rate", label: "Penalty fixed at lease rate", description: "Rs. 25,000/day per Lucky Seven §6(k); per-lease overrides on the lease record." },
      { id: "no-double-send", label: "Idempotent on obligation_id", description: "Same obligation can't be reminded twice in the same cycle." },
    ],
  },

  "lease-lifecycle-tick": {
    kind: "lease-lifecycle-tick",
    title: "Lease lifecycle",
    trigger: "Cron daily 07:00 LKT",
    description:
      "Daily sweep that fires lifecycle events: grace ends, lock-in ends, rent escalations begin, renewal window opens, lease expires.",
    inputs: ["All active leases", "Today's date"],
    outputs: ["Activity events", "Triggered child workflows"],
    idempotencyKey: "lease_id+date",
    phase: "P2",
    steps: [
      { id: "load", name: "Load active leases", type: "auto", description: "Fetch every lease with status active|signed|grace." },
      { id: "compute", name: "Compute today's events", type: "auto", description: "Compare today against grace_end, lock_in_end, tranche boundaries, renewal-12mo, expiry." },
      { id: "fan-out", name: "Fan out child workflows", type: "auto", description: "Trigger renewal-open / move-out / etc. with idempotency keys." },
      { id: "post", name: "Post activities", type: "auto", description: "One activity per lifecycle event for the audit log." },
    ],
    guardrails: [
      { id: "single-fire", label: "Each event fires once", description: "Idempotency key (lease_id + date) prevents double-firing." },
      { id: "tz-safe", label: "Timezone-safe", description: "All comparisons in Asia/Colombo; UTC drift cannot skip a day." },
    ],
  },

  "compliance-scheduler": {
    kind: "compliance-scheduler",
    title: "Compliance",
    trigger: "Cron weekly Mon 08:00 LKT",
    description:
      "Generates and tracks recurring compliance obligations from each head-lease clause: lift servicing, generator service, fire inspection, VAT request, colour wash, statue inspection, stamp duty filing.",
    inputs: ["Head leases", "Last-completed timestamps per kind"],
    outputs: ["Obligation rows", "Vendor work-orders"],
    idempotencyKey: "obligation_id",
    phase: "P5",
    steps: [
      { id: "scan", name: "Scan clauses", type: "auto", description: "Read each head lease's compliance clauses." },
      { id: "schedule", name: "Schedule recurrences", type: "auto", description: "Materialize next obligation per kind based on cadence + last completion." },
      { id: "vendor", name: "Notify vendor", type: "auto", description: "Email lift / generator / fire vendors with work-order." },
      { id: "approve-statue", name: "Statue inspection dispatch", type: "gate", description: "Quarterly check on the 13 Italian sculptures (Lucky Seven Penthouse).", gateQuestion: "Dispatch statue inspector?" },
      { id: "vat-request", name: "VAT invoice request", type: "auto", description: "Auto-prompt lessor for VAT invoice within 14-day clause window." },
      { id: "follow-up", name: "Overdue follow-up", type: "gate", description: "If vendor confirmation not received in 7 days, prompt handler.", gateQuestion: "Escalate to alternate vendor?" },
    ],
    guardrails: [
      { id: "annual-cap", label: "Annual budget caps", description: "Compliance spend per category capped per lease; over-cap requires admin approval." },
      { id: "vendor-allowlist", label: "Vendor allowlist", description: "Only approved vendors can be auto-notified." },
    ],
  },

  "bank-reconcile": {
    kind: "bank-reconcile",
    title: "Bank reconciliation",
    trigger: "Inbound email (Resend Inbound / SendGrid Parse)",
    description:
      "Parses bank credit-advice emails, scores match candidates against open obligations, auto-matches at high confidence, queues human review for the rest.",
    inputs: ["Inbound bank advice email"],
    outputs: ["LedgerEntry (paid)", "Inbox item awaiting human review"],
    idempotencyKey: "email_id",
    phase: "P4",
    steps: [
      { id: "parse", name: "LLM extraction", type: "auto", description: "Extract bank · ref · amount · date · narrative from the email body + attachments." },
      { id: "match", name: "Score candidates", type: "auto", description: "Compute confidence against open obligations (amount, date proximity, narrative match)." },
      { id: "auto-match", name: "Auto-match", type: "auto", description: "≥ 95% confidence: write LedgerEntry directly, post activity." },
      { id: "human-review", name: "Human review", type: "gate", description: "< 95%: park in /payments/inbox for handler review.", gateQuestion: "Match this advice to the proposed obligation?" },
      { id: "fallback-park", name: "Park unmatched", type: "auto", description: "If no candidate exists, hold in inbox for manual link." },
    ],
    guardrails: [
      { id: "amount-tolerance", label: "Amount tolerance ±2%", description: "Auto-match never exceeds 2% deviation from expected amount." },
      { id: "no-overwrite", label: "No paid overwrite", description: "An already-paid obligation cannot be auto-rematched." },
      { id: "audit-trail", label: "Email retained", description: "Original advice email + attachments retained as Document." },
    ],
  },

  "commission-accrual": {
    kind: "commission-accrual",
    title: "Commission accrual",
    trigger: "Cron monthly 1st 02:00 LKT",
    description:
      "Walks every introducer-tagged lease, accrues commission according to the per-lease rule, posts a journal entry. Visible at /commissions.",
    inputs: ["Leases with introducer role", "Per-lease commission rule"],
    outputs: ["IntroducerCommission accrual rows"],
    idempotencyKey: "commission_id+month",
    phase: "P5",
    steps: [
      { id: "load-rules", name: "Load commission rules", type: "auto", description: "Per-lease rate + cadence (one-off vs monthly)." },
      { id: "accrue", name: "Accrue per lease", type: "auto", description: "Compute accrual for the month based on paid rent ledger." },
      { id: "post", name: "Post accrual", type: "auto", description: "Write a commission accrual row tied to the lease + introducer." },
      { id: "discrepancy", name: "Discrepancy review", type: "gate", description: "If accrual differs > 10% from the prior month, ask handler.", gateQuestion: "Confirm the new accrual?" },
    ],
    guardrails: [
      { id: "max-rate", label: "Max rate 1× monthly rent", description: "Commission rule cannot exceed one month's rent without explicit admin override." },
      { id: "no-double-accrual", label: "Idempotent monthly", description: "Same lease + month never accrues twice." },
    ],
  },

  "commission-payout": {
    kind: "commission-payout",
    title: "Commission payout",
    trigger: "Manual batch — handler initiates",
    description:
      "Bundles accrued commissions into a payout batch for handler review and bank transfer. Currently `manual` autonomy: every batch needs human approval before transfer.",
    inputs: ["Accrued commission rows", "Introducer banking details"],
    outputs: ["Payout batch", "Bank transfer instructions"],
    idempotencyKey: "batch_id",
    phase: "P5",
    steps: [
      { id: "draft-batch", name: "Draft batch", type: "auto", description: "Bundle pending accruals per introducer." },
      { id: "review-batch", name: "Review batch", type: "gate", description: "Handler reviews each line, can edit or hold.", gateQuestion: "Approve payout batch?" },
      { id: "bank-export", name: "Generate bank instruction", type: "auto", description: "Produce SLIPS / Online banking template per introducer." },
      { id: "confirm-paid", name: "Confirm paid", type: "gate", description: "After bank confirmation, mark commissions paid.", gateQuestion: "All transfers confirmed paid?" },
    ],
    guardrails: [
      { id: "amount-cap", label: "Per-batch cap", description: "Single batch cannot exceed Rs. 5M without admin approval." },
      { id: "kyc-required", label: "KYC required for new introducers", description: "First-time introducer payout requires bank-account proof." },
    ],
  },

  "esign-resume": {
    kind: "esign-resume",
    title: "E-signature",
    trigger: "Webhook from DropboxSign / DocuSign",
    description:
      "Resumes the lease onboarding workflow after the e-signature provider reports a signed envelope. Activates the lease and materializes obligations.",
    inputs: ["E-sign envelope webhook", "Pending DraftLease"],
    outputs: ["Activated Lease", "RentScheduleTranches", "Per-month obligations"],
    idempotencyKey: "envelope_id",
    phase: "P3",
    steps: [
      { id: "verify", name: "Verify webhook", type: "auto", description: "Validate signature on the webhook payload." },
      { id: "activate", name: "Activate lease", type: "auto", description: "Flip lease status to signed → active (or grace if applicable)." },
      { id: "materialize", name: "Materialize schedule", type: "auto", description: "Expand rent schedule into per-month obligations." },
      { id: "kickoff-compliance", name: "Kick off compliance", type: "auto", description: "Start lift / generator / fire / colour-wash / statue recurrences (head leases)." },
      { id: "welcome", name: "Welcome notification", type: "auto", description: "Email + WhatsApp tenant: keys, deposit confirmation, handler contact." },
    ],
    guardrails: [
      { id: "signed-only", label: "Signed-only resume", description: "Only `signature_request_signed` events activate; `declined` / `expired` revert to draft." },
      { id: "anti-replay", label: "Anti-replay", description: "Envelope ID must be unique per attempt." },
    ],
  },

  "breach-detect": {
    kind: "breach-detect",
    title: "Breach detection",
    trigger: "Fired by rent-collection-cycle when 3 consecutive months unpaid",
    description:
      "When a lease misses 3 consecutive rent obligations, this workflow gathers evidence, drafts a material-breach notice, and routes to legal review.",
    inputs: ["Lease", "Unpaid obligations history"],
    outputs: ["Breach notice draft", "Legal team task"],
    idempotencyKey: "lease_id",
    phase: "P2",
    steps: [
      { id: "evidence", name: "Collect evidence", type: "auto", description: "Gather unpaid obligations, prior reminders, tenant responses." },
      { id: "notice-draft", name: "Draft material-breach notice", type: "auto", description: "Per Lucky Seven §6(l) clause text." },
      { id: "legal-review", name: "Legal review", type: "gate", description: "CTP lawyer reviews + signs off.", gateQuestion: "Approve breach notice?" },
      { id: "send", name: "Send notice", type: "external", description: "Registered post + email — manual handover by handler." },
    ],
    guardrails: [
      { id: "three-month-rule", label: "3 consecutive months threshold", description: "Cannot fire on intermittent unpaid; must be 3 in a row." },
      { id: "lawyer-signoff", label: "Lawyer sign-off required", description: "No notice goes out without an attached lawyer review." },
    ],
  },

  "renewal-open": {
    kind: "renewal-open",
    title: "Renewal",
    trigger: "Lease lifecycle event — 12 months before expiry",
    description:
      "Opens a renewal conversation with the tenant. Drafts new terms (same or with uplift), routes to handler approval, contacts tenant.",
    inputs: ["Lease nearing expiry", "Market rate suggestion"],
    outputs: ["Renewal proposal", "Tenant communication"],
    idempotencyKey: "lease_id",
    phase: "P2",
    steps: [
      { id: "open", name: "Open renewal window", type: "auto", description: "Mark lease as renewal-eligible." },
      { id: "draft-terms", name: "Draft proposed terms", type: "auto", description: "Same terms by default; suggest uplift based on market." },
      { id: "handler-approve", name: "Handler approval", type: "gate", description: "Handler picks: same terms / uplift / let expire.", gateQuestion: "How to renew this lease?" },
      { id: "contact-tenant", name: "Contact tenant", type: "auto", description: "Email tenant with the chosen proposal." },
    ],
    guardrails: [
      { id: "market-bound", label: "Uplift bounded", description: "Auto-suggested uplift never exceeds 10% without admin override." },
      { id: "12mo-window", label: "12-month notice window", description: "Cannot fire later than 12 months before expiry." },
    ],
  },

  "move-out": {
    kind: "move-out",
    title: "Move-out",
    trigger: "Lease lifecycle event — 90 days before end_date or termination event",
    description:
      "Coordinates the move-out: final inspection, deposit reconciliation, key handover, refund computation.",
    inputs: ["Lease ending soon", "Maintenance ticket history", "Ledger"],
    outputs: ["Final inspection report", "Refund statement"],
    idempotencyKey: "lease_id",
    phase: "P3",
    steps: [
      { id: "schedule-inspection", name: "Schedule final inspection", type: "auto", description: "Email tenant with proposed dates." },
      { id: "inspect", name: "Inspection", type: "external", description: "Handler walks the unit; uploads photos + notes." },
      { id: "compute-refund", name: "Compute refund", type: "auto", description: "Deposit minus damages, unpaid rent, utilities." },
      { id: "approve-refund", name: "Approve refund", type: "gate", description: "Handler signs off on the final number.", gateQuestion: "Approve refund of {{amount}}?" },
      { id: "transfer", name: "Transfer refund", type: "external", description: "Bank transfer to tenant; mark lease expired." },
    ],
    guardrails: [
      { id: "deposit-cap", label: "Refund ≤ deposit", description: "Net refund cannot exceed deposit + advance rent." },
      { id: "damage-evidence", label: "Damage evidence required", description: "Each deduction needs an attached photo + estimate." },
    ],
  },

  "onboard-tenant": {
    kind: "onboard-tenant",
    title: "Tenant onboarding",
    trigger: "Manual / API — initiated by the New Lease wizard",
    description:
      "End-to-end onboarding: KYC review, draft generation, lawyer review, e-signature, deposit collection, lease activation, schedule materialization, welcome.",
    inputs: ["OnboardingIntent (from wizard)"],
    outputs: ["DraftLease → signed Lease", "Initial ledger entries", "Welcome email"],
    idempotencyKey: "lease_id",
    phase: "P3",
    steps: [
      { id: "kyc", name: "KYC review", type: "gate", description: "AI auto-checks passport / company reg / sanctions; human approves.", gateQuestion: "Approve KYC?" },
      { id: "draft", name: "Generate draft", type: "auto", description: "docxtemplater fills the lease template." },
      { id: "lawyer", name: "Lawyer review", type: "gate", description: "CTP lawyer reads the draft.", gateQuestion: "Approve draft for e-signature?" },
      { id: "esign-send", name: "Send for e-sign", type: "auto", description: "DropboxSign envelope created." },
      { id: "esign-await", name: "Await signatures", type: "external", description: "Workflow pauses until webhook." },
      { id: "deposits", name: "Collect initial money", type: "auto", description: "Emit obligations for deposit + advance rent + stamp duty + legal fees." },
      { id: "activate", name: "Activate lease", type: "auto", description: "Status → active (or grace), materialize schedule." },
      { id: "welcome", name: "Welcome", type: "auto", description: "Email + WhatsApp to tenant + handler." },
    ],
    guardrails: [
      { id: "kyc-mandatory", label: "KYC mandatory", description: "Cannot proceed past KYC without explicit human approval." },
      { id: "lawyer-mandatory", label: "Lawyer review mandatory for head leases", description: "Sub-leases on standard templates skip lawyer; head leases never do." },
    ],
  },
};
