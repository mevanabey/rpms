import type { ChecklistMapping, ChecklistSource } from "@/core/checklists";
import { parseTerm, type ChecklistIntake } from "./build-lease";
import type { ExtractedChecklist } from "./parse";

const DESTINATIONS: Record<string, string[]> = {
  premisesAddress: ["property.addressLine", "property.city"], propertyName: ["property.name"],
  unitNo: ["units[].label", "units[].type"], bedrooms: ["units[].bedrooms"], areaSqft: ["units[].areaSqft"],
  lessorName: ["lessor.displayName", "lessor.kind"], lessorAddress: ["lessor.address"],
  lesseeName: ["lessee.displayName", "lessee.kind"], lesseeAddress: ["lessee.address"],
  advisorName: ["advisor.displayName"], ctpLawyer: ["ctpLawyer.displayName", "lease.clauses.ctpLawyerName"],
  counterpartyLawyer: ["counterpartyLawyer.displayName"], agreementLabel: ["lease.agreementLabel"],
  monthlyRent: ["lease.tranches[].monthlyRent"], term: ["lease.startDate", "lease.endDate"],
  advancePayment: ["lease.advanceMonths", "lease.clauses.advancePaymentAmount"], deposit: ["lease.securityDeposit"],
  occupancyCap: ["lease.occupancyCap"], minorRepairs: ["lease.clauses.minorRepairsThreshold"],
  handoverPenalty: ["lease.clauses.handoverDelayPenalty"], maintenanceClause: ["lease.clauses.maintenanceText"],
  managementFees: ["lease.clauses.managementFeesBy", "lease.clauses.managementFeesNote"],
  serviceCharges: ["lease.clauses.serviceChargesBy", "lease.clauses.serviceChargesNote"],
  acService: ["lease.clauses.acServiceBy", "lease.clauses.acServiceNote"], acServicePeriod: ["lease.clauses.acServicePeriod"],
  serviceScope: ["lease.clauses.serviceScope"], additionalCharges: ["lease.clauses.additionalCharges"],
  subletting: ["lease.clauses.sublettingAllowed", "lease.clauses.sublettingNote"],
  depositRefundTo: ["lease.clauses.depositRefundTo"], terminationNotice: ["lease.clauses.terminationNoticeMonths"],
  lockInPeriod: ["lease.lockInEndDate", "lease.clauses.lockInPeriodText"],
  earlyTerminationPenalty: ["lease.clauses.earlyTerminationPenalty"], renewalNotice: ["lease.clauses.renewalNoticeMonths"],
  legalFees: ["lease.legalFees", "lease.clauses.legalFeesNote"], stampDuty: ["lease.stampDuty", "lease.clauses.stampDutyNote"],
  taxApplicability: ["lease.clauses.taxApplicabilityBy", "lease.clauses.taxApplicabilityNote"],
  fxBasis: ["lease.clauses.fxBasis"], firstFxRate: ["lease.clauses.firstFxRate", "lease.clauses.firstFxRateNote"],
  lesseeEmployer: ["lease.clauses.lesseeEmployer"],
};

function valuesAt(value: unknown, path: string[]): unknown[] {
  if (path.length === 0) return value === undefined || value === null || value === "" ? [] : [value];
  if (!value || typeof value !== "object") return [];
  const [head, ...tail] = path;
  const array = head.endsWith("[]");
  const key = array ? head.slice(0, -2) : head;
  const next = (value as Record<string, unknown>)[key];
  return array && Array.isArray(next) ? next.flatMap((item) => valuesAt(item, tail)) : valuesAt(next, tail);
}

/** Mapping evidence is saved alongside the source, so later edits never
 * rewrite the checklist or pretend to change the original import outcome. */
