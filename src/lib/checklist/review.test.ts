import assert from "node:assert/strict";
import test from "node:test";
import { mockBackend } from "@/server/adapters/mock";
import { secureBackend } from "@/server/secured-backend";
import { checklistReviewVersion } from "@/server/checklist-review-version";
import type { AppUser } from "@/lib/demo/identity";
import { buildChecklistIntake } from "./build-lease";
import { extractChecklist } from "./parse";
import { importChecklistToBackend } from "./import";
import { assertChecklistReviewed, checklistSignoff, needsChecklistReview, validateChecklistApproval, type ChecklistApprovalInput } from "./review";

async function fixture() {
  const source = { version: 1 as const, fileName: "review.csv", importSheetIndex: 0, sheets: [{ name: "Checklist", merges: [], rows: [
    ["Premises address", "1 Review Road"], ["Lessor's name", "Owner Review"], ["Lessee's name", "Tenant Review"],
    ["Monthly Rental", "1000"], ["Term", "01.01.2025 - 31.03.2025"],
  ] }] };
  const result = await importChecklistToBackend(mockBackend, buildChecklistIntake({ ...extractChecklist(source.sheets[0].rows), source }));
  const lease = (await mockBackend.leases.get(result.leaseId))!;
  const ledger = await mockBackend.payments.listLedger({ leaseId: lease.id });
  const input: ChecklistApprovalInput = {
    version: checklistReviewVersion(lease, ledger), reviewed: true, rentConfirmed: true, notes: "Original checked",
    signedLeasePath: `${lease.id}/checklist-signoff-test.pdf`, approvedById: "reviewer", approvedByName: "Reviewer", approvedAt: "2026-11-16T12:00:00Z",
    receipts: [{ dueDate: "2025-01-01", paidDate: "2025-01-05", amount: 900, currency: "LKR", paymentMethod: "lkr_transfer", reference: "Historical receipt" }],
  };
  return { lease, ledger, input };
}

test("checklist imports require review; new leases and attachments do not", async () => {
  const { lease } = await fixture();
  assert.equal(lease.status, "draft");
  assert.equal(needsChecklistReview(lease), true);
  const manual = { ...lease, importMeta: undefined };
  assert.equal(needsChecklistReview(manual), false);
  assert.doesNotThrow(() => assertChecklistReviewed(manual));
  assert.equal(needsChecklistReview({ importMeta: { checklist: { mode: "attached" } } }), false);
});

test("approval activates, signs off and records historical rent without new-lease progress", async () => {
  const { lease, input } = await fixture();
  const approved = await mockBackend.leases.approveChecklist(lease.id, input);
  assert.equal(approved.status, "active");
  assert.equal(approved.onboardingStage, undefined);
  assert.equal(approved.signedLeasePath, input.signedLeasePath);
  assert.equal(checklistSignoff(approved)?.approvedByName, "Reviewer");
  assert.equal(needsChecklistReview(approved), false);
  const ledger = await mockBackend.payments.listLedger({ leaseId: lease.id });
  assert.equal(ledger.length, 3);
  assert.equal(ledger.filter((e) => e.paidDate).length, 1);
  assert.equal(ledger[0].amount.amount, 900);
  assert.equal(ledger[0].paidDate, "2025-01-05");
  assert.equal(ledger[1].amount.amount, 1000);
  await assert.rejects(() => mockBackend.leases.approveChecklist(lease.id, input), /changed|already/);
  assert.equal((await mockBackend.payments.listLedger({ leaseId: lease.id })).length, 3);
});

test("approval preserves existing payments and can explicitly record no new collections", async () => {
  const { lease, input } = await fixture();
  await mockBackend.leases.generateRentSchedule(lease.id);
  const [entry] = await mockBackend.payments.listLedger({ leaseId: lease.id });
  await mockBackend.payments.markPaid(entry.id, { paidDate: "2025-01-04", paymentMethod: "lkr_cash", amount: { amount: 950, currency: "LKR" } });
  const ledger = await mockBackend.payments.listLedger({ leaseId: lease.id });
  const paidBefore = structuredClone(ledger[0]);
  await mockBackend.leases.approveChecklist(lease.id, { ...input, version: checklistReviewVersion(lease, ledger), receipts: [] });
  assert.deepEqual((await mockBackend.payments.listLedger({ leaseId: lease.id }))[0], paidBefore);
  assert.equal(checklistSignoff(lease)?.recordedPayments, 0);
});

