"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { ChecklistUploadError, checklistUploadProblem, unrecognisedChecklist, type ChecklistUploadProblem } from "@/lib/checklist/upload-errors";

import {
  buildChecklistIntake,
  type ChecklistFields,
} from "@/lib/checklist/build-lease";
import { importChecklistToBackend } from "@/lib/checklist/import";
import type { ScheduleBlock } from "@/lib/checklist/parse";
import { extractChecklist, selectChecklistImportSheet } from "@/lib/checklist/parse";
import { checklistSourceSchema } from "@/lib/checklist/source-schema";
import type { ChecklistSource } from "@/core/checklists";
import type { ChecklistImportResult } from "@/lib/checklist/result";
import { getBackend } from "@/server/container";
import { requireResource } from "@/lib/auth/authorization";
import { withAudit } from "@/server/db/client";
import type { AppUser } from "@/lib/demo/identity";

export interface ChecklistInput {
  source?: ChecklistSource;
  /** Explicit choice when a workbook contains multiple checklist versions. */
  sheetIndex?: number;
  fields?: ChecklistFields;
  schedules?: ScheduleBlock[];
  unknown?: Array<{ key: string; value: string }>;
}

/**
 * Build + persist a single checklist's records (master + optional sub-lease)
 * to the active backend (`getBackend()` — supabase in Phase 02), then
 * revalidate the affected routes.
 */
type ImportOutcome = { ok: true; data: ChecklistImportResult } | { ok: false; problem: ChecklistUploadProblem };

export async function importChecklist(input: ChecklistInput): Promise<ImportOutcome> {
  let phase: "prepare" | "save" = "prepare";
  try {
    const actor = await requireResource("checklists:manage");
    const result = await importOne(input, actor, () => { phase = "save"; });
    // A refresh failure must not turn a successfully saved import into a retry.
    try { await revalidateBackend(); } catch (error) { console.error("Checklist refresh failed", error); }
    return { ok: true, data: result };
  } catch (error) {
    const reference = `CHK-${randomUUID().slice(0, 8).toUpperCase()}`;
    console.error(`Checklist import ${reference} (${phase})`, error);
    return { ok: false, problem: { ...checklistUploadProblem(error, phase, input.source), reference } };
  }
}

/**
 * Batch path used by the bulk uploader. Imports each file in order, collects
 * per-file results with the same recovery guidance as single-file uploads.
 */
export async function importChecklistBatch(inputs: ChecklistInput[]): Promise<{ results: ImportOutcome[] }> {
  const results: ImportOutcome[] = [];
  for (const input of inputs) {
    results.push(await importChecklist(input));
  }
  return { results };
}

async function importOne(input: ChecklistInput, actor: AppUser, beforeSave: () => void): Promise<ChecklistImportResult> {
  if (input.source) {
    const source = selectChecklistImportSheet(checklistSourceSchema.parse(input.source), input.sheetIndex);
    const extracted = extractChecklist(source.sheets[source.importSheetIndex].rows);
    if (!Object.keys(extracted.fields).length) throw new ChecklistUploadError(unrecognisedChecklist());
    const intake = buildChecklistIntake({ ...extracted, source });
    beforeSave();
    return withAudit(actor, "Checklist imported", () => importChecklistToBackend(getBackend(), intake), { source: "checklist-upload" });
  }
  // `ChecklistFields` has optional keys; the raw extractor types `fields` as
  // `Record<string, string>`. Strip `undefined`s before forwarding so the
  // widened shape lines up.
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.fields ?? {})) {
    if (typeof v === "string") fields[k] = v;
  }
  const intake = buildChecklistIntake({
    fields,
    unknown: input.unknown ?? [],
    schedules: input.schedules ?? [],
  });
  beforeSave();
  return withAudit(actor, "Checklist imported", () => importChecklistToBackend(getBackend(), intake), {
    source: "checklist-upload",
  });
}

async function revalidateBackend() {
  for (const path of ["/", "/leases", "/rent", "/properties", "/parties"]) {
    revalidatePath(path);
  }
  revalidatePath("/leases/[id]", "page");
}
