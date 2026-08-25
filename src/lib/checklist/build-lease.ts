/**
 * Turns parsed checklist data (metadata fields + schedule blocks) into a
 * `ChecklistIntake` — the shape `mockAdmin.upsertFromChecklist` expects.
 *
 * Pure: no IDs, no state. Schedule-first when available; metadata-fallback
 * otherwise. If a "Sub Tenancy Agreement payments" block exists alongside
 * the master, we attach a `subLease` intake that the upsert links via
 * `parentLeaseId`.
 */

import type {
  AgreementLabel,
  Currency,
  DepositRefundTo,
  LeaseClauses,
  LeaseKind,
  LeasePurpose,
  Money,
  PaymentCadence,
  PaymentMethod,
  ResponsibleParty,
  SublettingMode,
} from "@/core/types";

import type { ExtractedChecklist, ScheduleBlock } from "./parse";

export interface ChecklistFields {
  premisesAddress?: string;
  advisorName?: string;
  ctpLawyer?: string;
  counterpartyLawyer?: string;
  agreementLabel?: string;
  lessorName?: string;
  lessorAddress?: string;
  lesseeName?: string;
  lesseeEmployer?: string;
  lesseeAddress?: string;
  propertyName?: string;
  unitNo?: string;
  monthlyRent?: string;
  advancePayment?: string;
  deposit?: string;
  taxApplicability?: string;
  fxBasis?: string;
  firstFxRate?: string;
  bedrooms?: string;
  term?: string;
  occupancyCap?: string;
  minorRepairs?: string;
  handoverPenalty?: string;
  maintenanceClause?: string;
  managementFees?: string;
  serviceCharges?: string;
  acService?: string;
  acServicePeriod?: string;
  additionalCharges?: string;
  subletting?: string;
  depositRefundTo?: string;
  terminationNotice?: string;
  lockInPeriod?: string;
  earlyTerminationPenalty?: string;
  renewalNotice?: string;
  legalFees?: string;
  stampDuty?: string;
  [k: string]: string | undefined;
}

export interface PartyInput {
  displayName: string;
  address?: string;
  kind: "individual" | "company";
}

export interface UnitInput {
  label: string;
  type: "office" | "apartment" | "storage" | "penthouse" | "floor";
  bedrooms?: number;
}

export interface LeaseShape {
  kind: LeaseKind;
  purpose: LeasePurpose;
  agreementLabel?: AgreementLabel;
  startDate: string;
  endDate: string;
  status: "draft";
  paymentCadence: PaymentCadence;
  defaultPaymentMethod: PaymentMethod;
  securityDeposit?: Money;
  stampDuty?: Money;
  legalFees?: Money;
  advanceMonths?: number;
  occupancyCap?: number;
  tranches: TrancheInput[];
  clauses: LeaseClauses;
}

export interface TrancheInput {
  sequence: number;
  startDate: string;
  endDate: string;
  monthlyRent: Money;
  paymentDescription?: string;
  advanceSetoff?: Money;
}

export interface SubLeaseIntake {
  /** BPO sub-tenant — the checklist doesn't usually name them, so we
   *  synthesise a "Sub-tenant — TBD" placeholder. */
  lessee: PartyInput;
  lease: LeaseShape;
}

export interface ChecklistIntake {
  property: { name: string; addressLine: string; city: string };
  units: UnitInput[];
  lessor: PartyInput;
  lessee: PartyInput;
  advisor?: PartyInput;
  counterpartyLawyer?: PartyInput;
  /** Capital Trust's lawyer. The importer creates a party with role
   *  `lessee_lawyer` (when Capital Trust is the lessee, i.e. head leases) or
   *  `lessor_lawyer` (when Capital Trust is the lessor, i.e. sub-leases),
   *  deduped against `counterpartyLawyer` by name. */
  ctpLawyer?: PartyInput;
  lease: LeaseShape;
  /** Present when the checklist contains a "Sub Tenancy" schedule block. */
  subLease?: SubLeaseIntake;
  rawFields: ChecklistFields;
  warnings: string[];
}

// ─────────────────────────────────────────────────────── helpers

const TODAY = new Date().toISOString().slice(0, 10);