test("invalid and stale approvals leave status, sign-off and ledger unchanged", async () => {
  const { lease, ledger, input } = await fixture();
  for (const receipts of [
    [input.receipts[0], input.receipts[0]],
    [{ ...input.receipts[0], paidDate: "2027-01-01" }],
    [{ ...input.receipts[0], currency: "USD" as const }],
    [{ ...input.receipts[0], dueDate: "2024-01-01" }],
    [{ ...input.receipts[0], amount: -1 }],
  ]) await assert.rejects(() => mockBackend.leases.approveChecklist(lease.id, { ...input, receipts }));
  assert.throws(() => validateChecklistApproval(lease, ledger, { ...input, signedLeasePath: "" }), /agreement/);
  assert.throws(() => validateChecklistApproval(lease, ledger, { ...input, reviewed: false as true }));
  await mockBackend.leases.update(lease.id, { endDate: "2025-04-30" });
  await assert.rejects(() => mockBackend.leases.approveChecklist(lease.id, input), /changed/);
  assert.equal(lease.status, "draft");
  assert.equal(checklistSignoff(lease), undefined);
  assert.equal((await mockBackend.payments.listLedger({ leaseId: lease.id })).length, 0);
});

test("existing paid periods cannot be recorded twice", async () => {
  const { lease, input } = await fixture();
  await mockBackend.leases.generateRentSchedule(lease.id);
  const [entry] = await mockBackend.payments.listLedger({ leaseId: lease.id });
  await mockBackend.payments.markPaid(entry.id, { paidDate: "2025-01-03", paymentMethod: "lkr_cash" });
  const ledger = await mockBackend.payments.listLedger({ leaseId: lease.id });
  await assert.rejects(() => mockBackend.leases.approveChecklist(lease.id, { ...input, version: checklistReviewVersion(lease, ledger) }), /already paid/);
  assert.equal(lease.status, "draft");
});

test("server gate blocks status edits, signed upload and normal workflow before checklist sign-off", async () => {
  const { lease } = await fixture();
  const user: AppUser = { id: "admin", name: "Admin", email: "admin@example.test", role: "admin", entities: [] };
  const backend = secureBackend(mockBackend, async () => user);
  const attempts = [
    () => backend.leases.update(lease.id, { status: "active" }),
    () => backend.leases.updateStatus(lease.id, "signed"),
    () => backend.leases.attachSignedLease(lease.id, "file"),
    () => backend.leases.markLeaseActive(lease.id),
    () => backend.leases.setOnboardingStage(lease.id, "agreement_ready"),
    () => backend.leases.markAgreementGenerated(lease.id, "file"),
    () => backend.leases.markLeaseEmailSent(lease.id, "accounts"),
  ];
  for (const attempt of attempts) await assert.rejects(attempt, /sign off/);
  assert.equal(lease.status, "draft");
});

test("sign-off enforces scope and payment permissions before persistence", async () => {
  const { lease, input } = await fixture();
  const lawyer: AppUser = { id: "lawyer", name: "Lawyer", email: "lawyer@example.test", role: "lawyer", entities: [], assignedLeaseIds: [lease.id] };
  await assert.rejects(() => secureBackend(mockBackend, async () => lawyer).leases.approveChecklist(lease.id, input), /Payment access/);
  await assert.rejects(() => secureBackend(mockBackend, async () => ({ ...lawyer, assignedLeaseIds: [] })).leases.approveChecklist(lease.id, { ...input, receipts: [] }), /Access denied/);
  assert.equal(lease.status, "draft");
});
