import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import type { ChecklistSource } from "@/core/checklists";
import { buildChecklistIntake } from "./build-lease";
import { buildChecklistMappings } from "./mappings";
import { importChecklistToBackend } from "./import";
import { checklistSheetChoices, extractChecklist, parseChecklistSource, selectChecklistImportSheet } from "./parse";
import { checklistSourceSchema, MAX_CHECKLIST_COLUMNS } from "./source-schema";
import { mockBackend } from "@/server/adapters/mock";

const source: ChecklistSource = {
  version: 1, fileName: "source.xlsx", importSheetIndex: 0,
  sheets: [{ name: "Checklist", merges: [], rows: [
    ["Premises address", "10 Source Road, Colombo"],
    ["Lease/Rent Agreement", "Service Agreement"],
    ["Service Provider's Name", " Provider  Co "],
    ["Client's Name", "Client Co"],
    ["Unit No.", "Floor 3"],
    ["Monthly Rental", "1500"],
    ["Monthly Rental", "2500"],
    ["Term", "02.02.2026 - 01.02.2027"],
    ["Panelty for delay handover", "Not specified"],
    ["Maintenance & cleanliness clause", " First line\nSecond line  "],
    ["Unrecognised custom item", "Keep exactly!"],
    ["", "", ""],
    ["Period", "Monthly Rent", "Total Rent", "Payment method"],
    ["", "LKR", "LKR", ""],
    ["02.02.2026 - 01.03.2026", "1500", "18000", "Every month"],
  ] }, { name: "Notes", merges: [], rows: [["  extra note  ", "=literal text"]] }],
};

test("workbook snapshots preserve displayed values, whitespace, blanks, sheets and merges", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["", "", ""],
    ["Premises address", "  No. 1\nExample Road  ", ""],
    ["", "", ""],
    ["Monthly Rental", 1500, ""],
    ["Merged note", "", ""],
    ["Zero", 0, ""],
  ]);
  sheet.B4.z = '#,##0.00';
  sheet["!merges"] = [XLSX.utils.decode_range("A5:C5")];
  XLSX.utils.book_append_sheet(workbook, sheet, "Original");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Note", "untouched"]]), "Other sheet");
  const bytes: ArrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const result = parseChecklistSource(bytes, "exact.xlsx");
  assert.equal(result.sheets.length, 2);
  assert.equal(result.sheets[0].rows[1][1], "  No. 1\nExample Road  ");
  assert.equal(result.sheets[0].rows[3][1], "1,500.00");
  assert.equal(result.sheets[0].rows[5][1], "0");
  assert.deepEqual(result.sheets[0].rows[0], ["", "", ""]);
  assert.deepEqual(result.sheets[0].rows[2], ["", "", ""]);
  assert.deepEqual(result.sheets[0].merges, [{ startRow: 4, startColumn: 0, endRow: 4, endColumn: 2 }]);
  assert.equal(result.sheets[1].name, "Other sheet");
});

test("wide checklists preserve actual values beyond column BH and enforce shared limits", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([["Premises address", "Example Road"]]);
  sheet.BI39 = { t: "n", v: 46000, z: "dd-mmm-yyyy" };
  sheet.BJ40 = { t: "n", v: 4500000, f: "4500000*1.15-675000", z: "#,##0.00" };
  sheet["!ref"] = "A1:BJ61";
  sheet["!merges"] = [XLSX.utils.decode_range("B1:M1")];
  XLSX.utils.book_append_sheet(workbook, sheet, "Wide checklist");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const snapshot = parseChecklistSource(bytes, "wide.xlsx");
  assert.equal(snapshot.sheets[0].rows.length, 61);
  assert.equal(snapshot.sheets[0].rows[0].length, 62);
  assert.equal(snapshot.sheets[0].rows[39][61], "4,500,000.00");
  assert.ok(snapshot.sheets[0].rows[38][60]);
  assert.equal(snapshot.sheets[0].merges[0].endColumn, 12);
  assert.equal(checklistSourceSchema.safeParse(snapshot).success, true);
  const tooWide = structuredClone(snapshot);
  tooWide.sheets[0].rows[0] = Array(MAX_CHECKLIST_COLUMNS + 1).fill("");
  assert.equal(checklistSourceSchema.safeParse(tooWide).success, false);
  sheet["!ref"] = `A1:${XLSX.utils.encode_col(MAX_CHECKLIST_COLUMNS)}61`;
  assert.throws(() => parseChecklistSource(XLSX.write(workbook, { bookType: "xlsx", type: "array" }), "too-wide.xlsx"), /Wide checklist.*256 columns/);
});

test("multiple checklist versions require a choice and import only that sheet", async () => {
  const revised = structuredClone(source.sheets[0]);
  revised.name = "Revised";
  revised.rows[3][1] = "Revised Client";
  const multi = { ...structuredClone(source), sheets: [source.sheets[0], revised, source.sheets[1]] };
  assert.deepEqual(checklistSheetChoices(multi).map((s) => s.name), ["Checklist", "Revised"]);
  assert.throws(() => selectChecklistImportSheet(multi), /multiple checklists/);
  for (const invalid of [-1, 0.5, 2, 99]) assert.throws(() => selectChecklistImportSheet(multi, invalid), /recognised checklist/);
  const selected = selectChecklistImportSheet(multi, 1);
  const intake = buildChecklistIntake({ ...extractChecklist(selected.sheets[1].rows), source: selected });
  assert.equal(intake.lessee.displayName, "Revised Client");
  const imported = await importChecklistToBackend(mockBackend, intake);
  const saved = await mockBackend.leases.getChecklist(imported.leaseId);
  assert.equal(saved?.source.importSheetIndex, 1);
  assert.equal(saved?.source.sheets.length, 3);
  assert.ok(saved?.mappings.filter((m) => m.sheet === 0).every((m) => ["unmapped", "blank"].includes(m.status)));
  assert.equal(selectChecklistImportSheet(source).importSheetIndex, 0, "single checklist needs no extra choice");
});

