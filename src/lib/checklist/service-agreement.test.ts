import assert from "node:assert/strict";
import test from "node:test";
import PizZip from "pizzip";

import { agreementFieldLabel, agreementPartyLabels } from "@/lib/agreements";
import { agreementPeriodMonths } from "@/lib/agreement-periods";
import { mockBackend } from "@/server/adapters/mock";
import { parseAgreementLabel, leaseClausesPatchSchema } from "@/server/validation/lease-clauses";
import { fromDraftIntent, fromLease } from "@/templates/leases/lease-document-data";
import { leaseDocModel } from "@/templates/leases/lease-document-blocks";
import { renderLeaseFromTemplate } from "@/templates/leases/lease-template-render";
import { buildLeaseEmail } from "@/templates/emails/lease-onboarding";
import { buildChecklistIntake } from "./build-lease";
import { buildLeaseChecklistWorkbook } from "./export";
import { importChecklistToBackend } from "./import";
import { extractChecklist, parseXlsx, type Grid } from "./parse";

// Synthetic counterparties with the headings and date/payment layout of the
// service checklist. No private customer workbook is required to run tests.
const grid: Grid = [
  ["Premises address", "10 Example Road, Colombo 03"],
  ["Lease/Rent Agreement", "Service Agreement"],
  ["Service Provider's Name & ID or Company No.", "Example Provider (Private) Limited"],
  ["Service Provider's Address", "20 Provider Road"],
  ["Client's Name & ID No. Or Company No.", "Example Client (Private) Limited"],
  ["Client's Adress", "30 Client Road"],
  ["Premises/Building name", "Example Tower"],
  ["Unit No.", "Third (3rd) Floor"],
  ["Scope of services", "Office facilities and maintenance"],
  ["Monthly Rental (LKR)", "2160000"],
  ["Advance payment", "1 month"],
  ["Refundable deposit amount (LKR)", "4320000"],
  ["Square area", "3,200 SqFt"],
  ["Term", "One (01) Year (02.02.2026 - 01.02.2027)"],
  ["Minor repairs", "Client is responsible for repairs not exceeding LKR 25,000.00 at any one time"],
  ["Mangement fees paid by", "Service Provider"],
  ["Service charges paid by", "Service Provider"],
  ["Refundable deposit to be credited to", "Service Provider"],
  ["Locking period", "06 months (02.02.2026 - 01.08.2026)"],
  ["Prior notice of termination", "03 months' written notice by either party"],
  ["Notice of renewal", "03 months' written notice"],
  ["Legal fees - 1%", "N/A"],
  ["Stamp duty - 2%", "N/A"],
  ["Period", "Monthly Rent", "One Months' Rent", "Payment method"],
  ["", "LKR", "LKR", ""],
  ...Array.from({ length: 12 }, (_, i) => {
    const startMonth = (i + 1) % 12 + 1;
    const endMonth = (i + 2) % 12 + 1;
    const startYear = i === 11 ? 2027 : 2026;
    const endYear = i >= 10 ? 2027 : 2026;
    return [`02.${String(startMonth).padStart(2, "0")}.${startYear} - 01.${String(endMonth).padStart(2, "0")}.${endYear}`, "2160000", "2160000", "Every one month"];
  }),
];

test("service checklist recognises both parties and retains payment and clause data", () => {
  const intake = buildChecklistIntake(extractChecklist(grid));
  assert.equal(intake.lease.agreementLabel, "service_agreement");
  assert.equal(intake.lessor.displayName, "Example Provider (Private) Limited");
  assert.equal(intake.lessee.address, "30 Client Road");
  assert.equal(intake.lease.startDate, "2026-02-02");
  assert.equal(intake.lease.endDate, "2027-02-01");
  assert.equal(intake.lease.lockInEndDate, "2026-08-01");
  assert.equal(intake.lease.tranches.length, 12);
  assert.ok(intake.lease.tranches.every((t) => t.monthlyRent.amount === 2160000));
  assert.equal(intake.lease.securityDeposit?.amount, 4320000);
  assert.equal(intake.lease.advanceMonths, 1);
  assert.equal(intake.lease.clauses.advancePaymentAmount, undefined, "one month must not become one rupee");
  assert.equal(intake.units[0].areaSqft, 3200);
  assert.equal(intake.property.name, "Example Tower");
  assert.equal(intake.lease.clauses.managementFeesBy, "lessor");
  assert.equal(intake.lease.clauses.depositRefundTo, "lessor");
  assert.equal(intake.lease.clauses.minorRepairsThreshold?.amount, 25000);
  assert.equal(intake.lease.clauses.terminationNoticeMonths, 3);
  assert.equal(intake.lease.clauses.renewalNoticeMonths, 3);
  assert.equal(intake.lease.tranches.reduce((sum, t) => sum + t.monthlyRent.amount * agreementPeriodMonths(t.startDate, t.endDate), 0), 25920000);
  assert.equal(intake.lease.stampDuty, undefined);
  assert.equal(intake.lease.clauses.stampDutyNote, "N/A");
  assert.deepEqual(intake.warnings, []);
});

