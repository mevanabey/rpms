"use server";

import { z } from "zod";
import type { SavedChecklist } from "@/core/checklists";
import { requireLeaseAccess } from "@/lib/auth/authorization";
import { buildChecklistIntake } from "@/lib/checklist/build-lease";
import { buildChecklistMappings } from "@/lib/checklist/mappings";
import { extractChecklist } from "@/lib/checklist/parse";
import { checklistSourceSchema } from "@/lib/checklist/source-schema";
import { getBackend } from "@/server/container";

type Result = { ok: true; data: SavedChecklist | null } | { ok: false; error: string };

export async function loadChecklistAction(leaseId: string): Promise<Result> {
  try {
    z.string().uuid().parse(leaseId);
    await requireLeaseAccess(leaseId);
    return { ok: true, data: await getBackend().leases.getChecklist(leaseId) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not load the checklist." };
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
    return { ok: false, error: error instanceof Error ? error.message : "Could not attach the checklist." };
  }
}
