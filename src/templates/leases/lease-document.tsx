/**
 * The visual lease document, rendered via @react-pdf/renderer.
 *
 * The component is pure: it takes a normalised `LeaseDocumentData` and
 * lays out the document. It is the single source of truth for the PDF
 * the parties receive, see, sign, and download.
 */

import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { LeaseDocSettings } from "@/lib/demo/types";

import type { LeaseDocumentData } from "./lease-document-data";

const DEFAULT_BRAND_LINE = "CAPITAL TRUST";
const DEFAULT_BRAND_TAGLINE = "Rental Property Management";
const DEFAULT_DRAFT_BANNER =
  "DRAFT — NOT YET EXECUTED. Subject to KYC and final review.";
const DEFAULT_EXECUTION_CLAUSE =
  "IN WITNESS WHEREOF the parties have hereunto set their hands on the date first above written.";

const COLORS = {
  ink: "#111827",
  body: "#1f2937",
  muted: "#4b5563",
  subtle: "#9ca3af",
  hairline: "#d1d5db",
  primary: "#0f172a",
  band: "#f3f4f6",
  draftStamp: "#dc2626",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontSize: 10,
    color: COLORS.body,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  brand: { fontSize: 9, color: COLORS.muted, letterSpacing: 1 },
  brandStrong: { color: COLORS.ink, fontFamily: "Helvetica-Bold" },
  docId: { fontSize: 8, color: COLORS.subtle, fontFamily: "Helvetica-Oblique" },
  title: {
    fontSize: 20,
    color: COLORS.ink,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 10,
    color: COLORS.muted,
    textAlign: "center",
    marginBottom: 18,
  },
  draftBanner: {
    marginBottom: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.draftStamp,
    borderRadius: 3,
    fontSize: 9,
    color: COLORS.draftStamp,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 11,
    color: COLORS.ink,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  paragraph: { marginBottom: 6 },
  partyBlock: {
    marginTop: 4,
    marginBottom: 8,
    padding: 8,
    backgroundColor: COLORS.band,
    borderRadius: 3,
  },
  partyLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  partyName: { fontFamily: "Helvetica-Bold", color: COLORS.ink, fontSize: 11 },
  partyMeta: { color: COLORS.muted, fontSize: 9 },
  table: { marginTop: 4, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 2 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  tableRowLast: { flexDirection: "row" },
  th: {
    backgroundColor: COLORS.band,
    padding: 5,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: COLORS.ink,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  td: { padding: 5, fontSize: 9, color: COLORS.body },
  tdRight: { padding: 5, fontSize: 9, color: COLORS.body, textAlign: "right" },
  amountBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  amountLabel: { color: COLORS.muted, fontSize: 10 },
  amountValue: { color: COLORS.ink, fontSize: 10, fontFamily: "Helvetica-Bold" },
  signatureGrid: {
    marginTop: 24,
    flexDirection: "row",
    gap: 24,
  },
  signatureCell: { flex: 1 },
  signatureLine: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ink,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  signatureImage: { width: 180, height: 54, objectFit: "contain" },
  signatureRole: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  signatureName: { fontSize: 10, color: COLORS.ink, fontFamily: "Helvetica-Bold" },
  signatureMeta: { fontSize: 8, color: COLORS.subtle, marginTop: 1 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    right: 56,
    fontSize: 7,
    color: COLORS.subtle,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
    paddingTop: 6,
  },
});

const ROLE_LABEL: Record<string, string> = {
  lessor: "Lessor",
  lessee: "Lessee",
  client: "Client",
  tenant: "Tenant",
  introducer: "Introducer",
  advisor: "Advisor",
  lessor_lawyer: "Lessor's Lawyer",
  lessee_lawyer: "Lessee's Lawyer",
  accountant_handler: "Accountant / Handler",
  witness: "Witness",
};

function formatMoney(m: { amount: number; currency: string } | undefined): string {
  if (!m) return "—";
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    m.amount,
  );
  if (m.currency === "LKR") return `Rs. ${formatted}`;
  if (m.currency === "USD") return `USD ${formatted}`;
  return `${m.currency} ${formatted}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "2-digit" });
}

function cadenceLabel(c: string): string {
  if (c === "monthly") return "Monthly";
  if (c === "quarterly") return "Quarterly";
  if (c === "biannual") return "Bi-annually";
  return c;
}

function paymentMethodLabel(m: string): string {
  return m.replace(/_/g, " ");
}

export function LeaseDocument({
  data,
  settings,
}: {
  data: LeaseDocumentData;
  settings?: LeaseDocSettings;
}) {
  const brandLine = settings?.brandLine?.trim() || DEFAULT_BRAND_LINE;
  const brandTagline = settings?.brandTagline?.trim() || DEFAULT_BRAND_TAGLINE;
  const draftBanner = settings?.draftBannerText?.trim() || DEFAULT_DRAFT_BANNER;
  const footerNote = settings?.footerNote?.trim();
  const executionClause =
    settings?.executionClause?.trim() || DEFAULT_EXECUTION_CLAUSE;
  const agreementTitle =
    settings?.agreementTitleOverride?.trim() || data.agreementTitle;
  return (
    <Document
      title={`${agreementTitle} · ${data.id}`}
      author={brandLine}
      subject={`Lease ${data.id}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.brand}>
              <Text style={styles.brandStrong}>{brandLine}</Text> · {brandTagline}
            </Text>
            <Text style={styles.docId}>Document ref · {data.id}</Text>
          </View>
          <Text style={styles.docId}>
            Generated {formatDate(data.generatedAt)}
          </Text>
        </View>

        <Text style={styles.title}>{agreementTitle}</Text>
        <Text style={styles.subtitle}>
          {data.property.name}
          {data.units.length > 0 ? ` · ${data.units.map((u) => u.label).join(", ")}` : ""}
        </Text>

        {data.isDraft && <Text style={styles.draftBanner}>{draftBanner}</Text>}

        {/* Recitals */}
        <Text style={styles.sectionTitle}>1. Parties</Text>
        <PartyView party={data.lessor} />
        <PartyView party={data.lessee} />
        {data.additionalParties.map((p) => (
          <PartyView key={`${p.role}_${p.id}`} party={p} />
        ))}

        {/* Premises */}
        <Text style={styles.sectionTitle}>2. Premises</Text>
        <Text style={styles.paragraph}>
          The Lessor demises unto the Lessee, and the Lessee takes on hire from the
          Lessor, the premises known as <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.property.name}</Text>
          {data.property.addressLine ? `, situated at ${data.property.addressLine}` : ""}
          {data.property.lotNo ? `, Lot ${data.property.lotNo}` : ""}
          {data.property.planNo ? `, Plan No. ${data.property.planNo}` : ""}
          {data.property.perches ? `, ${data.property.perches} perches in extent` : ""}.
        </Text>
        {data.units.length > 0 && <UnitsTable units={data.units} />}

        {/* Term */}
        <Text style={styles.sectionTitle}>3. Term</Text>
        <Text style={styles.paragraph}>
          The term of this Agreement shall commence on{" "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{formatDate(data.startDate)}</Text> and
          shall expire on{" "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{formatDate(data.endDate)}</Text>
          {data.advanceMonths
            ? `, with ${data.advanceMonths} month(s) of rent paid in advance at signing`
            : ""}
          {data.lockInEndDate
            ? `. Lock-in period ends on ${formatDate(data.lockInEndDate)}.`
            : "."}
        </Text>

        {/* Rent schedule */}
        <Text style={styles.sectionTitle}>4. Rent</Text>
        <Text style={styles.paragraph}>
          The Lessee shall pay rent {cadenceLabel(data.paymentCadence).toLowerCase()} via{" "}
          {paymentMethodLabel(data.defaultPaymentMethod)} per the schedule below.
        </Text>
        <TranchesTable data={data} />

        {/* Money */}
        <Text style={styles.sectionTitle}>5. Money</Text>
        <View style={{ paddingHorizontal: 4 }}>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Security deposit</Text>
            <Text style={styles.amountValue}>{formatMoney(data.securityDeposit)}</Text>
          </View>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Stamp duty (2%)</Text>
            <Text style={styles.amountValue}>{formatMoney(data.stampDuty)}</Text>
          </View>
          <View style={[styles.amountBox, { borderBottomWidth: 0 }]}>
            <Text style={styles.amountLabel}>Legal fees</Text>
            <Text style={styles.amountValue}>{formatMoney(data.legalFees)}</Text>
          </View>
        </View>

        {/* Clauses */}
        {data.clauses && hasAnyClause(data.clauses) && (
          <>
            <Text style={styles.sectionTitle}>6. Operations & responsibilities</Text>
            <ClausesView clauses={data.clauses} />
          </>
        )}

        {/* Signatures */}
        <Text style={styles.sectionTitle} break={shouldBreakSignaturesPage(data)}>
          7. Execution
        </Text>
        <Text style={styles.paragraph}>{executionClause}</Text>
        <View style={styles.signatureGrid}>
          <SignatureBlock party={data.lessor} signatures={data.signatures} />
          <SignatureBlock party={data.lessee} signatures={data.signatures} />
        </View>
        {data.additionalParties.length > 0 && (
          <View style={[styles.signatureGrid, { marginTop: 18 }]}>
            {data.additionalParties.slice(0, 2).map((p) => (
              <SignatureBlock key={`${p.role}_${p.id}`} party={p} signatures={data.signatures} />
            ))}
          </View>
        )}

        {/* Page footer */}
        <View style={styles.footer} fixed>
          <Text>
            {footerNote ? `${footerNote} · ` : ""}
            {agreementTitle} · {data.id}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

// ─────────────────────────────────────────────── sub-components

function PartyView({ party }: { party: { role: string; displayName: string; legalName?: string; idNumber?: string; address?: string; emails?: string[]; phones?: string[] } }) {
  return (
    <View style={styles.partyBlock}>
      <Text style={styles.partyLabel}>{ROLE_LABEL[party.role] ?? party.role}</Text>
      <Text style={styles.partyName}>{party.displayName}</Text>
      {party.legalName && party.legalName !== party.displayName && (
        <Text style={styles.partyMeta}>{party.legalName}</Text>
      )}
      {party.idNumber && <Text style={styles.partyMeta}>ID · {party.idNumber}</Text>}
      {party.address && <Text style={styles.partyMeta}>{party.address}</Text>}
      {(party.emails?.length || party.phones?.length) && (
        <Text style={styles.partyMeta}>
          {[party.emails?.[0], party.phones?.[0]].filter(Boolean).join(" · ")}
        </Text>
      )}
    </View>
  );
}

function UnitsTable({ units }: { units: { label: string; type?: string; floor?: string | number; areaSqft?: number; bedrooms?: number }[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <Text style={[styles.th, { flex: 2 }]}>Unit</Text>
        <Text style={[styles.th, { flex: 1 }]}>Type</Text>
        <Text style={[styles.th, { flex: 1 }]}>Floor</Text>
        <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Area (sqft)</Text>
        <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Bedrooms</Text>
      </View>
      {units.map((u, i) => (
        <View
          key={u.label + i}
          style={i === units.length - 1 ? styles.tableRowLast : styles.tableRow}
        >
          <Text style={[styles.td, { flex: 2 }]}>{u.label}</Text>
          <Text style={[styles.td, { flex: 1 }]}>{u.type ?? "—"}</Text>
          <Text style={[styles.td, { flex: 1 }]}>{u.floor ?? "—"}</Text>
          <Text style={[styles.tdRight, { flex: 1 }]}>
            {u.areaSqft ? u.areaSqft.toLocaleString() : "—"}
          </Text>
          <Text style={[styles.tdRight, { flex: 1 }]}>{u.bedrooms ?? "—"}</Text>
        </View>
      ))}
    </View>
  );
}

function TranchesTable({ data }: { data: LeaseDocumentData }) {
  if (data.tranches.length === 0) {
    return (
      <Text style={[styles.paragraph, { color: COLORS.muted }]}>
        No rent schedule captured.
      </Text>
    );
  }
  return (
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <Text style={[styles.th, { flex: 0.5 }]}>#</Text>
        <Text style={[styles.th, { flex: 2 }]}>Period</Text>
        <Text style={[styles.th, { flex: 1.4, textAlign: "right" }]}>Monthly rent</Text>
        <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>Advance set-off</Text>
        <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Due day</Text>
      </View>
      {data.tranches.map((t, i) => (
        <View
          key={t.sequence}
          style={i === data.tranches.length - 1 ? styles.tableRowLast : styles.tableRow}
        >
          <Text style={[styles.td, { flex: 0.5 }]}>{t.sequence}</Text>
          <Text style={[styles.td, { flex: 2 }]}>
            {formatDate(t.startDate)} → {formatDate(t.endDate)}
          </Text>
          <Text style={[styles.tdRight, { flex: 1.4 }]}>{formatMoney(t.monthlyRent)}</Text>
          <Text style={[styles.tdRight, { flex: 1.2, color: COLORS.muted }]}>
            {t.advanceSetoff ? formatMoney(t.advanceSetoff) : "—"}
          </Text>
          <Text style={[styles.tdRight, { flex: 1 }]}>{t.dueDayOfMonth}</Text>
        </View>
      ))}
    </View>
  );
}

function ClausesView({ clauses }: { clauses: NonNullable<LeaseDocumentData["clauses"]> }) {
  const rows: { label: string; value: string }[] = [];
  if (clauses.managementFeesBy) {
    rows.push({
      label: "Management fees",
      value: `${capitalize(clauses.managementFeesBy)}${clauses.managementFeesNote ? ` — ${clauses.managementFeesNote}` : ""}`,
    });
  }
  if (clauses.serviceChargesBy) {
    rows.push({
      label: "Service charges",
      value: `${capitalize(clauses.serviceChargesBy)}${clauses.serviceChargesNote ? ` — ${clauses.serviceChargesNote}` : ""}`,
    });
  }
  if (clauses.acServiceBy) {
    rows.push({
      label: "A/C servicing",
      value: `${capitalize(clauses.acServiceBy)}${clauses.acServiceNote ? ` — ${clauses.acServiceNote}` : ""}`,
    });
  }
  if (clauses.minorRepairsThreshold) {
    rows.push({
      label: "Minor-repairs threshold",
      value: `${formatMoney(clauses.minorRepairsThreshold)} — lessee bears costs below this amount`,
    });
  }
  if (clauses.handoverDelayPenalty) {
    rows.push({
      label: "Handover-delay penalty",
      value: `${formatMoney(clauses.handoverDelayPenalty)} per day`,
    });
  }
  if (clauses.terminationNoticeMonths !== undefined) {
    rows.push({
      label: "Termination notice",
      value: `${clauses.terminationNoticeMonths} month(s)`,
    });
  }
  if (clauses.renewalNoticeMonths !== undefined) {
    rows.push({
      label: "Renewal notice",
      value: `${clauses.renewalNoticeMonths} month(s)`,
    });
  }
  if (clauses.sublettingAllowed) {
    rows.push({
      label: "Subletting",
      value: `${capitalize(clauses.sublettingAllowed.replace(/_/g, " "))}${clauses.sublettingNote ? ` — ${clauses.sublettingNote}` : ""}`,
    });
  }
  if (clauses.depositRefundTo) {
    rows.push({
      label: "Deposit refundable to",
      value: `${capitalize(clauses.depositRefundTo)}${clauses.depositRefundOther ? ` — ${clauses.depositRefundOther}` : ""}`,
    });
  }
  if (clauses.maintenanceText) {
    rows.push({ label: "Maintenance", value: clauses.maintenanceText });
  }
  if (clauses.earlyTerminationPenalty) {
    rows.push({ label: "Early termination", value: clauses.earlyTerminationPenalty });
  }

  return (
    <View>
      {rows.map((r, i) => (
        <View
          key={r.label + i}
          style={{
            flexDirection: "row",
            paddingVertical: 4,
            borderBottomWidth: i === rows.length - 1 ? 0 : 1,
            borderBottomColor: COLORS.hairline,
          }}
        >
          <Text style={{ flex: 1, color: COLORS.muted }}>{r.label}</Text>
          <Text style={{ flex: 2 }}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

function SignatureBlock({
  party,
  signatures,
}: {
  party: { id: string; displayName: string; role: string };
  signatures?: LeaseDocumentData["signatures"];
}) {
  const sig = signatures?.[party.id];
  return (
    <View style={styles.signatureCell}>
      <View style={styles.signatureLine}>
        {/* react-pdf <Image> isn't a DOM <img>; alt-text rule doesn't apply. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        {sig && <Image src={sig.dataUrl} style={styles.signatureImage} />}
      </View>
      <Text style={styles.signatureRole}>{ROLE_LABEL[party.role] ?? party.role}</Text>
      <Text style={styles.signatureName}>{party.displayName}</Text>
      {sig && (
        <Text style={styles.signatureMeta}>Signed {formatDate(sig.signedAt)}</Text>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────── tiny utils

function hasAnyClause(c: NonNullable<LeaseDocumentData["clauses"]>): boolean {
  return Boolean(
    c.managementFeesBy ||
      c.serviceChargesBy ||
      c.acServiceBy ||
      c.minorRepairsThreshold ||
      c.handoverDelayPenalty ||
      c.terminationNoticeMonths !== undefined ||
      c.renewalNoticeMonths !== undefined ||
      c.sublettingAllowed ||
      c.depositRefundTo ||
      c.maintenanceText ||
      c.earlyTerminationPenalty,
  );
}

function shouldBreakSignaturesPage(data: LeaseDocumentData): boolean {
  // Rough heuristic — many tranches/clauses → force signatures onto a fresh page.
  return data.tranches.length > 3;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Hint react-pdf to bundle default fonts (silences any sketchy SSR warnings).
Font.registerHyphenationCallback((word) => [word]);