test("inclusive billing periods do not count a partial calendar month twice", () => {
  assert.equal(agreementPeriodMonths("2026-02-02", "2026-03-01"), 1);
  assert.equal(agreementPeriodMonths("2026-02-02", "2027-02-01"), 12);
  assert.equal(agreementPeriodMonths("2026-01-01", "2026-12-31"), 12);
  assert.equal(agreementPeriodMonths("2026-01-31", "2026-02-28"), 1);
  assert.equal(agreementPeriodMonths("2026-04-09", "2036-04-08"), 120);
  assert.equal(agreementPeriodMonths("2026-03-01", "2026-02-01"), 0);
  assert.equal(agreementPeriodMonths("", ""), 0);
});

test("service type validates and labels adapt without changing legacy labels", () => {
  assert.equal(parseAgreementLabel("service_agreement"), "service_agreement");
  assert.equal(parseAgreementLabel("unknown"), undefined);
  assert.deepEqual(agreementPartyLabels("service_agreement"), { lessor: "Service Provider", lessee: "Client" });
  assert.equal(agreementFieldLabel("service_agreement", "Refunded to Tenant"), "Refunded to Client");
  assert.equal(agreementFieldLabel("lease_agreement", "Lessor's Address"), "Lessor's Address");
  assert.deepEqual(leaseClausesPatchSchema.parse({ serviceScope: null }), { serviceScope: null });
  const legacy = buildChecklistIntake(extractChecklist(grid.map((r) => r[0] === "Lease/Rent Agreement" ? [r[0], "Lease Agreement"] : r)));
  assert.equal(legacy.lease.agreementLabel, "lease_agreement");
});

test("service onboarding email uses provider and client terminology without sending", () => {
  const message = buildLeaseEmail({
    kind: "lawyer", agreementLabel: "service_agreement", leaseRef: "Example Tower",
    propertyName: "Example Tower", unitLabels: ["Floor 3"], lessorName: "Provider Co", lesseeName: "Client Co",
    startDate: "2026-02-02", endDate: "2027-02-01", leaseUrl: "https://example.test/leases/example",
    sender: { name: "Operator" }, hasAgreement: true,
  });
  assert.match(message.subject, /service agreement/);
  assert.match(message.text ?? "", /Service Provider/);
  assert.match(message.html ?? "", />Client</);
  assert.doesNotMatch(message.text ?? "", /Lessor|Lessee|lease agreement/);
});

test("service import persists, exports and produces its own document without a lease template", async () => {
  const intake = buildChecklistIntake(extractChecklist(grid));
  const result = await importChecklistToBackend(mockBackend, intake);
  const details = await mockBackend.leases.getDetails(result.leaseId);
  assert.ok(details);
  assert.equal(details.lease.agreementLabel, "service_agreement");
  assert.equal(details.lease.lockInEndDate, "2026-08-01");
  assert.equal(details.units[0].areaSqft, 3200);
  const updated = await mockBackend.leases.update(result.leaseId, { clauses: { serviceScope: "Office facilities and cleaning" } });
  assert.equal(updated.clauses?.serviceScope, "Office facilities and cleaning");
  const exported = buildLeaseChecklistWorkbook({ ...details, lease: updated, property: details.property ?? undefined }, "2026-11-16");
  const bytes = Buffer.from(exported.base64, "base64");
  const roundTrip = buildChecklistIntake(extractChecklist(parseXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))));
  const exportedSchedule = extractChecklist(parseXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))).schedules[0];
  assert.equal(exportedSchedule.tranches[0].totalRent?.amount, 25920000);
  assert.equal(exportedSchedule.tranches[0].periodRent?.amount, 2160000);
  assert.match(exported.fileName, /Service Agreement/);
  assert.equal(roundTrip.lease.agreementLabel, "service_agreement");
  assert.equal(roundTrip.lessor.displayName, intake.lessor.displayName);
  assert.equal(roundTrip.lessee.address, intake.lessee.address);
  assert.equal(roundTrip.lease.clauses.depositRefundTo, "lessor");
  assert.equal(roundTrip.lease.clauses.serviceScope, "Office facilities and cleaning");
  assert.equal(roundTrip.lease.tranches.length, 12);

  const parties = new Map(details.parties.map((p) => [p.id, p]));
  const data = fromLease(updated, details.property ?? undefined, details.units, parties);
  const model = leaseDocModel(data);
  assert.equal(model.title, "SERVICE AGREEMENT — TERMS SUMMARY");
  assert.equal(model.lessorLabel, "SERVICE PROVIDER");
  assert.equal(model.lesseeLabel, "CLIENT");
  assert.equal(model.showNotary, false);
  assert.doesNotMatch(JSON.stringify(model.blocks), /let lease|seised|Lessor|Lessee/);
  const doc = new PizZip(await renderLeaseFromTemplate(data));
  const xml = doc.file("word/document.xml")?.asText() ?? "";
  assert.match(xml, /SERVICE PROVIDER/);
  assert.match(xml, /CLIENT/);
  assert.match(xml, /Office facilities and cleaning/);
  assert.doesNotMatch(xml, /LESSOR|LESSEE|NOTARY PUBLIC|Indenture/);
  const draft = fromDraftIntent("draft", { agreementLabel: "service_agreement" }, undefined, [], new Map());
  assert.equal(leaseDocModel(draft).title, model.title);
  const legacy = leaseDocModel({ ...data, agreementLabel: "lease_agreement", agreementTitle: "Lease Agreement" });
  assert.equal(legacy.title, "LEASE AGREEMENT");
  assert.equal(legacy.showNotary, true);
  assert.match(JSON.stringify(legacy.blocks), /Lessor/);
});
