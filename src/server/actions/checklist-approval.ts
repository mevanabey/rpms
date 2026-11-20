"use server";

import { userErrorMessage } from "@/lib/user-error";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLeaseAccess } from "@/lib/auth/authorization";
import { can, DEFAULT_PERMISSIONS } from "@/lib/demo/identity";
import { checklistApprovalSchema, checklistRentRows, needsChecklistReview, type ChecklistApprovalPreview } from "@/lib/checklist/review";
import { getSupabaseAdmin, LEASE_DOCUMENTS_BUCKET } from "@/lib/supabase/admin";
import { getBackend } from "@/server/container";
import { checklistReviewVersion } from "@/server/checklist-review-version";
import { withAudit } from "@/server/db/client";

const TYPES: Record<string, string> = {
  "application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "application/msword": "doc",
};
const MAX_BYTES = 20 * 1024 * 1024;
type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const failure = (error: unknown) => ({ ok: false as const, error: userErrorMessage(error) });

async function reviewableLease(id: string) {
  z.string().uuid().parse(id);
  const actor = await requireLeaseAccess(id, "leases:write");
  const backend = getBackend();
  const lease = await backend.leases.get(id);
  if (!lease || !needsChecklistReview(lease)) throw new Error("This lease is not awaiting checklist sign-off. Refresh the page.");
  if (["terminated", "expired", "renewed"].includes(lease.status)) throw new Error("A closed lease cannot be activated through checklist approval.");
  if (!await backend.leases.getChecklist(id)) throw new Error("Attach the original checklist in Checklist View before reviewing and signing off.");
  return { actor, backend, lease };
}

export async function loadChecklistApprovalAction(id: string): Promise<Result<ChecklistApprovalPreview>> {
  try {
    const { backend, lease } = await reviewableLease(id);
    const ledger = await backend.payments.listLedger({ leaseId: id });
    return { ok: true, data: { version: checklistReviewVersion(lease, ledger), rent: checklistRentRows(lease, ledger), hasSignedAgreement: Boolean(lease.signedLeasePath), defaultPaymentMethod: lease.defaultPaymentMethod, today: new Date().toISOString().slice(0, 10) } };
  } catch (error) { return failure(error); }
}

/** Browser uploads directly to private Storage, avoiding server-action file
 * size limits. The capability permits one new path on this authorized lease. */
export async function prepareChecklistAgreementUploadAction(id: string, input: { contentType: string; size: number }): Promise<Result<{ path: string; token: string; bucket: string }>> {
  try {
    await reviewableLease(id);
    const file = z.object({ contentType: z.string(), size: z.number().int().positive().max(MAX_BYTES) }).parse(input);
    const ext = TYPES[file.contentType];
    if (!ext) throw new Error("Upload a PDF or Word agreement (maximum 20 MB).");
    const path = `${id}/checklist-signoff-${randomUUID()}.${ext}`;
    const { data, error } = await getSupabaseAdmin().storage.from(LEASE_DOCUMENTS_BUCKET).createSignedUploadUrl(path, { upsert: false });
    if (error) throw new Error(error.message);
    return { ok: true, data: { path, token: data.token, bucket: LEASE_DOCUMENTS_BUCKET } };
  } catch (error) { return failure(error); }
}

export async function approveChecklistAction(id: string, raw: unknown, uploadedPath?: string): Promise<Result<{ leaseId: string }>> {
  try {
    const { actor, backend, lease } = await reviewableLease(id);
    const input = checklistApprovalSchema.parse(raw);
    if (input.receipts.length && !can(actor, DEFAULT_PERMISSIONS, "payments:write")) throw new Error("Payment access is required to record collected rent. Ask an accountant or account manager to complete this sign-off.");
    const path = uploadedPath || lease.signedLeasePath;
    if (!path) throw new Error("Upload the executed agreement before signing off.");
    if (uploadedPath && !new RegExp(`^${id}/checklist-signoff-[0-9a-f-]{36}\\.(pdf|docx|doc)$`).test(uploadedPath)) throw new Error("Invalid agreement upload. Choose the file again.");
    const { data: file, error } = await getSupabaseAdmin().storage.from(LEASE_DOCUMENTS_BUCKET).info(path);
    if (error || !file) throw new Error("The agreement upload is not available. Upload it again.");
    if (!file.size || file.size > MAX_BYTES || !TYPES[file.contentType ?? ""]) throw new Error("The agreement must be a non-empty PDF or Word file, up to 20 MB.");
    await withAudit(actor, "Checklist reviewed, approved and signed off", () => backend.leases.approveChecklist(id, { ...input, signedLeasePath: path, approvedById: actor.id, approvedByName: actor.name, approvedAt: new Date().toISOString() }), { recordedPayments: input.receipts.length });
    for (const route of ["/", "/leases", `/leases/${id}`, "/rent", "/payments", "/activity"]) revalidatePath(route);
    return { ok: true, data: { leaseId: id } };
  } catch (error) { return failure(error); }
}
