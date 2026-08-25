/**
 * Fills the firm's tagged `.docx` templates with lease data and produces a
 * downloadable Word file.
 *
 * Templates live in `public/lease-templates/{residential,commercial}.docx`.
 * Each `{tag}` was inserted by `scripts/tag-lease-templates.py`; the rent
 * schedule is one `{@rentScheduleXml}` placeholder that we fill with
 * generated WordprocessingML paragraphs (one per tranche). Both the renderer
 * and the download helper run client-side.
 */

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import type { LeaseDocSettings } from "@/lib/demo/types";

import { leaseDocModel } from "./lease-document-blocks";
import type { DocumentParty, LeaseDocumentData } from "./lease-document-data";

const TEMPLATE_URLS: Record<"residential" | "commercial", string> = {
  residential: "/lease-templates/residential.docx",
  commercial: "/lease-templates/commercial.docx",
};

const BLANK = "________________";
const WNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function fmtMoney(m: { amount: number; currency: string } | undefined): string {
  if (!m) return BLANK;
  const n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(m.amount);
  if (m.currency === "LKR") return `Rs. ${n}/-`;
  if (m.currency === "USD") return `USD ${n}/-`;
  return `${m.currency} ${n}/-`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return BLANK;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "2-digit" });
}

function monthsBetween(a: string, b: string): number {
  const x = new Date(a);
  const y = new Date(b);
  if (Number.isNaN(x.getTime()) || Number.isNaN(y.getTime())) return 0;
  return (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth()) + 1;
}

function scale(m: { amount: number; currency: string } | undefined, factor: number) {
  return m ? { amount: m.amount * factor, currency: m.currency } : undefined;
}

function nameOf(p: DocumentParty): string {
  return p.legalName?.trim() || p.displayName?.trim() || BLANK;
}

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wmlPara(text: string): string {
  return `<w:p ${WNS}><w:r><w:t xml:space="preserve">${escXml(text)}</w:t></w:r></w:p>`;
}

/** Generates the WordprocessingML `<w:p>` paragraphs that replace the
 * `{@rentScheduleXml}` placeholder. Sentence shape mirrors the firm's
 * residential / commercial templates respectively. */
