import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseChecklistSource } from "./parse";
import { checklistUploadProblem, ChecklistUploadError, sheetSizeProblem } from "./upload-errors";

function parseProblem(buffer: ArrayBuffer, name: string) {
  try { parseChecklistSource(buffer, name); assert.fail("Expected a file error"); }
  catch (error) { return checklistUploadProblem(error, "read"); }
}

test("unsupported and empty files explain how to replace them", () => {
  const unsupported = parseProblem(new ArrayBuffer(2), "checklist.pdf");
  assert.equal(unsupported.recovery, "replace");
  assert.match(unsupported.steps.join(" "), /Save As/);
  assert.match(parseProblem(new ArrayBuffer(0), "checklist.xlsx").title, /empty/);
});

test("oversized files explain the actual size and limit", () => {
  const problem = parseProblem(new ArrayBuffer(11 * 1024 * 1024), "checklist.xlsx");
  assert.match(problem.explanation, /11.0 MB.*10 MB/);
  assert.match(problem.steps[0], /Keep all required/);
});

test("wide worksheets identify the sheet and retain actionable details", () => {
  const problem = checklistUploadProblem(new ChecklistUploadError(sheetSizeProblem("Payments", 40, 257)), "read");
  assert.match(problem.explanation, /Payments.*40 rows.*257 columns.*256/);
  assert.match(problem.steps[0], /Delete only those you do not need/);
});

test("CSV validation gives a cell reference without exposing validation JSON", () => {
  const csv = `Lessor,${"A".repeat(32768)}`;
  const problem = parseProblem(new TextEncoder().encode(csv).buffer as ArrayBuffer, "checklist.csv");
  assert.match(problem.explanation, /B1.*Checklist.*32,767/);
  assert.doesNotMatch(JSON.stringify(problem), /too_big|Zod|"path"/);
});

test("invalid merged cells identify the worksheet and a layout correction", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([["Lessor", "Owner", ""], ["Tenant", "Client", ""]]);
  sheet["!merges"] = [XLSX.utils.decode_range("A1:B1"), XLSX.utils.decode_range("B1:C1")];
  XLSX.utils.book_append_sheet(workbook, sheet, "Original");
  const problem = parseProblem(XLSX.write(workbook, { bookType: "xlsx", type: "array" }), "checklist.xlsx");
  assert.match(problem.explanation, /Original/);
  assert.match(problem.steps[0], /Unmerge/);
});

test("workbook size and worksheet count validation are understandable", () => {
  const csv = Array.from({ length: 25 }, () => `Lessor,${"A".repeat(30000)}`).join("\n");
  assert.match(parseProblem(new TextEncoder().encode(csv).buffer as ArrayBuffer, "checklist.csv").title, /too much information/);
  const wb = XLSX.utils.book_new();
  for (let i = 0; i < 21; i++) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Lessor", "Owner"]]), `Sheet ${i}`);
  assert.match(parseProblem(XLSX.write(wb, { bookType: "xlsx", type: "array" }), "checklist.xlsx").explanation, /1 and 20 worksheets/);
});

test("sign-in and permission failures do not blame the spreadsheet", () => {
  const denied = checklistUploadProblem(new Error("Access denied: leases:write."), "prepare");
  assert.equal(denied.recovery, "contact_admin");
  assert.doesNotMatch(JSON.stringify(denied), /leases:write/);
  assert.equal(checklistUploadProblem(new Error("Not authenticated."), "prepare").recovery, "sign_in");
});

test("unexpected errors never disclose SQL, credentials, or framework details", () => {
  for (const phase of ["read", "prepare", "save"] as const) {
    const problem = checklistUploadProblem(new Error('Failed query: insert into leases; postgres://secret@internal/db'), phase);
    assert.doesNotMatch(JSON.stringify(problem), /insert into|postgres|secret|internal/);
    assert.ok(problem.steps.length);
  }
});

test("a failure after saving starts always asks users to check for an existing lease", () => {
  for (const error of [new TypeError("Failed to fetch"), new Error("Access denied: leases:write."), new ChecklistUploadError(sheetSizeProblem("Original", 3000, 5))]) {
    const problem = checklistUploadProblem(error, "save");
    assert.equal(problem.recovery, "check_leases");
    assert.match(problem.explanation, /may already have been saved/);
    assert.doesNotMatch(problem.steps.join(" "), /choose Try again/);
  }
});