function addYears(iso: string, years: number): string {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function dayOfMonth(iso: string): number {
  const day = Number(iso.slice(8, 10));
  return Number.isFinite(day) && day >= 1 && day <= 28 ? day : 1;
}

function trimOrUndefined(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  return t.length > 0 ? t : undefined;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};

export function parseDurationYears(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const yrs = raw.match(/(\d+)\s*year/i);
  if (yrs) return Number(yrs[1]);
  const months = raw.match(/(\d+)\s*month/i);
  if (months) return Math.max(1, Math.round(Number(months[1]) / 12));
  return undefined;
}

export function parseDurationMonths(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const m = raw.match(/(\d+)\s*[-]?\s*month/i);
  if (m) return Number(m[1]);
  const yrs = raw.match(/(\d+)\s*year/i);
  if (yrs) return Number(yrs[1]) * 12;
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b\\s*month`, "i").test(raw)) return n;
  }
  return undefined;
}

/** "Rs. 6,000,000/month" → { amount: 6_000_000, currency: "LKR" }. */
export function parseMoney(raw: string | undefined, fallback: Currency = "LKR"): Money | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.includes("n/a") || lower.startsWith("not ") || lower.includes("not mentioned") || lower.includes("not specified")) return undefined;
  const currency: Currency = /\busd\b|\bus\$|\$\s*\d/i.test(raw)
    ? "USD"
    : /\blkr\b|rs\.?|sri lankan/i.test(raw)
      ? "LKR"
      : fallback;
  // Skip leading non-digits, then grab the first numeric run with commas/dots.
  const match = raw.replace(/[^\d.,\s]/g, " ").match(/[\d][\d.,]*/);
  if (!match) return undefined;
  const numStr = match[0].replace(/,/g, "").replace(/\.$/, "");
  const num = Number(numStr);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return { amount: Math.round(num), currency };
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

/**
 * Money cells in the residential / sub-lease checklists routinely encode both
 * per-unit and total figures in one string:
 *
 *     "per unit - 5,250                Two Units- 10,500"
 *     "per Unit - USD 100"
 *     "per day USD 100 per unit"
 *
 * `parseMoney` takes the first numeric run and stops, so a 2-unit lease would
 * persist 5,250 instead of 10,500. This helper:
 *   1. Prefers an explicit "N units …" total when present (scales if the
 *      declared count doesn't match the actual unit count).
 *   2. Otherwise, when a "per unit" / "per apartment" pattern is present and
 *      the lease has multiple units, multiplies the per-unit amount by
 *      `unitCount`.
 *   3. Falls back to plain `parseMoney`.
 *
 * Currency is detected across the full cell (USD / LKR / Rs.). N/A and
 * "not mentioned" strings short-circuit to undefined like `parseMoney`.
 */
export function parseMoneyAcrossUnits(
  raw: string | undefined,
  unitCount: number,
  fallback: Currency = "LKR",
): Money | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  const lower = cleaned.toLowerCase();
  if (lower.includes("n/a") || lower.startsWith("not ") || lower.includes("not mentioned") || lower.includes("not specified")) return undefined;

  const currency: Currency = /\busd\b|\bus\$|\$\s*\d/i.test(cleaned)
    ? "USD"
    : /\blkr\b|rs\.?|sri lankan/i.test(cleaned)
      ? "LKR"
      : fallback;

  const safeUnitCount = Math.max(1, unitCount);

  // 1) Explicit "N units - <amount>" / "for 02 units 10,500" → total figure.
  //    Captures both digit ("2 units") and word ("Two Units") counts.
  const totalMatch = cleaned.match(
    /\b(?:for\s+)?(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+units?\b[\s-:]*([\d][\d,]*(?:\.\d+)?)/i,
  );
  if (totalMatch) {
    const declaredCount =
      Number(totalMatch[1]) || NUMBER_WORDS[totalMatch[1].toLowerCase()] || safeUnitCount;
    const total = Number(totalMatch[2].replace(/,/g, ""));
    if (Number.isFinite(total) && total > 0) {
      const scaled =
        declaredCount === safeUnitCount || safeUnitCount <= 1
          ? total
          : (total / declaredCount) * safeUnitCount;
      return { amount: Math.round(scaled), currency };
    }
  }

  // 2) "per unit"/"per apartment" pattern → multiply by unit count.
  //    Two orderings: "per unit - <amount>" and "<amount> ... per unit".
  //    First grabs the FIRST number after the anchor (so
  //    "per unit - 5,250 Two Units- 10,500" still yields 5,250 × count).
  const perUnitAfter = cleaned.match(
    /per\s+(?:unit|apartment|apt)\b[\s-:]*(?:[A-Za-z.]+\s+)?([\d][\d,]*(?:\.\d+)?)/i,
  );
  const perUnitBefore = cleaned.match(
    /([\d][\d,]*(?:\.\d+)?)[^\d]{0,40}per\s+(?:unit|apartment|apt)\b/i,
  );
  const perUnitRaw = perUnitAfter?.[1] ?? perUnitBefore?.[1];
  if (perUnitRaw) {
    const perUnit = Number(perUnitRaw.replace(/,/g, ""));
    if (Number.isFinite(perUnit) && perUnit > 0) {
      return { amount: Math.round(perUnit * safeUnitCount), currency };
    }
  }

  // 3) Default — same behaviour as `parseMoney`.
  return parseMoney(cleaned, fallback);
}

/**
 * Pull `{ startDate, endDate }` from a free-form term clause —
 * "10 years (26.03.2026 - 25.03.2036)", "1 Year (2026.02.28- 2027.02.27)".
 */
export function parseTerm(raw: string | undefined): { startDate: string; endDate: string } | undefined {
  if (!raw) return undefined;
  const match = raw.match(/(\d{1,4}[./-]\d{1,2}[./-]\d{1,4})\s*[-–to]+\s*(\d{1,4}[./-]\d{1,2}[./-]\d{1,4})/);
  if (!match) return undefined;
  const tryParse = (s: string) => {
    const t = s.trim().replace(/[/.\-]/g, ".");
    const parts = t.split(".").map((p) => p.trim()).filter(Boolean);
    if (parts.length !== 3) return undefined;
    let y, m, d;
    if (parts[0].length === 4) {
      [y, m, d] = parts.map(Number);
    } else if (parts[2].length === 4) {
      [d, m, y] = parts.map(Number);
    } else {
      return undefined;
    }
    if (!y || !m || !d || m > 12 || d > 31) return undefined;
    return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
  };
  const start = tryParse(match[1]);
  const end = tryParse(match[2]);
  if (!start || !end) return undefined;
  return { startDate: start, endDate: end };
}

export function parseCadence(raw: string | undefined): PaymentCadence {
  if (!raw) return "monthly";
  const s = raw.toLowerCase();
  if (s.includes("6") || s.includes("six") || s.includes("bi-annual") || s.includes("biannual") || s.includes("semi")) return "biannual";
  if (s.includes("3") || s.includes("three") || s.includes("quarter")) return "quarterly";
  return "monthly";
}

export function parseAdvanceMonths(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase().trim();
  // Money-shaped cells ("USD 5,250", "per unit - 5,250 Two Units- 10,500")
  // describe an amount, not a month count. Don't pretend "5250 months".
  if (/usd|lkr|rs\.?|\$|\bper\s+unit|per\s+apartment/i.test(s)) return undefined;
  if (s.includes("monthly") || s === "1") return 1;
  const m = s.match(/(\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (n > 0 && n <= 24) return n;
  }
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (s.includes(word)) return n;
  }
  return undefined;
}

export function parsePurpose(fields: ChecklistFields): LeasePurpose {
  const blob = `${fields.lesseeName ?? ""} ${fields.propertyName ?? ""} ${fields.unitNo ?? ""}`.toLowerCase();
  if (/\bbpo\b|tech city|capital bpo|\bmrl\b|colombo bpo/.test(blob)) return "bpo";
  const bedrooms = (fields.bedrooms ?? "").toLowerCase();
  const unitNo = (fields.unitNo ?? "").toLowerCase();
  const propertyName = (fields.propertyName ?? "").toLowerCase();
  if (/office|commercial|floor|penthouse|sq\s*ft|head\s*lease/.test(`${unitNo} ${bedrooms} ${propertyName}`)) return "commercial";
  const agreement = (fields.agreementLabel ?? "").toLowerCase();
  if (agreement.includes("rental") || /\d+\s*bedroom|apartment|unit/.test(`${bedrooms} ${unitNo}`)) return "residential";
  return "commercial";
}

export function parseAgreementLabel(raw: string | undefined): AgreementLabel | undefined {
  if (!raw) return undefined;
  // Use word-boundary matches so a bare "Rent" cell (firm's residential
  // sub-lease checklist) maps to rental_agreement, while "Indenture of
  // Lease" still wins for lease_agreement when both terms appear.
  const s = raw.toLowerCase();
  if (/\blease\b/.test(s)) return "lease_agreement";
  if (/\brent(?:al)?\b|\btenancy\b/.test(s)) return "rental_agreement";
  return "other";
}

export function parseResponsibleParty(raw: string | undefined): ResponsibleParty | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  if (s.includes("lessor") || s.includes("landlord")) return "lessor";
  if (s.includes("lessee") || s.includes("tenant")) return "lessee";
  if (s.includes("shared") || s.includes("both")) return "shared";
  return "other";
}

export function parseSublettingMode(raw: string | undefined): SublettingMode | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  if (s.startsWith("no ") || s === "nill" || s === "nil" || s.includes("no subletting") || s.includes("not permitted")) return "no";
  if (s.includes("group") || s.includes("affiliate")) return "to_group";
  if (s.includes("consent") || s.includes("permission")) return "with_consent";
  if (s.includes("yes") || s.includes("permitted")) return "yes";
  return undefined;
}

export function parseDepositRefundTo(raw: string | undefined): DepositRefundTo | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  if (s.includes("lessee") || s.includes("tenant")) return "lessee";
  if (s.includes("lessor") || s.includes("landlord")) return "lessor";
  return "other";
}

/** "US$317.75", "Rs. 317.75", "317.75 as 2026.04.27" → 317.75. */
export function parseFxRate(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  // Drop "as <date>" trailing notes etc; take the first numeric run.
  const m = raw.replace(/[^\d.,]/g, " ").match(/[\d][\d.,]*/);
  if (!m) return undefined;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Split a "Unit Nos." cell into one label per unit.
 * Examples:
 *   "X/3/L43/U4 & X/3/L44/U4"        → ["X/3/L43/U4", "X/3/L44/U4"]
 *   "Unit 2, Unit 3"                  → ["Unit 2", "Unit 3"]
 *   "A-1 / A-2 / A-3"                 → ["A-1", "A-2", "A-3"]
 *   "5"                               → ["5"]
 * Falls back to a single-element list when no separator is present.
 *
 * Note on `/`: only ` / ` with surrounding whitespace counts as a separator,
 * so multi-segment labels like `X/3/L43/U4` (firm convention) stay intact.
 */
export function splitUnitLabels(raw: string | undefined): string[] {
  if (!raw) return [];
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  return cleaned
    .split(/\s*(?:&|,|;|\s\+\s|\sand\s|\sor\s|\/\/|\|)\s*|\s+\/\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parsePartyKind(name: string): "individual" | "company" {
  if (/(pvt|private limited|\bltd\b|\bpv\b|\bplc\b|company|limited|holdings|residencies|properties|technologies)/i.test(name)) return "company";
  return "individual";
}

export function parseBedrooms(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  // Prefer an explicit "N bedroom(s)" pattern; fall back to the first integer
  // so "per unit - 3" still produces 3 (residential checklists routinely omit
  // the word "bedroom" because the column header already says it).
  const explicit = raw.match(/(\d+)\s*bedroom/i);
  if (explicit) return Number(explicit[1]);
  const any = raw.match(/(\d+)/);
  if (!any) return undefined;
  const n = Number(any[1]);
  return Number.isFinite(n) && n >= 0 && n <= 50 ? n : undefined;
}

export function parseUnitType(unitNo: string | undefined, bedrooms: number | undefined): UnitInput["type"] {
  const s = (unitNo ?? "").toLowerCase();
  if (s.includes("penthouse")) return "penthouse";
  if (s.includes("floor")) return "floor";
  if (s.includes("storage")) return "storage";
  if (bedrooms && bedrooms > 0) return "apartment";
  if (s.includes("office") || /sq\s*ft/.test(s)) return "office";
  return "apartment";
}

function inferCity(address: string | undefined): string {
  if (!address) return "Colombo";
  const match = address.match(/,\s*([A-Za-z][\w\s]+?)\s*$/);
  return (match?.[1] ?? "Colombo").trim();
}

/**
 * Split the LS-style multi-tranche metadata "Monthly Rental" cell:
 * "Rs. 6,000,000/month (26.03.2026-25.03.2028); Rs. 6,600,000/month (...); ..."
 * Returns one tranche per `;` segment. Each segment must contain both a money
 * value and a date range to be considered a tranche; otherwise it's dropped.
 */
function trancheSegmentsFromText(raw: string | undefined, currency: Currency): TrancheInput[] {
  if (!raw) return [];
  const segments = raw.split(/;+/).map((s) => s.trim()).filter(Boolean);
  const out: TrancheInput[] = [];
  let seq = 1;
  for (const seg of segments) {
    const money = parseMoney(seg, currency);
    const range = parseTerm(seg) ?? parseTermInsideParens(seg);
    if (!money || !range) continue;
    out.push({
      sequence: seq++,
      startDate: range.startDate,
      endDate: range.endDate,
      monthlyRent: money,
      paymentDescription: seg,
    });
  }
  return out;
}

function parseTermInsideParens(raw: string): { startDate: string; endDate: string } | undefined {
  const m = raw.match(/\(([^()]+)\)/);
  return m ? parseTerm(m[1]) : undefined;
}

function tranchesFromSchedule(schedule: ScheduleBlock): TrancheInput[] {
  const ranches: TrancheInput[] = [];
  schedule.tranches.forEach((t, idx) => {
    if (!t.monthlyRent) return;
    ranches.push({
      sequence: idx + 1,
      startDate: t.startDate,
      endDate: t.endDate,
      monthlyRent: t.monthlyRent,
      paymentDescription: t.paymentMethod,
    });
  });
  return ranches;
}

function scheduleCadenceToCadence(c: ScheduleBlock["cadence"]): PaymentCadence {
  if (c === "quarterly") return "quarterly";
  if (c === "biannual") return "biannual";
  return "monthly";
}

// ─────────────────────────────────────────────────────── public

export function buildChecklistIntake(extracted: ExtractedChecklist): ChecklistIntake {
  const fields = extracted.fields as ChecklistFields;
  const warnings: string[] = [];

  const purpose = parsePurpose(fields);
  const term = parseTerm(fields.term);
  const fallbackCurrency: Currency = purpose === "bpo" ? "USD" : "LKR";

  // ── Pick schedules ────────────────────────────────────────
  // Standalone sub-tenancy files (residential sub-lease checklists) have
  // ONE schedule labelled "SUB-TENANCY AGREEMENT" — and no master. The old
  // logic picked nothing in that case and fell through to the metadata
  // "Monthly Rental" cell, which is just a per-unit hint with no currency
  // marker → 1,750 LKR. Treat a lone schedule as the master regardless of
  // its section label.
  const allSchedules = extracted.schedules;
  const masterSchedule =
    allSchedules.find((s) => s.kind === "master") ??
    allSchedules.find((s) => s.kind === "unknown") ??
    (allSchedules.length === 1 ? allSchedules[0] : undefined);
  // A paired sub-lease only makes sense when there's BOTH a master schedule
  // and a separate sub-tenancy schedule (the Lucky Seven pattern). When the
  // sole schedule IS the sub-tenancy, it's the lease itself — no pair.
  const subSchedule =
    masterSchedule && masterSchedule.kind !== "sub"
      ? allSchedules.find((s) => s.kind === "sub")
      : undefined;

  // ── Master tranches ───────────────────────────────────────
  let tranches: TrancheInput[] = [];
  let masterCurrency: Currency = fallbackCurrency;

  if (masterSchedule) {
    tranches = tranchesFromSchedule(masterSchedule);
    masterCurrency = tranches[0]?.monthlyRent.currency ?? masterSchedule.tranches[0]?.monthlyRent?.currency ?? fallbackCurrency;
  }

  if (tranches.length === 0) {
    // Fallback A: split the LS-style multi-tranche metadata cell.
    tranches = trancheSegmentsFromText(fields.monthlyRent, fallbackCurrency);
    if (tranches.length > 0) {
      masterCurrency = tranches[0].monthlyRent.currency;
      warnings.push("Tranches derived from metadata 'Monthly Rental' text (no schedule table found).");
    }
  }

  if (tranches.length === 0) {
    // Fallback B: single tranche from the metadata monthly rent + term.
    const single = parseMoney(fields.monthlyRent, fallbackCurrency);
    const startDate = term?.startDate ?? TODAY;
    const endDate = term?.endDate ?? addYears(startDate, parseDurationYears(fields.term) ?? 1);
    tranches = [
      {
        sequence: 1,
        startDate,
        endDate,
        monthlyRent: single ?? ({ amount: 0, currency: fallbackCurrency } as Money),
      },
    ];
    masterCurrency = (single?.currency ?? fallbackCurrency);
    if (!single) warnings.push("Monthly rent couldn't be parsed — set to 0; edit before activation.");
  }

  const startDate = tranches[0].startDate;
  const endDate = tranches[tranches.length - 1].endDate;

  const cadence: PaymentCadence = masterSchedule
    ? scheduleCadenceToCadence(masterSchedule.cadence)
    : parseCadence(fields.advancePayment);

  // ── Property + units ──────────────────────────────────────
  const propertyName = trimOrUndefined(fields.propertyName) ?? trimOrUndefined(fields.premisesAddress)?.split(",")[0] ?? "Untitled property";
  const premisesAddress = fields.premisesAddress ?? propertyName;
  const city = inferCity(premisesAddress);
  const bedrooms = parseBedrooms(fields.bedrooms);
  const unitType = parseUnitType(fields.unitNo, bedrooms);
  const unitLabels = splitUnitLabels(fields.unitNo);
  const units: UnitInput[] =
    unitLabels.length > 0
      ? unitLabels.map((label) => ({ label, type: unitType, bedrooms }))
      : [{ label: "Unit 1", type: unitType, bedrooms }];

  // ── Parties ───────────────────────────────────────────────
  const lessorName = trimOrUndefined(fields.lessorName) ?? "Unknown lessor";
  const lesseeName = trimOrUndefined(fields.lesseeName) ?? "Unknown lessee";
  if (!fields.lessorName) warnings.push("Lessor name missing — placeholder used.");
  if (!fields.lesseeName) warnings.push("Lessee name missing — placeholder used.");

  // ── Master lease ──────────────────────────────────────────
  const masterMonthly = tranches[0].monthlyRent;

  const unitCount = Math.max(1, units.length);
  const legalFeesMoney = parseMoney(fields.legalFees, "LKR");
  const stampDutyMoney = parseMoney(fields.stampDuty, "LKR");
  // Threshold / penalty rates stay PER UNIT. Multiplying them produces a
  // confusing number (e.g., "USD 200 / day" for a 2-unit lease whose
  // contract reads "USD 100 per day per unit") — the display layer appends
  // a "per unit" qualifier when the lease has > 1 unit.
  const minorRepairsMoney = parseMoney(fields.minorRepairs, masterCurrency);
  const handoverPenaltyMoney = parseMoney(fields.handoverPenalty, masterCurrency);
  // Deposit + advance ARE collected as a single total, so the multi-unit
  // total ("Two Units- 10,500") is the right figure to store.
  const depositMoney = parseMoneyAcrossUnits(fields.deposit, unitCount, masterCurrency);
  // Some checklists encode advance payment as money (e.g. residential sub-
  // leases), others as a month count (e.g. Lucky Seven). parseAdvanceMonths
  // rejects money-shaped cells, so the money branch is captured separately
  // in clauses for the UI to surface.
  const advanceMoney = parseMoneyAcrossUnits(fields.advancePayment, unitCount, masterCurrency);

  // When the only schedule is sub-tenancy (residential sub-lease checklist),
  // the lease itself is a sub-lease — Capital Trust as sub-lessor to an
  // individual tenant. Tagging it correctly also fixes the CTP Lawyer
  // role assignment in the importer (lessor_lawyer vs lessee_lawyer).
  const leaseKind: LeaseKind = masterSchedule?.kind === "sub" ? "sub" : "head";

  const lease: LeaseShape = {
    kind: leaseKind,
    purpose,
    agreementLabel: parseAgreementLabel(fields.agreementLabel),
    startDate,
    endDate,
    status: "draft",
    paymentCadence: cadence,
    defaultPaymentMethod: masterMonthly.currency === "USD" ? "usd_transfer" : "bank_draft",
    securityDeposit: depositMoney,
    stampDuty: stampDutyMoney,
    legalFees: legalFeesMoney,
    advanceMonths: parseAdvanceMonths(fields.advancePayment),
    occupancyCap: (() => {
      const m = fields.occupancyCap?.match(/(\d+)/);
      return m ? Number(m[1]) : undefined;
    })(),
    tranches,
    clauses: {
      managementFeesBy: parseResponsibleParty(fields.managementFees),
      managementFeesNote: trimOrUndefined(fields.managementFees),
      serviceChargesBy: parseResponsibleParty(fields.serviceCharges),
      serviceChargesNote: trimOrUndefined(fields.serviceCharges),
      acServiceBy: parseResponsibleParty(fields.acService),
      acServiceNote: trimOrUndefined(fields.acService),
      acServicePeriod: trimOrUndefined(fields.acServicePeriod),
      minorRepairsThreshold: minorRepairsMoney,
      maintenanceText: trimOrUndefined(fields.maintenanceClause),
      handoverDelayPenalty: handoverPenaltyMoney,
      earlyTerminationPenalty: trimOrUndefined(fields.earlyTerminationPenalty),
      terminationNoticeMonths: parseDurationMonths(fields.terminationNotice),
      renewalNoticeMonths: parseDurationMonths(fields.renewalNotice),
      sublettingAllowed: parseSublettingMode(fields.subletting),
      sublettingNote: trimOrUndefined(fields.subletting),
      depositRefundTo: parseDepositRefundTo(fields.depositRefundTo),
      // Free-text fallback when the money columns don't parse cleanly.
      legalFeesNote: legalFeesMoney ? undefined : trimOrUndefined(fields.legalFees),
      stampDutyNote: stampDutyMoney ? undefined : trimOrUndefined(fields.stampDuty),
      // Checklist additions (residential sub-lease + LS head)
      advancePaymentAmount: advanceMoney,
      lockInPeriodText: trimOrUndefined(fields.lockInPeriod),
      additionalCharges: trimOrUndefined(fields.additionalCharges),
      lesseeEmployer: trimOrUndefined(fields.lesseeEmployer),
      taxApplicabilityBy: parseResponsibleParty(fields.taxApplicability),
      taxApplicabilityNote: trimOrUndefined(fields.taxApplicability),
      fxBasis: trimOrUndefined(fields.fxBasis),
      firstFxRate: parseFxRate(fields.firstFxRate),
      firstFxRateNote: trimOrUndefined(fields.firstFxRate),
      ctpLawyerName: trimOrUndefined(fields.ctpLawyer),
    },
  };

  // ── Sub-tenancy (if present) ──────────────────────────────
  let subLease: SubLeaseIntake | undefined;
  if (subSchedule && subSchedule.tranches.length > 0) {
    const subTranches = tranchesFromSchedule(subSchedule);
    if (subTranches.length > 0) {
      const subMonthly = subTranches[0].monthlyRent;
      subLease = {
        lessee: {
          displayName: `Sub-tenant — TBD (${lesseeName})`,
          kind: "company",
        },
        lease: {
          kind: "sub",
          purpose: "bpo",
          startDate: subTranches[0].startDate,
          endDate: subTranches[subTranches.length - 1].endDate,
          status: "draft",
          paymentCadence: scheduleCadenceToCadence(subSchedule.cadence),
          defaultPaymentMethod: subMonthly.currency === "USD" ? "usd_transfer" : "lkr_transfer",
          tranches: subTranches,
          clauses: {},
        },
      };
      warnings.push("Sub-tenancy schedule detected — paired sub-lease created with placeholder lessee; edit before activation.");
    }
  }

  if (extracted.schedules.length === 0) {
    warnings.push("No schedule table detected — used metadata fields only.");
  }

  return {
    property: { name: propertyName, addressLine: premisesAddress, city },
    units,
    lessor: { displayName: lessorName, address: fields.lessorAddress, kind: parsePartyKind(lessorName) },
    lessee: { displayName: lesseeName, address: fields.lesseeAddress, kind: parsePartyKind(lesseeName) },
    advisor: fields.advisorName ? { displayName: fields.advisorName, kind: parsePartyKind(fields.advisorName) } : undefined,
    counterpartyLawyer: fields.counterpartyLawyer ? { displayName: fields.counterpartyLawyer, kind: parsePartyKind(fields.counterpartyLawyer) } : undefined,
    ctpLawyer: fields.ctpLawyer ? { displayName: fields.ctpLawyer, kind: parsePartyKind(fields.ctpLawyer) } : undefined,
    lease,
    subLease,
    rawFields: fields,
    warnings,
  };
}

// Re-export from parse for callers that want types alongside the builder.
export type { ScheduleBlock, ScheduleTranche, ExtractedChecklist } from "./parse";

// Convenience for tests / inspection.
export function dayOfMonthOf(iso: string): number {
  return dayOfMonth(iso);
}
