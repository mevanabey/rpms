import { z } from "zod";
import type { Lease, LedgerEntry, Money, PaymentMethod } from "@/core/types";

import { isChecklistImport, needsChecklistReview } from "./review-status";
export { isChecklistImport, needsChecklistReview, checklistSignoff, assertChecklistReviewed } from "./review-status";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");

export const checklistApprovalSchema = z.object({
  version: z.string().min(1),
  reviewed: z.literal(true),
  rentConfirmed: z.literal(true),
  notes: z.string().trim().max(4000),
  receipts: z.array(z.object({
    dueDate: date,
    paidDate: date,
    amount: z.number().positive().max(1e12).refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, "Use at most two decimal places."),
    currency: z.enum(["LKR", "USD"]),
    paymentMethod: z.enum(["lkr_cash", "lkr_transfer", "usd_transfer", "bank_draft", "cheque"]),
    reference: z.string().trim().max(200),
  }).strict()).max(1200),
}).strict();

export type ChecklistApprovalRequest = z.infer<typeof checklistApprovalSchema>;
export interface ChecklistApprovalInput extends ChecklistApprovalRequest {
  signedLeasePath: string;
  approvedById: string;
  approvedByName: string;
  approvedAt: string;
}
export interface ChecklistRentRow {
  dueDate: string;
  amount: Money;
  entryId?: string;
  paidDate?: string;
}
export interface ChecklistApprovalPreview {
  version: string;
  rent: ChecklistRentRow[];
  hasSignedAgreement: boolean;
  defaultPaymentMethod: PaymentMethod;
  today: string;
}

/** Use the same monthly due dates as the existing rent schedule generator.
 * Existing ledger entries always win, including adjusted amounts. */
export function checklistRentRows(lease: Lease, ledger: LedgerEntry[]): ChecklistRentRow[] {
  const rows = new Map<string, ChecklistRentRow>();
  for (const entry of ledger.filter((e) => e.leaseId === lease.id && e.kind === "rent" && e.direction === "in")) {
    if (rows.has(entry.dueDate)) throw new Error("Duplicate rent periods exist. Reconcile the ledger before approving.");
    rows.set(entry.dueDate, { dueDate: entry.dueDate, amount: entry.amount, entryId: entry.id, paidDate: entry.paidDate });
  }
  if (!lease.tranches.length) throw new Error("Add a rent schedule before approving.");
  for (const tranche of lease.tranches) {
    date.parse(tranche.startDate); date.parse(tranche.endDate);
    if (tranche.endDate < tranche.startDate) throw new Error("Correct the rent schedule dates before approving.");
    if (!(tranche.monthlyRent.amount > 0)) throw new Error("Correct the monthly rent before approving.");
    let due = tranche.startDate;
    let count = 0;
    while (due <= tranche.endDate) {
      if (++count > 1200) throw new Error("The rent schedule exceeds 100 years. Check its dates.");
      if (!rows.has(due)) rows.set(due, { dueDate: due, amount: tranche.monthlyRent });
      const next = new Date(`${due}T00:00:00Z`);
      next.setUTCMonth(next.getUTCMonth() + 1);
      due = next.toISOString().slice(0, 10);
    }
  }
  if (rows.size > 1200) throw new Error("Too many rent periods to approve at once. Check the schedule.");
  return [...rows.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function validateChecklistApproval(lease: Lease, ledger: LedgerEntry[], input: ChecklistApprovalInput): ChecklistRentRow[] {
  checklistApprovalSchema.parse({ version: input.version, reviewed: input.reviewed, rentConfirmed: input.rentConfirmed, notes: input.notes, receipts: input.receipts });
  if (!isChecklistImport(lease)) throw new Error("This approval flow is only for checklist imports.");
  if (!needsChecklistReview(lease)) throw new Error("This checklist has already been signed off. Refresh the page.");
  if (["terminated", "expired", "renewed"].includes(lease.status)) throw new Error("A closed lease cannot be activated through checklist approval.");
  if (!input.signedLeasePath.startsWith(`${lease.id}/`) || !input.approvedById || !input.approvedByName) throw new Error("An agreement and verified reviewer are required.");
  const today = input.approvedAt.slice(0, 10);
  const rows = checklistRentRows(lease, ledger);
  const seen = new Set<string>();
  for (const receipt of input.receipts) {
    if (seen.has(receipt.dueDate)) throw new Error("A rent period was entered more than once.");
    seen.add(receipt.dueDate);
    const row = rows.find((r) => r.dueDate === receipt.dueDate);
    if (!row || row.paidDate) throw new Error("A selected rent period is missing or already paid. Refresh the review.");
    if (receipt.currency !== row.amount.currency) throw new Error("Collection currency must match the rent period.");
    if (receipt.paidDate > today) throw new Error("Collected rent cannot have a future payment date.");
  }
  return rows;
}