test("mapping distinguishes duplicates, unknowns, empty values and schedule-only values", () => {
  const extracted = extractChecklist(source.sheets[0].rows);
  const intake = buildChecklistIntake(extracted);
  const mappings = buildChecklistMappings(source, extracted, intake);
  const row = (index: number) => mappings.find((m) => m.sheet === 0 && m.row === index)!;
  assert.equal(row(2).targets[0].field, "lessor.displayName");
  assert.equal(row(2).targets[0].value, "Provider  Co");
  assert.equal(row(5).status, "unmapped", "schedule overrides monthly summary");
  assert.equal(row(6).status, "duplicate");
  assert.equal(row(8).status, "unmapped", "unparsed text cannot be claimed as a numeric penalty");
  assert.equal(row(9).status, "mapped");
  assert.equal(row(10).status, "unmapped");
  assert.equal(row(11).status, "blank");
  assert.equal(row(12).status, "heading");
  assert.equal(row(14).status, "partial");
  assert.match(row(14).explanation, /Total Rent/);
  assert.equal(mappings.at(-1)?.status, "unmapped", "unselected sheet is preserved only");
  assert.equal(source.sheets[0].rows[2][1], " Provider  Co ", "mapping never normalizes source cells");
});

test("unrecognised schedule rows are not claimed as imported headers", () => {
  const extra = structuredClone(source);
  extra.sheets[0].rows.push(["Custom schedule footnote", "Not imported"]);
  const extracted = extractChecklist(extra.sheets[0].rows);
  const mapping = buildChecklistMappings(extra, extracted, buildChecklistIntake(extracted));
  assert.equal(mapping.find((m) => m.sheet === 0 && m.row === 15)?.status, "unmapped");
});

test("import saves an immutable original separately from normal lease reads", async () => {
  const extracted = { ...extractChecklist(source.sheets[0].rows), source };
  const result = await importChecklistToBackend(mockBackend, buildChecklistIntake(extracted));
  const saved = await mockBackend.leases.getChecklist(result.leaseId);
  assert.ok(saved);
  assert.deepEqual(saved.source, source);
  assert.equal(saved.mode, "imported");
  assert.deepEqual(saved.requiredLeaseIds, [result.leaseId]);
  await mockBackend.leases.update(result.leaseId, { clauses: { maintenanceText: "Edited live value" } });
  assert.equal((await mockBackend.leases.getChecklist(result.leaseId))?.source.sheets[0].rows[9][1], " First line\nSecond line  ");
  saved.source.sheets[0].rows[9][1] = "Changed local copy";
  assert.notEqual((await mockBackend.leases.getChecklist(result.leaseId))?.source.sheets[0].rows[9][1], "Changed local copy");
  assert.equal((await mockBackend.leases.getDetails(result.leaseId))?.lease.importMeta?.checklist, undefined);
  await assert.rejects(() => mockBackend.leases.saveChecklist(result.leaseId, saved), /already has/);
});

test("source validation rejects invalid sheet references and overlapping merges", () => {
  assert.equal(checklistSourceSchema.safeParse({ ...source, importSheetIndex: 9 }).success, false);
  const invalid = structuredClone(source);
  invalid.sheets[0].merges = [
    { startRow: 0, endRow: 1, startColumn: 0, endColumn: 1 },
    { startRow: 1, endRow: 2, startColumn: 1, endColumn: 2 },
  ];
  assert.equal(checklistSourceSchema.safeParse(invalid).success, false);
  const csv = new TextEncoder().encode('Label,"  a\nb  "\r\n\r\nOther,0');
  const parsed = parseChecklistSource(csv.buffer, "source.csv");
  assert.deepEqual(parsed.sheets[0].rows, [["Label", "  a\nb  "], [""], ["Other", "0"]]);
});

test("identical master and sub schedules keep distinct mapping targets and shared access scope", async () => {
  const pairedSource = structuredClone(source);
  const rows = pairedSource.sheets[0].rows;
  rows.splice(12, 0, ["MASTER LEASE"]);
  rows.push([], ["SUB-TENANCY AGREEMENT"], ...structuredClone(rows.slice(13, 16)));
  const extracted = { ...extractChecklist(rows), source: pairedSource };
  const intake = buildChecklistIntake(extracted);
  assert.ok(intake.subLease);
  const mappings = buildChecklistMappings(pairedSource, extracted, intake);
  assert.equal(mappings.find((m) => m.sheet === 0 && m.row === 15)?.targets[0].field, "lease.tranches[0].startDate");
  assert.equal(mappings.find((m) => m.sheet === 0 && m.row === 20)?.targets[0].field, "pairedLease.tranches[0].startDate");
  const result = await importChecklistToBackend(mockBackend, intake);
  const saved = await mockBackend.leases.getChecklist(result.leaseId);
  assert.ok(saved);
  assert.equal(saved.requiredLeaseIds.length, 2);
  const pairedId = saved.requiredLeaseIds.find((id) => id !== result.leaseId)!;
  assert.deepEqual(await mockBackend.leases.getChecklist(pairedId), saved);
});
