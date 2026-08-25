"use server";

import { revalidatePath } from "next/cache";

import {
  buildChecklistIntake,
  type ChecklistFields,
} from "@/lib/checklist/build-lease";
import { importChecklistToBackend } from "@/lib/checklist/import";
import type { ScheduleBlock } from "@/lib/checklist/parse";
import type { ChecklistImportResult } from "@/lib/checklist/result";
import { getBackend } from "@/server/container";

export interface ChecklistInput {
  fields: ChecklistFields;
  schedules?: ScheduleBlock[];
  unknown?: Array<{ key: string; value: string }>;
}

/**
 * Build + persist a single checklist's records (master + optional sub-lease)
 * to the active backend (`getBackend()` — supabase in Phase 02), then
 * revalidate the affected routes.
 */
export async function importChecklist(input: ChecklistInput): Promise<ChecklistImportResult> {
  const result = await importOne(input);
  await revalidateBackend();
  return result;
}

/**
 * Batch path used by the bulk uploader. Imports each file in order, collects
 * per-file results, revalidates once at the end.
 */
export async function importChecklistBatch(inputs: ChecklistInput[]): Promise<{
  results: Array<{ ok: true; data: ChecklistImportResult } | { ok: false; error: string }>;
}> {
  const results: Array<{ ok: true; data: ChecklistImportResult } | { ok: false; error: string }> = [];
  for (const input of inputs) {
    try {
      results.push({ ok: true, data: await importOne(input) });
    } catch (err) {
      results.push({ ok: false, error: err instanceof Error ? err.message : "Import failed" });
    }
  }
  await revalidateBackend();
  return { results };
}

async function importOne(input: ChecklistInput): Promise<ChecklistImportResult> {
  // `ChecklistFields` has optional keys; the raw extractor types `fields` as
  // `Record<string, string>`. Strip `undefined`s before forwarding so the
  // widened shape lines up.
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.fields)) {
    if (typeof v === "string") fields[k] = v;
  }
  const intake = buildChecklistIntake({
    fields,
    unknown: input.unknown ?? [],
    schedules: input.schedules ?? [],
  });
  return importChecklistToBackend(getBackend(), intake);
}

async function revalidateBackend() {
  for (const path of ["/", "/leases", "/rent", "/properties", "/parties"]) {
    revalidatePath(path);
  }
  revalidatePath("/leases/[id]", "page");
}
