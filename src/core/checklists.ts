/** Displayed source cells, preserved independently of the editable agreement. */
export interface ChecklistSheet {
  name: string;
  rows: string[][];
  merges: { startRow: number; startColumn: number; endRow: number; endColumn: number }[];
}

export interface ChecklistSource {
  version: 1;
  fileName: string;
  importSheetIndex: number;
  sheets: ChecklistSheet[];
}

export interface ChecklistMapping {
  sheet: number;
  row: number;
  status: "mapped" | "partial" | "unmapped" | "blank" | "heading" | "duplicate";
  explanation: string;
  targets: { field: string; value: string }[];
}

export interface SavedChecklist {
  source: ChecklistSource;
  savedAt: string;
  mode: "imported" | "attached";
  /** A paired import contains both agreements; require access to both. */
  requiredLeaseIds: string[];
  mappings: ChecklistMapping[];
}