function rentScheduleXml(data: LeaseDocumentData): string {
  const isResidential = data.purpose === "residential";
  const unitCount = Math.max(1, data.units.length);
  const paras: string[] = [];

  if (isResidential) {
    data.tranches.forEach((t, idx) => {
      const months = monthsBetween(t.startDate, t.endDate);
      const perUnit = { amount: t.monthlyRent.amount * months, currency: t.monthlyRent.currency };
      const allUnits = scale(perUnit, unitCount);
      const when = idx === 0
        ? "on or before the execution of these Presents"
        : `on or before the ${fmtDate(t.startDate)}`;
      paras.push(
        wmlPara(
          `For the period commencing from ${fmtDate(t.startDate)} to ${fmtDate(t.endDate)} a total rental of ${fmtMoney(perUnit)} per Apartment Unit (calculated at the rate of ${fmtMoney(t.monthlyRent)} per month per Apartment Unit), equivalent to ${months} months' rental per Apartment Unit${unitCount > 1 ? ` amounting to a sum of ${fmtMoney(allUnits)}` : ""} shall be paid ${when};`,
        ),
      );
    });
    return paras.join("");
  }

  // commercial
  for (const t of data.tranches) {
    paras.push(
      wmlPara(
        `${fmtMoney(t.monthlyRent)} per mensem for the period commencing from the ${fmtDate(t.startDate)} and ending on the ${fmtDate(t.endDate)}.`,
      ),
    );
  }
  if (data.tranches.length > 0) {
    const currency = data.tranches[0].monthlyRent.currency;
    let total = 0;
    for (const t of data.tranches) total += t.monthlyRent.amount * monthsBetween(t.startDate, t.endDate);
    const years = Math.max(1, Math.round(monthsBetween(data.startDate, data.endDate) / 12));
    paras.push(
      wmlPara(
        `Aggregating to ${fmtMoney({ amount: total, currency })} for the full period of ${years} Years and payable in the manner following;`,
      ),
    );
  }
  const adv = data.tranches[0]?.advanceSetoff;
  if (data.advanceMonths && adv) {
    const dueDay = data.tranches[0]?.dueDayOfMonth ?? 26;
    const advTotal = { amount: data.advanceMonths * adv.amount, currency: adv.currency };
    paras.push(
      wmlPara(
        `${fmtMoney(advTotal)} as rent in advance at or before the execution of these presents which shall be set off in ${data.advanceMonths} monthly installments of ${fmtMoney(adv)} each from and against the rent payable over the said term; and the balance rent payable in monthly installments on or before the ${dueDay}${ordinal(dueDay)} day of each and every month.`,
      ),
    );
  }
  return paras.join("");
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function termPhrase(start: string, end: string): string {
  return `${fmtDate(start)} and ending on the ${fmtDate(end)}`;
}

/** Total lease consideration = Σ (tranche monthly rent × months in tranche).
 * For multi-unit leases the tranche.monthlyRent already reflects the full
 * lease total (we pick the "For N units" sub-column). The figure feeds the
 * title-block "Consideration: Rs. _____" line + the in-body stamp duty
 * calculation sentence. Falls back to `undefined` when the currencies in
 * the tranches don't agree (extremely rare). */
function totalConsideration(data: LeaseDocumentData): { amount: number; currency: string } | undefined {
  if (data.tranches.length === 0) return undefined;
  const currency = data.tranches[0].monthlyRent.currency;
  if (!data.tranches.every((t) => t.monthlyRent.currency === currency)) return undefined;
  let total = 0;
  for (const t of data.tranches) total += t.monthlyRent.amount * monthsBetween(t.startDate, t.endDate);
  return { amount: total, currency };
}

/** Map a `LeaseDocumentData` to the docxtemplater data dict the tagged
 * templates expect. Missing fields render as a fill-in blank. */
export function buildDataDict(data: LeaseDocumentData): Record<string, string> {
  const isResidential = data.purpose === "residential";
  const unitCount = Math.max(1, data.units.length);
  const consideration = totalConsideration(data);

  const common: Record<string, string> = {
    lessorName: nameOf(data.lessor),
    lessorReg: data.lessor.idNumber || BLANK,
    lessorAddress: data.lessor.address || BLANK,
    lesseeName: nameOf(data.lessee),
    lesseeReg: data.lessee.idNumber || BLANK,
    lesseeAddress: data.lessee.address || BLANK,
    term: termPhrase(data.startDate, data.endDate),
    deposit: fmtMoney(data.securityDeposit),
    rentScheduleXml: rentScheduleXml(data),
    // Title-block placeholders (injected by the python tagger):
    //   "Consideration: Rs. {stampDutyConsideration}"
    //   "Stamp Duty:    Rs. {stampDuty}"
    stampDutyConsideration: fmtMoney(consideration),
    stampDuty: fmtMoney(data.stampDuty),
  };

  if (isResidential) {
    const u0 = data.units[0];
    const u1 = data.units[1];
    return {
      ...common,
      building: data.property.name || BLANK,
      depositTotal: fmtMoney(scale(data.securityDeposit, unitCount)),
      fxBasis: data.clauses?.fxBasis || "mid-rate",
      occupancy: data.occupancyCap != null ? String(data.occupancyCap) : BLANK,
      minorRepairs: fmtMoney(data.clauses?.minorRepairsThreshold),
      handover: fmtMoney(data.clauses?.handoverDelayPenalty),
      cleaningFee: data.clauses?.maintenanceText || BLANK,
      assessment1: u0 ? `${u0.label} — ${data.property.addressLine}` : BLANK,
      assessment2: u1 ? `${u1.label} — ${data.property.addressLine}` : BLANK,
      parcel1: u0?.label || BLANK,
      parcel2: u1?.label || BLANK,
    };
  }

  // commercial
  return {
    ...common,
    assessmentNo: data.property.addressLine || BLANK,
    floors: data.units.map((u) => u.label).join(", ") || BLANK,
    extent: data.property.perches ? `${data.property.perches} perches` : BLANK,
  };
}

/** Fetch the tagged template, fill it, return the rendered `.docx` as bytes. */
export async function renderLeaseFromTemplate(
  data: LeaseDocumentData,
): Promise<Uint8Array> {
  const purpose: "residential" | "commercial" = data.purpose === "residential" ? "residential" : "commercial";
  const res = await fetch(TEMPLATE_URLS[purpose]);
  if (!res.ok) throw new Error(`Lease template ${purpose} not found (HTTP ${res.status}).`);
  const buf = await res.arrayBuffer();
  const zip = new PizZip(buf);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(buildDataDict(data));
  return doc.getZip().generate({ type: "uint8array" }) as Uint8Array;
}

/** Build the agreement `.docx` from the tagged template and trigger a download. */
export async function downloadLeaseAgreement(
  data: LeaseDocumentData,
  settings?: LeaseDocSettings,
): Promise<void> {
  const bytes = await renderLeaseFromTemplate(data);
  const blob = new Blob([bytes as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const model = leaseDocModel(data, settings);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${model.fileBaseName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
