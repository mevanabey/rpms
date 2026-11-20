import { z } from "zod";
import type { ChecklistSource } from "@/core/checklists";

/** Only these curated explanations cross the server/client boundary. */
export interface ChecklistUploadProblem {
  title: string;
  explanation: string;
  steps: string[];
  recovery: "replace" | "retry" | "check_leases" | "sign_in" | "contact_admin";
  reference?: string;
}

export class ChecklistUploadError extends Error {
  constructor(public readonly problem: ChecklistUploadProblem) {
    super(`${problem.title}. ${problem.explanation}`);
    this.name = "ChecklistUploadError";
  }
}

export function fileProblem(title: string, explanation: string, ...steps: string[]): ChecklistUploadProblem {
  return { title, explanation, steps, recovery: "replace" };
}

export const unsupportedChecklist = () => fileProblem(
  "Choose a spreadsheet file",
  "This file type cannot be used as a checklist.",
  "Open the checklist in Excel and choose Save As → Excel Workbook (.xlsx). Changing the filename alone will not convert it.",
  "Upload the saved copy. Excel (.xlsx or .xls), OpenDocument (.ods) and CSV (.csv) files are supported.",
);

export const unrecognisedChecklist = () => fileProblem(
  "We couldn’t find the checklist details",
  "The file opened, but we could not identify any checklist fields.",
  "Check that you selected the completed checklist, rather than an agreement or payment report.",
  "Keep field labels such as Premises Address, Lessor or Service Provider in the first column, with their answers to the right. Save the file and upload it again.",
  "If it already follows this layout, ask your administrator to check the file format.",
);

export function sheetSizeProblem(sheet: string, rows: number, columns: number): ChecklistUploadProblem {
  return fileProblem("This worksheet is too large", `The “${sheet}” worksheet extends to ${rows.toLocaleString("en-US")} rows and ${columns.toLocaleString("en-US")} columns. The limit is 2,000 rows and 256 columns per worksheet.`,
    "In Excel, check for unused rows or columns far below or to the right of the checklist. Delete only those you do not need, then save a copy and upload it again.",
    "If all of the information is needed, ask your administrator for help. Do not remove required checklist details.");
}

function sourceValidationProblem(error: z.ZodError, source?: ChecklistSource): ChecklistUploadProblem {
  const issue = error.issues[0];
  const path = issue?.path ?? [];
  const sheet = typeof path[1] === "number" ? source?.sheets?.[path[1]] : undefined;
  const where = sheet ? ` in worksheet “${sheet.name}”` : "";
  if (issue?.message.includes("650,000")) return fileProblem("This workbook contains too much information", "The checklist is too large to save with all its original details.", "Save a copy containing only the checklist and supporting worksheets needed for this agreement, then upload it again.", "If all worksheets are needed, ask your administrator for help.");
  if (path[0] === "fileName") return fileProblem("Shorten the file name", "The file name must be between 1 and 255 characters.", "Give the file a shorter name, keep its file extension, and upload it again.");
  if (path[0] === "sheets" && path.length === 1) return fileProblem("Check the worksheets in this file", "A checklist workbook needs between 1 and 20 worksheets.", "Save a copy with the checklist and its required supporting worksheets, then upload it again.");
  if (path[2] === "rows" && issue?.code === "too_big") {
    if (path.length >= 5) return fileProblem("A cell contains too much text", `Cell ${columnName(Number(path[4]))}${Number(path[3]) + 1}${where} contains more than 32,767 characters.`, "Shorten the text in that cell, save a copy and upload it again. Ask your administrator for help if the full text must be kept.");
    return sheetSizeProblem(sheet?.name ?? "Checklist", sheet?.rows.length ?? 2001, Math.max(0, ...(sheet?.rows.map(row => row.length) ?? [257])));
  }
  if (issue?.message.includes("merged cells") || path[2] === "merges") return fileProblem("Some joined cells could not be read", `The layout has merged cells that overlap or extend outside the worksheet${where}.`, "Open a copy in Excel. Unmerge the affected cells, check that all text is still visible, then save and upload the copy.", "If you are unsure which cells to change, ask your administrator to help with the layout.");
  return fileProblem("We couldn’t read the checklist layout", "Some of the spreadsheet’s details could not be read safely.", "Open the file in Excel, choose Save As → Excel Workbook (.xlsx), then upload the saved copy.", "If this happens again, ask your administrator to check the checklist layout.");
}

function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}

export function checklistUploadProblem(error: unknown, phase: "read" | "prepare" | "save", source?: ChecklistSource): ChecklistUploadProblem {
  // Saving can fail after records were created. Never promise nothing was saved
  // or suggest a blind retry, even for a validation/permission error at that stage.
  if (phase === "save") return {
    title: "We couldn’t confirm the import finished",
    explanation: "Some or all of this checklist may already have been saved.",
    steps: ["Open Leases in a new tab and look for this agreement before uploading it again.", "If you find it, open it and check the checklist details. If it is missing or incomplete, ask your administrator to check the import so you do not create a duplicate."],
    recovery: "check_leases",
  };
  if (error instanceof ChecklistUploadError) return error.problem;
  if (error instanceof z.ZodError) return sourceValidationProblem(error, source);
  const message = error instanceof Error ? error.message : "";
  if (/^Not authenticated\.|^Unauthorized$|session expired/i.test(message)) return {
    title: "Please sign in again", explanation: "Your sign-in session has ended.",
    steps: ["Sign in in a new tab, then return here and choose Try again. Your selected file will stay on this page."], recovery: "sign_in",
  };
  if (/^Access denied:/.test(message)) return {
    title: "You need permission to do this", explanation: "Your account does not have access to this checklist action.",
    steps: ["Ask your administrator to check your checklist and lease permissions. You do not need to change the spreadsheet.", "After access is updated, choose Try again."], recovery: "contact_admin",
  };
  if (phase === "read") {
    if (/password|encrypt/i.test(message)) return fileProblem("This spreadsheet is password protected", "We cannot open a password-protected checklist.", "Ask the file owner for an unprotected copy, then upload that copy.");
    return fileProblem("We couldn’t open this spreadsheet", "The file may be damaged or saved in a format we cannot read.", "Open it in Excel. If Excel asks to repair the file, review the repaired contents, then choose Save As → Excel Workbook (.xlsx).", "Upload the saved copy. If Excel cannot open it, ask the sender for another copy.");
  }
  return { title: "We couldn’t start the import", explanation: "RPMS could not prepare this checklist for saving.", steps: ["Check your connection and choose Try again. You do not need to change the spreadsheet.", "If it still fails, share the reference below with your administrator."], recovery: "retry" };
}
