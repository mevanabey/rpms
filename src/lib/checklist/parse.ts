/**
 * Checklist parser. The pipeline:
 *
 *   File (CSV / XLSX / XLS / ODS)
 *     ↓  parseCsv / parseXlsx
 *   Grid (string[][])
 *     ↓  extractChecklist
 *   { fields, unknown, schedules }
 *
 * Designed to be permissive — operators have ~200 of these files with drifty
 * label spellings, different date formats and inconsistent column orders. We
 * fuzzy-match labels (substring + synonym list), detect schedule blocks by
 * shape rather than fixed coordinates, and capture everything we don't
 * understand under `unknown` so it survives into `importMeta` for audit.
 */

import * as XLSX from "xlsx";

import type { Currency } from "@/core/types";

// ─────────────────────────────────────────────────────── File → Grid

export type CsvRow = string[];
export type Grid = CsvRow[];

export function parseCsv(text: string): Grid {
  const rows: Grid = [];
  let row: CsvRow = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else if (c === "\r") {
      // swallow
    } else {
      cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function parseXlsx(buffer: ArrayBuffer): Grid {
  const wb = XLSX.read(buffer, { type: "array" });
  if (wb.SheetNames.length === 0) return [];

  const grids = wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: true,
    }) as unknown[][];
    return grid.map((row) => row.map(stringifyCell));
  });

  const recognised = grids.find(looksLikeChecklist);
  return recognised ?? grids[0] ?? [];
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function looksLikeChecklist(grid: Grid): boolean {
  for (let i = 0; i < Math.min(grid.length, 12); i++) {
    const key = norm(grid[i]?.[0] ?? "");
    if (!key) continue;
    if (
      key.includes("premises address") ||
      key.includes("apartment name") ||
      key.includes("lessor") ||
      key.includes("landlord") ||
      key.includes("tenant") ||
      key.includes("lessee")
    ) {
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────── Field map (metadata)

export interface FieldDef {
  /** Canonical key stashed on the draft intent. */
  key: string;
  /** Operator-facing label used in the preview list. */
  label: string;
  /** Lowercased substrings — first match wins. Order them most-specific first
   *  to avoid greedy overlaps (e.g. "stamp duty" before "duty"). */
  match: string[];
}

/**
 * Order is the render order in the preview list.
 *
 * Labels mirror the firm's checklist headings verbatim (so the operator sees
 * the same wording during preview). `match` is a fuzzy-substring list — keep
 * the **most specific phrase first** because the first hit wins and a short
 * common word would otherwise capture a more-specific row first.
 *
 * The matcher is tolerant of:
 *  – common typos in firm-supplied checklists ("Panelty", "Mangement", "adress")
 *  – trailing currency hints in labels ("Monthly Rental (USD/LKR)")
 *  – casing / extra whitespace (handled by `norm()`)
 */
export const FIELD_DEFS: FieldDef[] = [
  { key: "premisesAddress", label: "Premises address", match: ["premises address", "premises"] },
  { key: "advisorName", label: "Property Investment Advisor", match: ["property investment advisor", "investment advisor", "advisor name", "advisor"] },
  { key: "ctpLawyer", label: "CTP Lawyer", match: ["ctp lawyer name", "ctp lawyer", "capital trust lawyer"] },
  { key: "counterpartyLawyer", label: "Landlord's Lawyer", match: ["landlord's lawyer", "lessor's lawyer", "tenant's lawyer", "lessee's lawyer"] },
  { key: "agreementLabel", label: "Lease / Rent Agreement", match: ["lease/rent agreement", "lease / rent agreement", "agreement type", "type of agreement"] },
  { key: "lessorName", label: "Lessor's Name & ID", match: ["lessor's name", "landlord's name", "lessor name", "landlord name"] },
  { key: "lessorAddress", label: "Lessor's Address", match: ["lessor's address", "landlord's address", "lessor's adress", "landlord's adress"] },
  { key: "lesseeName", label: "Lessee's Name & ID", match: ["lessee's name", "tenant's name", "lessee name", "tenant name"] },
  // Must precede `lesseeAddress` so "lessee's current employer" doesn't fall
  // through to address-shaped matchers (it wouldn't, but order is also the
  // render order in the preview list and "Employer" is logically near name).
  { key: "lesseeEmployer", label: "Lessee's Current Employer", match: ["lessee's current employer", "lessee current employer", "tenant's current employer", "tenant current employer", "current employer", "employer"] },
  { key: "lesseeAddress", label: "Lessee's Address", match: ["lessee's adress", "lessee's address", "tenant's adress", "tenant's address"] },
  { key: "propertyName", label: "Apartment name", match: ["apartment name", "property name", "building name", "building"] },
  { key: "unitNo", label: "Unit Nos.", match: ["unit nos", "unit no", "unit number", "unit#"] },
  { key: "term", label: "Lease / Rent Period", match: ["lease/rent period", "lease / rent period", "tenancy period", "lease period", "rent period", "term"] },
  { key: "monthlyRent", label: "Monthly Rental", match: ["monthly rental", "monthly rent"] },
  { key: "advancePayment", label: "Advance payment", match: ["advance payment", "advance"] },
  // depositRefundTo must precede `deposit` so "Refundable deposit to be credited to"
  // isn't swallowed by the broader "refundable deposit" pattern below.
  { key: "depositRefundTo", label: "Refundable deposit credited to", match: ["refundable deposit to be credited", "deposit credited to", "deposit refund to", "deposit to be credited"] },
  { key: "deposit", label: "Refundable deposit", match: ["refundable deposit amount", "refundable deposit", "security deposit", "deposit amount"] },
  { key: "taxApplicability", label: "Applicability of WHT and any other taxes", match: ["applicability of wht", "withholding tax", "applicability of taxes", "wht and any other taxes", "wht", "tax applicability", "any other taxes"] },
  { key: "fxBasis", label: "FX rate basis (USD)", match: ["how exchange rate is taken", "exchange rate basis", "fx basis", "fx rate basis"] },
  { key: "firstFxRate", label: "First exchange rate (LKR)", match: ["first exchange rate", "first fx rate", "first selling rate", "exchange rate taken"] },
  { key: "bedrooms", label: "No. of bedrooms", match: ["no. of bedrooms", "no of bedrooms", "bedrooms", "bedroom"] },
  { key: "occupancyCap", label: "No. of people can accommodate", match: ["no. of people", "no of people", "people can accommodate", "occupancy"] },
  { key: "minorRepairs", label: "Minor repairs", match: ["minor repairs", "minor repair"] },
  { key: "handoverPenalty", label: "Penalty for delay handover", match: ["panelty for delay handover", "penalty for delay handover", "handover penalty", "handover delay"] },
  { key: "maintenanceClause", label: "Maintenance & cleanliness clause", match: ["maintenance & cleanliness", "maintenance and cleanliness", "maintenance clause"] },
  { key: "managementFees", label: "Management fees paid by", match: ["mangement fees", "management fees", "management fee"] },
  { key: "serviceCharges", label: "Service charges paid by", match: ["service charges", "service charge"] },
  // Period must match BEFORE the generic "a/c service" rule so "A/C service
  // period" doesn't get swallowed as "A/C Service by".
  { key: "acServicePeriod", label: "A/C service period", match: ["a/c service period", "ac service period", "air conditioning service period", "a/c service frequency"] },
  { key: "acService", label: "A/C Service by", match: ["a/c service", "ac service", "air conditioning"] },
  { key: "additionalCharges", label: "Additional Charges", match: ["additional charges", "additional charge"] },
  { key: "subletting", label: "Sub-letting", match: ["sub letting", "subletting", "sub-letting"] },
  { key: "terminationNotice", label: "Prior notice of termination", match: ["prior notice of termination", "termination notice", "notice of termination"] },
  { key: "lockInPeriod", label: "Locking period", match: ["locking period", "lock in period", "lock-in period", "lock-in"] },
  { key: "earlyTerminationPenalty", label: "Penalty for early termination", match: ["panelty for early termination", "penalty for early termination", "early termination"] },
  { key: "renewalNotice", label: "Notice of renewal", match: ["notice of renewal", "renewal notice"] },
  { key: "legalFees", label: "Legal fees", match: ["legal fees", "legal fee"] },
  { key: "stampDuty", label: "Stamp duty", match: ["stamp duty"] },
];

const FIELD_LABEL_BY_KEY = new Map(FIELD_DEFS.map((f) => [f.key, f.label]));
export function fieldLabel(key: string): string {
  return FIELD_LABEL_BY_KEY.get(key) ?? key;
}

// ─────────────────────────────────────────────────────── Schedules

export type ColumnRole =
  | "period"
  | "monthlyRent"
  | "periodRent"
  | "paymentMethod"
  | "totalRent"
  | "deposit"
  | "stampDuty"
  | "legalFees"
  | "fxRate"
  | "other";

/**
 * Sub-grouping for a money column, derived from the sub-header band
 * ("Per Apartment" | "For 02 units"). Used by the builder to pick the
 * multi-unit total over the per-apartment figure when the lease covers more
 * than one unit.
 */
export type ColumnGrouping = "perUnit" | "forUnits" | "other";

export interface ScheduleColumn {
  index: number;
  header: string;
  role: ColumnRole;
  currency?: Currency;
  grouping: ColumnGrouping;
}

export interface ScheduleTranche {
  startDate: string;
  endDate: string;
  monthlyRent?: { amount: number; currency: Currency };
  periodRent?: { amount: number; currency: Currency };
  totalRent?: { amount: number; currency: Currency };
  paymentMethod?: string;
}

export interface ScheduleBlock {
  /** Section heading above the column header row, if any. */
  label?: string;
  /** Heuristic kind. "sub" when the label mentions sub-tenancy / sub-lease. */
  kind: "master" | "sub" | "unknown";
  columns: ScheduleColumn[];
  tranches: ScheduleTranche[];
  /** Derived from the gap between the first tranche's start/end. */
  cadence: "monthly" | "quarterly" | "biannual" | "annual";
}

const COLUMN_ROLE_RULES: Array<{ test: (s: string) => boolean; role: ColumnRole }> = [
  { test: (s) => /^period\b/.test(s) || /^date(\s|$)/.test(s), role: "period" },
  { test: (s) => /\bmonthly\s+rent\b/.test(s) || /\bmonth(ly)?\s+rental\b/.test(s), role: "monthlyRent" },
  { test: (s) => /\b(three|3)\s+months?\s+rent\b/.test(s) || /\bquarterly\s+rent\b/.test(s) || /\bperiod\s+rent\b/.test(s) || /\brent\s+for\s+period\b/.test(s), role: "periodRent" },
  { test: (s) => /\bpayment\s+method\b/.test(s) || /\bpayment\s+mode\b/.test(s), role: "paymentMethod" },
  { test: (s) => /\btotal\s+rent\b/.test(s), role: "totalRent" },
  { test: (s) => /\bdeposit\b/.test(s), role: "deposit" },
  { test: (s) => /\bstamp\s+duty\b/.test(s), role: "stampDuty" },
  { test: (s) => /\blegal\s+fees?\b/.test(s), role: "legalFees" },
  { test: (s) => /\bselling\s+rate\b/.test(s) || /\bfx\b/.test(s) || /\bexchange\s+rate\b/.test(s), role: "fxRate" },
];

function classifyColumn(header: string): ColumnRole {
  const s = norm(header);
  if (!s) return "other";
  for (const rule of COLUMN_ROLE_RULES) if (rule.test(s)) return rule.role;
  return "other";
}

function currencyFromHeaderOrUnit(header: string, unit: string): Currency | undefined {
  const text = `${header} ${unit}`;
  if (/\busd\b|\bus\$|\$\s/i.test(text)) return "USD";
  if (/\blkr\b|\brs\.?\b|sri lankan/i.test(text)) return "LKR";
  return undefined;
}

/** "26.03.2026", "2026.02.28", "26/03/2026", "2026-02-28", "26-03-2026" → ISO. */
export function parseLooseDate(raw: string): string | undefined {
  const trimmed = raw.trim().replace(/[/.\-]/g, ".");
  const parts = trimmed.split(".").map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 3) return undefined;
  let y: number, m: number, d: number;
  if (parts[0].length === 4) {
    [y, m, d] = parts.map(Number);
  } else if (parts[2].length === 4) {
    [d, m, y] = parts.map(Number);
  } else {
    return undefined;
  }
  if (!y || !m || !d || m > 12 || m < 1 || d > 31 || d < 1) return undefined;
  return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

/** Pull `{ start, end }` from "26.03.2026 - 25.03.2028", "2026.02.28- 2027.02.27" etc. */
export function parseDateRange(raw: string): { startDate: string; endDate: string } | undefined {
  if (!raw) return undefined;
  const match = raw.match(
    /(\d{1,4}[./-]\s*\d{1,2}[./-]\s*\d{1,4})\s*[-–to]+\s*(\d{1,4}[./-]\s*\d{1,2}[./-]\s*\d{1,4})/,
  );
  if (!match) return undefined;
  const start = parseLooseDate(match[1].replace(/\s+/g, ""));
  const end = parseLooseDate(match[2].replace(/\s+/g, ""));
  if (!start || !end) return undefined;
  return { startDate: start, endDate: end };
}

function parseNumber(raw: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/,/g, "").replace(/\.$/, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function cadenceFromDays(days: number): ScheduleBlock["cadence"] {
  if (days <= 45) return "monthly";
  if (days <= 110) return "quarterly";
  if (days <= 200) return "biannual";
  return "annual";
}

function isBlankRow(row: CsvRow): boolean {
  return row.every((c) => !c || !c.trim());
}

function isSectionLabelRow(row: CsvRow): boolean {
  const nonEmpty = row.filter((c) => c && c.trim());
  if (nonEmpty.length !== 1) return false;
  const s = norm(nonEmpty[0]);
  // Section labels have words but no key:value structure.
  return /agreement\s+payment|payment\s+schedule|rent\s+schedule|tranche|sub[- ]?tenancy|master\s+agreement/.test(s);
}

function isScheduleHeaderRow(row: CsvRow): boolean {
  const first = norm(row[0] ?? "");
  if (!first) return false;
  if (!(first === "period" || first.startsWith("period ") || first.startsWith("date ") || first === "date")) {
    return false;
  }
  // Must have a "rent" or "amount" column somewhere too.
  return row.some((c) => /\brent\b|\bamount\b/i.test(c ?? ""));
}

/**
 * Walk the grid once, splitting into (a) metadata key/value pairs and
 * (b) schedule blocks. Schedule blocks live below a section label like
 * "Master Agreement Payments" or "Sub Tenancy Agreement payments".
 */
export function extractChecklist(rows: Grid): ExtractedChecklist {
  const fields: Record<string, string> = {};
  const unknown: Array<{ key: string; value: string }> = [];
  const schedules: ScheduleBlock[] = [];

  let i = 0;
  let pendingLabel: string | undefined;

  while (i < rows.length) {
    const row = rows[i];

    if (!row || isBlankRow(row)) {
      i++;
      continue;
    }

    if (isSectionLabelRow(row)) {
      pendingLabel = row.find((c) => c && c.trim())!.trim();
      i++;
      continue;
    }

    if (isScheduleHeaderRow(row)) {
      const consumed = readScheduleBlock(rows, i, pendingLabel);
      if (consumed.block) schedules.push(consumed.block);
      pendingLabel = undefined;
      i = consumed.nextIndex;
      continue;
    }

    // Metadata key/value row.
    const rawKey = (row[0] ?? "").trim();
    // The firm's checklists routinely split a single logical value across
    // several columns — e.g.
    //   "Advance payment" | "per unit - 5,250" | "" | "" | "Two Units- 10,500"
    //   "First exchange rate taken" | "(LKR)"  | ""  | "US$317.75"
    // Taking the first populated cell loses the second half of the value
    // (the multi-unit total or the actual amount). Join every non-empty cell
    // after col 0 with a space so downstream parsers see the full string.
    const rawValue = row
      .slice(1)
      .map((c) => (c ?? "").trim())
      .filter(Boolean)
      .join(" ");
    if (!rawKey) {
      i++;
      continue;
    }
    const key = norm(rawKey);
    const def = FIELD_DEFS.find((f) => f.match.some((m) => key.includes(m)));
    if (def) {
      if (rawValue && !fields[def.key]) fields[def.key] = rawValue;
    } else if (rawValue) {
      unknown.push({ key: rawKey, value: rawValue });
    }
    i++;
  }

  return { fields, unknown, schedules };
}

function readScheduleBlock(
  rows: Grid,
  headerIdx: number,
  pendingLabel: string | undefined,
): { block?: ScheduleBlock; nextIndex: number } {
  const header = rows[headerIdx];
  if (!header) return { nextIndex: headerIdx + 1 };

  // Sub-header rows sit between the column header and the first data row. They
  // carry currency markers (USD / LKR / Rs) and grouping labels like "Per
  // Apartment" / "For 02 units". Find where the data (first date-range row)
  // begins, then mine *every* sub-header row for per-column currency — exports
  // sometimes put the currency row two rows below the header, not one.
  let dataStart = headerIdx + 1;
  while (dataStart < rows.length) {
    const r = rows[dataStart];
    if (r && parseDateRange(r[0] ?? "")) break;
    if (r && (isSectionLabelRow(r) || isScheduleHeaderRow(r))) break;
    if (dataStart - headerIdx > 4) break; // stay within the sub-header band
    dataStart++;
  }
  const subHeaderRows = rows.slice(headerIdx + 1, dataStart);

  const currencyFromSubHeaders = (idx: number): Currency | undefined => {
    for (const sr of subHeaderRows) {
      const cur = currencyFromHeaderOrUnit("", (sr[idx] ?? "").trim());
      if (cur) return cur;
    }
    return undefined;
  };

  const groupingFor = (idx: number): ColumnGrouping => {
    for (const sr of subHeaderRows) {
      const cell = norm(sr[idx] ?? "");
      if (!cell) continue;
      if (/per\s+(?:apartment|unit|apt)\b/.test(cell)) return "perUnit";
      if (/\bfor\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+units?\b/.test(cell)) return "forUnits";
    }
    return "other";
  };

  const columns: ScheduleColumn[] = header.map((h, idx) => {
    const headerText = (h ?? "").trim();
    return {
      index: idx,
      header: headerText,
      role: classifyColumn(headerText),
      currency: currencyFromHeaderOrUnit(headerText, "") ?? currencyFromSubHeaders(idx),
      grouping: groupingFor(idx),
    };
  });

  // Propagate role forward into empty-header columns so a single "Monthly
  // Rent" label that spans 4 sub-columns (Per Apartment USD | LKR | For N
  // units USD | LKR) reaches all four. A non-empty header resets the run.
  let runningRole: ColumnRole = "other";
  for (const col of columns) {
    if (col.header.length > 0) {
      runningRole = col.role;
    } else if (col.role === "other") {
      col.role = runningRole;
    } else {
      runningRole = col.role;
    }
  }

  // If a rent column still lacks a currency, propagate the nearest one forward
  // (handles merged-cell exports where only the leftmost column carries it).
  let runningCurrency: Currency | undefined;
  for (const col of columns) {
    if (col.currency) runningCurrency = col.currency;
    else if (col.role === "monthlyRent" || col.role === "periodRent" || col.role === "totalRent") {
      col.currency = runningCurrency;
    }
  }

  // Pick a single column per role. For money roles, prefer a "For N units"
  // grouping when present (multi-unit totals), and within that prefer USD
  // when the firm's residential checklists use it as the contract currency.
  const pickMoneyCol = (role: ColumnRole): ScheduleColumn | undefined => {
    const candidates = columns.filter((c) => c.role === role);
    if (candidates.length === 0) return undefined;
    const score = (c: ScheduleColumn): number =>
      (c.grouping === "forUnits" ? 4 : c.grouping === "perUnit" ? 1 : 2) +
      (c.currency === "USD" ? 0.5 : 0);
    return [...candidates].sort((a, b) => score(b) - score(a))[0];
  };
  const monthlyCol = pickMoneyCol("monthlyRent");
  const periodCol = pickMoneyCol("periodRent");
  const totalCol = pickMoneyCol("totalRent");
  const paymentCol = columns.find((c) => c.role === "paymentMethod");

  const tranches: ScheduleTranche[] = [];
  let cursor = dataStart;
  while (cursor < rows.length) {
    const r = rows[cursor];
    if (!r || isBlankRow(r)) {
      cursor++;
      // A single blank row inside a schedule is OK; two blanks → end of block.
      if (cursor < rows.length && (!rows[cursor] || isBlankRow(rows[cursor]))) break;
      continue;
    }
    if (isSectionLabelRow(r) || isScheduleHeaderRow(r)) break;
    const range = parseDateRange(r[0] ?? "");
    if (!range) {
      // Stop if the first column is metadata-looking text (e.g., a field key).
      const key = norm(r[0] ?? "");
      if (key && FIELD_DEFS.some((f) => f.match.some((m) => key.includes(m)))) break;
      cursor++;
      continue;
    }
    const tr: ScheduleTranche = { ...range };
    if (monthlyCol) {
      const amt = parseNumber(r[monthlyCol.index] ?? "");
      if (amt) tr.monthlyRent = { amount: amt, currency: monthlyCol.currency ?? "LKR" };
    }
    if (periodCol) {
      const amt = parseNumber(r[periodCol.index] ?? "");
      if (amt) tr.periodRent = { amount: amt, currency: periodCol.currency ?? "LKR" };
    }
    if (totalCol) {
      const amt = parseNumber(r[totalCol.index] ?? "");
      if (amt) tr.totalRent = { amount: amt, currency: totalCol.currency ?? "LKR" };
    }
    if (paymentCol) {
      const txt = (r[paymentCol.index] ?? "").trim();
      if (txt) tr.paymentMethod = txt;
    }
    tranches.push(tr);
    cursor++;
  }

  if (tranches.length === 0) return { nextIndex: cursor };

  const firstDays =
    (new Date(tranches[0].endDate).getTime() - new Date(tranches[0].startDate).getTime()) /
    86400000;
  // For multi-tranche head leases the tranche span is multi-year — fall back
  // to the payment method text to decide cadence in that case.
  let cadence: ScheduleBlock["cadence"] = cadenceFromDays(firstDays);
  if (cadence === "annual" && tranches[0].paymentMethod) {
    const pm = tranches[0].paymentMethod.toLowerCase();
    if (/three\s+months|3\s+months|quarterly/.test(pm)) cadence = "quarterly";
    else if (/six\s+months|6\s+months|bi[- ]?annual|semi/.test(pm)) cadence = "biannual";
    else if (/month/.test(pm)) cadence = "monthly";
  }

  const label = pendingLabel?.trim();
  const labelLc = label?.toLowerCase() ?? "";
  const kind: ScheduleBlock["kind"] = /sub[- ]?tenancy|sub[- ]?lease|sub tenant/.test(labelLc)
    ? "sub"
    : labelLc.includes("master")
      ? "master"
      : "unknown";

  return {
    block: { label, kind, columns, tranches, cadence },
    nextIndex: cursor,
  };
}

// ─────────────────────────────────────────────────────── Public exports

export interface ExtractedChecklist {
  fields: Record<string, string>;
  unknown: Array<{ key: string; value: string }>;
  schedules: ScheduleBlock[];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
