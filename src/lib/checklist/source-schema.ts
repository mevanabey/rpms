import { z } from "zod";
import type { SavedChecklist } from "@/core/checklists";

const index = z.number().int().nonnegative();
export const checklistSourceSchema = z.object({
  version: z.literal(1),
  fileName: z.string().min(1).max(255),
  importSheetIndex: index,
  sheets: z.array(z.object({
    name: z.string().min(1).max(255),
    rows: z.array(z.array(z.string().max(32767)).max(60)).max(2000),
    merges: z.array(z.object({ startRow: index, startColumn: index, endRow: index, endColumn: index })).max(2000),
  })).min(1).max(20),
}).superRefine((source, ctx) => {
  if (source.importSheetIndex >= source.sheets.length) ctx.addIssue({ code: "custom", message: "The import sheet does not exist." });
  if (JSON.stringify(source).length > 650000) ctx.addIssue({ code: "custom", message: "This checklist is too large to preserve. Use a smaller workbook (maximum 650,000 characters)." });
  for (const sheet of source.sheets) {
    const width = Math.max(0, ...sheet.rows.map((row) => row.length));
    for (const merge of sheet.merges) {
      if (merge.endRow < merge.startRow || merge.endColumn < merge.startColumn || merge.endRow >= sheet.rows.length || merge.endColumn >= width) {
        ctx.addIssue({ code: "custom", message: "Invalid merged cells in the checklist." });
      }
    }
    // Reject overlapping merge ranges rather than hiding source cells.
    for (let i = 0; i < sheet.merges.length; i++) for (let j = 0; j < i; j++) {
      const a = sheet.merges[i], b = sheet.merges[j];
      if (a.startRow <= b.endRow && b.startRow <= a.endRow && a.startColumn <= b.endColumn && b.startColumn <= a.endColumn) {
        ctx.addIssue({ code: "custom", message: "Overlapping merged cells in the checklist." });
      }
    }
  }
});

export const savedChecklistSchema = z.object({
  source: checklistSourceSchema,
  savedAt: z.string(),
  mode: z.enum(["imported", "attached"]),
  requiredLeaseIds: z.array(z.string()).min(1),
  mappings: z.array(z.object({
    sheet: index, row: index,
    status: z.enum(["mapped", "partial", "unmapped", "blank", "heading", "duplicate"]),
    explanation: z.string(),
    targets: z.array(z.object({ field: z.string(), value: z.string() })),
  })),
});

export function readSavedChecklist(value: unknown): SavedChecklist | null {
  const result = savedChecklistSchema.safeParse(value);
  return result.success ? result.data : null;
}