export function buildChecklistMappings(source: ChecklistSource, extracted: ExtractedChecklist, intake: ChecklistIntake): ChecklistMapping[] {
  const masterSchedule = extracted.schedules.find((s) => s.kind === "master") ?? extracted.schedules.find((s) => s.kind === "unknown") ?? (extracted.schedules.length === 1 ? extracted.schedules[0] : undefined);
  const subSchedule = masterSchedule && masterSchedule.kind !== "sub" ? extracted.schedules.find((s) => s.kind === "sub") : undefined;
  const scheduleUsed = Boolean(masterSchedule?.tranches.some((t) => t.monthlyRent));
  const datesFromRentText = intake.warnings.some((warning) => warning.startsWith("Tranches derived from metadata"));
  return source.sheets.flatMap((sheet, sheetIndex) => sheet.rows.map((row, rowIndex): ChecklistMapping => {
    const base = { sheet: sheetIndex, row: rowIndex, targets: [] };
    if (!row.some((cell) => cell.trim())) return { ...base, status: "blank", explanation: "Blank source row preserved." };
    if (sheetIndex !== source.importSheetIndex) return { ...base, status: "unmapped", explanation: "This sheet was preserved but was not selected for importing lease fields." };
    const field = extracted.fieldRows?.find((item) => item.row === rowIndex);
    if (field) {
      if (!field.hasValue) return { ...base, status: "unmapped", explanation: "Recognised label, but its source value is blank. No value was imported from this row." };
      if (!field.used) return { ...base, status: "duplicate", explanation: "Duplicate field. The first non-empty occurrence was used; this row was preserved only." };
      if (scheduleUsed && ["monthlyRent", "term"].includes(field.key)) return { ...base, status: "unmapped", explanation: "The payment schedule supplied the dates and monthly amounts instead of this summary row." };
      if (field.key === "term" && datesFromRentText) return { ...base, status: "unmapped", explanation: "Dates were taken from the periods embedded in the Monthly Rental text instead of this row." };
      if (field.key === "monthlyRent" && intake.warnings.some((warning) => warning.startsWith("Monthly rent couldn't"))) return { ...base, status: "unmapped", explanation: "The amount could not be parsed. A zero placeholder was created, not an amount imported from this row." };
      const targets = (DESTINATIONS[field.key] ?? []).flatMap((path) => {
        const values = valuesAt(intake, path.split("."));
        return values.length ? [{ field: path, value: values.map((value) => typeof value === "string" ? value : JSON.stringify(value)).join("; ") }] : [];
      });
      if (field.key === "term" && !parseTerm(extracted.fields.term)) return { ...base, targets, status: "partial", explanation: "No explicit date range was parsed. The import used its fallback start date and a duration/default term; these dates were not copied directly from this row." };
      return { ...base, targets, status: targets.length ? "mapped" : "unmapped", explanation: targets.length
        ? "Parsed into these import fields. Shared property, unit and contact records may be matched and reused rather than overwritten. Values below are the parsed import values, not live edits."
        : "Recognised label, but no usable value was parsed into a lease field. The original cell is preserved here." };
    }
    const schedule = extracted.schedules.find((s) => s.sourceStartRow !== undefined && rowIndex >= s.sourceStartRow && rowIndex < (s.sourceEndRow ?? 0));
    if (schedule) {
      const tranche = schedule.tranches.find((t) => t.sourceRow === rowIndex);
      if (!tranche) return rowIndex < (schedule.sourceDataStartRow ?? schedule.tranches[0]?.sourceRow ?? 0)
        ? { ...base, status: "heading", explanation: "Payment schedule header or currency row; used to interpret the schedule." }
        : { ...base, status: "unmapped", explanation: "No payment period was recognised in this schedule row. Its original contents are preserved only." };
      const findTranche = (tranches: ChecklistIntake["lease"]["tranches"]) => tranches.findIndex((t) => t.startDate === tranche.startDate && t.endDate === tranche.endDate && t.monthlyRent.amount === tranche.monthlyRent?.amount && t.monthlyRent.currency === tranche.monthlyRent?.currency);
      const masterIndex = schedule === masterSchedule ? findTranche(intake.lease.tranches) : -1;
      const subIndex = schedule === subSchedule && intake.subLease ? findTranche(intake.subLease.lease.tranches) : -1;
      const prefix = masterIndex >= 0 ? `lease.tranches[${masterIndex}]` : subIndex >= 0 ? `pairedLease.tranches[${subIndex}]` : null;
      if (!prefix) return { ...base, status: "unmapped", explanation: "This schedule row did not produce a payment tranche (missing monthly amount or unused schedule)." };
      const targets = [
        { field: `${prefix}.startDate`, value: tranche.startDate },
        { field: `${prefix}.endDate`, value: tranche.endDate },
        { field: `${prefix}.monthlyRent`, value: JSON.stringify(tranche.monthlyRent) },
        ...(tranche.paymentMethod ? [{ field: `${prefix}.paymentDescription`, value: tranche.paymentMethod }] : []),
      ];
      const unused = schedule.columns.filter((col) => row[col.index]?.trim() && (!col.selected || !["period", "monthlyRent", "paymentMethod"].includes(col.role)));
      return { ...base, targets, status: unused.length ? "partial" : "mapped", explanation: unused.length
        ? `Dates, monthly amount and payment description were used. Preserved only: ${unused.map((col) => col.header || `column ${col.index + 1}`).join(", ")}. Totals and deposits in the schedule are not imported as separate payments.`
        : "Used for the payment tranche dates, monthly amount and payment description. These are import values, not live edits." };
    }
    return { ...base, status: "unmapped", explanation: "No lease field matched this row. Its original contents are preserved." };
  }));
}
