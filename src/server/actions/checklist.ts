"use server";

import { z } from "zod";
import type { SavedChecklist } from "@/core/checklists";
import { requireLeaseAccess } from "@/lib/auth/authorization";
import { buildChecklistIntake } from "@/lib/checklist/build-lease";
import { buildChecklistMappings } from "@/lib/checklist/mappings";
import { extractChecklist } from "@/lib/checklist/parse";
import { checklistSourceSchema } from "@/lib/checklist/source-schema";
import { getBackend } from "@/server/container";
import { checklistUploadProblem, type ChecklistUploadProblem } from "@/lib/checklist/upload-errors";
import type { ChecklistSource } from "@/core/checklists";
import { userErrorMessage } from "@/lib/user-error";
import { randomUUID } from "node:crypto";

type Result = { ok: true; data: SavedChecklist | null } | { ok: false; error: string; problem?: ChecklistUploadProblem };

export async function loadChecklistAction(leaseId: string): Promise<Result> {
  try {
    z.string().uuid().parse(leaseId);
    await requireLeaseAccess(leaseId);
    return { ok: true, data: await getBackend().leases.getChecklist(leaseId) };
  } catch (error) {
    const problem = checklistUploadProblem(error, "prepare");
    console.error("Could not load original checklist", error);
    return { ok: false, error: ["sign_in", "contact_admin"].includes(problem.recovery)
      ? userErrorMessage(error)
      : "We couldn’t load the original checklist. Check your connection and choose Retry. If it still fails, ask your administrator for help." };
  }
}

/** Restore a missing original without reimporting or changing agreement terms. */
export async function attachChecklistAction(leaseId: string, input: unknown): Promise<Result> {
  try {
    z.string().uuid().parse(leaseId);
    await requireLeaseAccess(leaseId, "leases:write");
    const source = checklistSourceSchema.parse(input);
    const backend = getBackend();
    if (!await backend.leases.get(leaseId)) throw new Error("Agreement not found.");
    if (await backend.leases.getChecklist(leaseId)) throw new Error("This agreement already has its original checklist.");
    const extracted = extractChecklist(source.sheets[source.importSheetIndex].rows);
    const checklist: SavedChecklist = {
      source, mode: "attached", savedAt: new Date().toISOString(), requiredLeaseIds: [leaseId],
      mappings: buildChecklistMappings(source, extracted, buildChecklistIntake(extracted)),
    };
    await backend.leases.saveChecklist(leaseId, checklist);
    return { ok: true, data: checklist };
  } catch (error) {
    const reference = `CHK-${randomUUID().slice(0, 8).toUpperCase()}`;
    console.error(`Checklist attachment ${reference}`, error);
    let problem = checklistUploadProblem(error, "prepare", input as ChecklistSource);
    if (problem.recovery === "sign_in") problem = { ...problem, steps: ["Sign in again, then return to this page and attach the original checklist."] };
    if (problem.recovery === "contact_admin") problem = { ...problem, steps: ["Ask your administrator to check your lease permissions, then attach the original checklist again. You do not need to change the spreadsheet."] };
    if (problem.recovery === "retry") problem = {
      title: "We couldn’t confirm the checklist was attached",
      explanation: "The original checklist could not be saved, or we did not receive confirmation.",
      steps: ["Reload this page to see whether the original checklist is now available.", "If it is still missing, try attaching it again. If this continues, share the help reference with your administrator."], recovery: "retry",
    };
    return { ok: false, error: problem.title, problem: { ...problem, reference } };
  }
}
