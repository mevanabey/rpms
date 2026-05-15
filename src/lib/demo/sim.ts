"use client";

import type { ApprovalRequest, WorkflowKind } from "./types";

const TICK_MS = 14_000;

const RENT_REMINDER_TENANTS = [
  { lease: "lease_trz_t1_32", label: "Trizen T1 32 C3", tenant: "Nigin Riya" },
  { lease: "lease_trz_t1_34", label: "Trizen T1 34 C3", tenant: "Farah Lizley" },
  { lease: "lease_trz_t3_21_c5", label: "Trizen T3 21 C5", tenant: "Pannah Sok" },
  { lease: "lease_cap_t2_30", label: "Capitol T2 30 B4A", tenant: "Penny" },
  { lease: "lease_cap_et_21", label: "Capitol ET 21 A2b", tenant: "Raymond" },
  { lease: "lease_ctr_a1", label: "CTR A1", tenant: "MRL" },
];

const RECONCILE_HITS = [
  { lease: "lease_trz_t3_36_c5", amount: { amount: 1400, currency: "USD" as const }, ref: "SLIPS/INV/8821", confidence: 98 },
  { lease: "lease_cap_t2_30", amount: { amount: 1300, currency: "USD" as const }, ref: "SLIPS/INV/8822", confidence: 94 },
  { lease: "lease_ctr_a1", amount: { amount: 1500, currency: "USD" as const }, ref: "SLIPS/INV/8823", confidence: 97 },
];

const COMPLIANCE_EVENTS = [
  { kind: "Generator service", lease: "lease_lucky_seven_head", body: "Quarterly service due 2026-06-15. Vendor confirmed." },
  { kind: "Fire inspection", lease: "lease_lucky_seven_head", body: "Annual inspection scheduled 2026-08-04 (Colombo MC fire dept)." },
  { kind: "VAT invoice", lease: "lease_lucky_seven_head", body: "VAT invoice received from lessor — within 14-day window." },
];

const APPROVAL_TEMPLATES: Array<Omit<ApprovalRequest, "id" | "ts" | "decision">> = [
  {
    workflow: "rent-collection-cycle",
    title: "Penalty waiver request?",
    question:
      "Tenant cited bank delay. Waive Rs. 25,000 daily penalty (1 day) on Trizen T1 39 C3?",
    context: [
      "Tenant: Cual, Jessica Mulinyawe",
      "Bank reference confirms transfer initiated on due date",
      "First waiver request from this tenant",
      "Penalty waived 2× across portfolio in last 90 days",
    ],
    leaseId: "lease_trz_t1_39",
    amount: { amount: 25_000, currency: "LKR" },
    options: [
      { id: "approve", label: "Waive penalty", tone: "primary" },
      { id: "halve", label: "Charge 50%", tone: "secondary" },
      { id: "reject", label: "Charge in full", tone: "destructive" },
    ],
  },
  {
    workflow: "renewal-open",
    title: "Open renewal discussion?",
    question:
      "Trizen T3 36 C5 expires in 12 months exactly today. Open renewal workflow with tenant?",
    context: [
      "Tenant: Touch Kimleng (Trizen T3 36 C5)",
      "On-time payment rate: 100%",
      "Current rent: USD 1,400/month",
      "Market average for unit type: USD 1,450",
    ],
    leaseId: "lease_trz_t3_36_c5",
    options: [
      { id: "approve", label: "Open renewal · same terms", tone: "primary" },
      { id: "approve_uplift", label: "Open · propose 5% uplift", tone: "secondary" },
      { id: "reject", label: "Skip · let expire", tone: "destructive" },
    ],
  },
  {
    workflow: "compliance-scheduler",
    title: "Statue inspection · Lucky Seven",
    question:
      "Quarterly statue inspection due. 13 Italian sculptures on Penthouse balcony. Dispatch inspector?",
    context: [
      "Last inspection: 2026-02-09 (no damage)",
      "Inspection cost: Rs. 35,000 — lessee-side per clause § 4(p)",
      "Recent rains may have moved tarpaulins",
    ],
    leaseId: "lease_lucky_seven_head",
    amount: { amount: 35_000, currency: "LKR" },
    options: [
      { id: "approve", label: "Dispatch", tone: "primary" },
      { id: "skip", label: "Defer 1 month", tone: "secondary" },
    ],
  },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface SimDeps {
  pushActivity: (activity: {
    workflow: WorkflowKind | "system";
    severity: "info" | "success" | "warning" | "error";
    title: string;
    body?: string;
    leaseId?: string;
    amount?: { amount: number; currency: "LKR" | "USD" };
  }) => unknown;
  requestApproval: (req: Omit<ApprovalRequest, "id" | "ts" | "decision">) => unknown;
  pendingApprovalsCount: number;
  bumpAutoExec: (workflow: WorkflowKind) => void;
}

/** Generate one event. Mix of pure-info activities + occasional approval requests. */
export function tickOnce(deps: SimDeps): void {
  const roll = Math.random();

  // 40%: rent reminder ticked autonomously
  if (roll < 0.4) {
    const t = pick(RENT_REMINDER_TENANTS);
    deps.bumpAutoExec("rent-collection-cycle");
    deps.pushActivity({
      workflow: "rent-collection-cycle",
      severity: "success",
      title: `Reminder sent · ${t.label}`,
      body: `T-7 day pre-bill notification delivered to ${t.tenant}.`,
      leaseId: t.lease,
    });
    return;
  }

  // 25%: bank reconciliation auto-matches
  if (roll < 0.65) {
    const r = pick(RECONCILE_HITS);
    deps.bumpAutoExec("bank-reconcile");
    deps.pushActivity({
      workflow: "bank-reconcile",
      severity: "success",
      title: "Payment auto-matched",
      body: `${r.ref} → matched to ${r.lease.replace(/^lease_/, "")} · confidence ${r.confidence}%.`,
      leaseId: r.lease,
      amount: r.amount,
    });
    return;
  }

  // 15%: compliance event
  if (roll < 0.8) {
    const c = pick(COMPLIANCE_EVENTS);
    deps.bumpAutoExec("compliance-scheduler");
    deps.pushActivity({
      workflow: "compliance-scheduler",
      severity: "info",
      title: `${c.kind} · scheduled`,
      body: c.body,
      leaseId: c.lease,
    });
    return;
  }

  // 20%: occasional approval request, capped at 5 pending
  if (deps.pendingApprovalsCount < 5) {
    deps.requestApproval(pick(APPROVAL_TEMPLATES));
    return;
  }

  // Fallback: lifecycle tick
  deps.bumpAutoExec("lease-lifecycle-tick");
  deps.pushActivity({
    workflow: "lease-lifecycle-tick",
    severity: "info",
    title: "Daily lifecycle sweep",
    body: "All leases checked. No state changes triggered.",
  });
}

export const SIM_TICK_MS = TICK_MS;
