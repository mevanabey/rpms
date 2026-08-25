/**
 * Rent invoice generator. Produces a clean .docx with the full set of
 * information an operator would need to send to a tenant — property + units,
 * billing period, lease reference, structured line items with a VAT
 * placeholder, payment instructions and terms.
 *
 * The "Disconnection Notice" variant flips the header banner and adds a
 * stronger closing line; the structure is otherwise identical.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { LeaseDocumentData } from "./lease-document-data";

export interface InvoiceContext {
  /** Earliest unpaid rent line — drives the amount + due date. If missing,
   *  the builder still produces a draft with `__________` placeholders. */
  amount?: { amount: number; currency: string };
  dueDate?: string;
  /** Sequential or natural invoice number. */
  invoiceNumber?: string;
  /** Invoice issue date (defaults to today). */
  invoiceDate?: string;
  /** When true, the header reads "Disconnection Notice" instead of "Invoice". */
  isOverdue?: boolean;
}

const INK = "111827";
const MUTED = "666666";
const SUBTLE = "9CA3AF";
const ACCENT_RED = "DC2626";
const ROW_BG = "F9FAFB";

function fmtMoney(m: { amount: number; currency: string } | undefined): string {
  if (!m) return "________________";
  const n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(m.amount);
  if (m.currency === "LKR") return `Rs. ${n}/-`;
  if (m.currency === "USD") return `USD ${n}/-`;
  return `${m.currency} ${n}/-`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "________________";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "2-digit" });
}

function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function cell(
  text: string,
  opts: {
    bold?: boolean;
    align?: typeof AlignmentType[keyof typeof AlignmentType];
    color?: string;
    shade?: string;
    size?: number;
  } = {},
) {
  return new TableCell({
    shading: opts.shade ? { type: "clear", color: "auto", fill: opts.shade } : undefined,
    children: [
      new Paragraph({
        alignment: opts.align,
        children: [
          new TextRun({
            text,
            bold: opts.bold,
            color: opts.color ?? INK,
            size: opts.size,
          }),
        ],
      }),
    ],
  });
}

function kvRow(label: string, value: string) {
  return new TableRow({
    children: [
      cell(label, { bold: true, color: MUTED, size: 16 }),
      cell(value, { align: AlignmentType.RIGHT }),
    ],
  });
}

function periodForDueDate(lease: LeaseDocumentData, dueDate?: string): { start: string; end: string } | undefined {
  if (!dueDate) return undefined;
  // Pick the tranche covering this due date, default to the first one.
  const tranche =
    lease.tranches.find((t) => t.startDate <= dueDate && dueDate <= t.endDate) ??
    lease.tranches[0];
  if (!tranche) return undefined;
  // Rent for the period ending on the due date is the preceding 1 month.
  const periodEnd = dueDate;
  const periodStart = addDaysIso(addMonthsIso(periodEnd, -1), 1);
  // Clamp to the tranche start.
  const start = periodStart < tranche.startDate ? tranche.startDate : periodStart;
  return { start, end: periodEnd };
}

export function buildInvoiceDocument(lease: LeaseDocumentData, ctx: InvoiceContext = {}): Document {
  const isOverdue = Boolean(ctx.isOverdue);
  const heading = isOverdue ? "DISCONNECTION NOTICE" : "INVOICE";
  const headingColor = isOverdue ? ACCENT_RED : INK;
  const invoiceNumber =
    ctx.invoiceNumber ??
    `INV-${lease.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-5)}`;
  const invoiceDate = ctx.invoiceDate ?? new Date().toISOString().slice(0, 10);

  const period = periodForDueDate(lease, ctx.dueDate);
  const periodText = period
    ? `${fmtDate(period.start)} — ${fmtDate(period.end)}`
    : ctx.dueDate
      ? `Period ending ${fmtDate(ctx.dueDate)}`
      : "________________";

  const unitsText =
    lease.units.length === 0
      ? "—"
      : lease.units.map((u) => u.label).join(", ");
  const propertyAddress = [lease.property.addressLine, lease.property.city]
    .filter(Boolean)
    .join(", ");

  const rentDescription = `Rent — ${lease.property.name}${
    lease.units.length > 0 ? ` (${unitsText})` : ""
  }${period ? ` · ${fmtDate(period.start)} to ${fmtDate(period.end)}` : ""}`;

  const rentAmountText = fmtMoney(ctx.amount);
  const vatPlaceholder = "—";
  const totalLine = rentAmountText;
  const currencyCode = ctx.amount?.currency ?? "LKR";

  const children: Array<Paragraph | Table> = [
    // ── Heading ───────────────────────────────────────────
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: heading, bold: true, size: 36, color: headingColor }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      children: [
        new TextRun({
          text: `${invoiceNumber}  ·  issued ${fmtDate(invoiceDate)}`,
          size: 18,
          color: MUTED,
        }),
      ],
    }),

    // ── From / Bill To ────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders(),
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  spacing: { after: 60 },
                  children: [new TextRun({ text: "FROM", bold: true, color: SUBTLE, size: 14 })],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: lease.lessor.legalName || lease.lessor.displayName,
                      bold: true,
                    }),
                  ],
                }),
                ...(lease.lessor.address
                  ? [
                      new Paragraph({
                        children: [
                          new TextRun({ text: lease.lessor.address, size: 18, color: MUTED }),
                        ],
                      }),
                    ]
                  : []),
                ...(lease.lessor.idNumber
                  ? [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: lease.lessor.idNumber,
                            size: 16,
                            color: MUTED,
                          }),
                        ],
                      }),
                    ]
                  : []),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  spacing: { after: 60 },
                  children: [new TextRun({ text: "BILL TO", bold: true, color: SUBTLE, size: 14 })],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: lease.lessee.legalName || lease.lessee.displayName,
                      bold: true,
                    }),
                  ],
                }),
                ...(lease.lessee.address
                  ? [
                      new Paragraph({
                        children: [
                          new TextRun({ text: lease.lessee.address, size: 18, color: MUTED }),
                        ],
                      }),
                    ]
                  : []),
                ...(lease.lessee.idNumber
                  ? [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: lease.lessee.idNumber,
                            size: 16,
                            color: MUTED,
                          }),
                        ],
                      }),
                    ]
                  : []),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── Invoice meta block ────────────────────────────────
    new Paragraph({
      spacing: { before: 320, after: 100 },
      children: [new TextRun({ text: "INVOICE DETAILS", bold: true, color: SUBTLE, size: 14 })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: hairlineBorders(),
      rows: [
        kvRow("Invoice number", invoiceNumber),
        kvRow("Invoice date", fmtDate(invoiceDate)),
        kvRow("Due date", fmtDate(ctx.dueDate)),
        kvRow("Billing period", periodText),
        kvRow("Property", `${lease.property.name}${propertyAddress ? ` — ${propertyAddress}` : ""}`),
        kvRow("Unit(s)", unitsText),
        kvRow("Lease reference", lease.id),
        kvRow("Currency", currencyCode),
      ],
    }),

    // ── Charges table ─────────────────────────────────────
    new Paragraph({
      spacing: { before: 320, after: 100 },
      children: [new TextRun({ text: "CHARGES", bold: true, color: SUBTLE, size: 14 })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: hairlineBorders(),
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            cell("Description", { bold: true, color: MUTED, size: 16, shade: ROW_BG }),
            cell("Qty", {
              bold: true,
              color: MUTED,
              size: 16,
              align: AlignmentType.RIGHT,
              shade: ROW_BG,
            }),
            cell("Amount", {
              bold: true,
              color: MUTED,
              size: 16,
              align: AlignmentType.RIGHT,
              shade: ROW_BG,
            }),
          ],
        }),
        new TableRow({
          children: [
            cell(rentDescription),
            cell("1", { align: AlignmentType.RIGHT }),
            cell(rentAmountText, { align: AlignmentType.RIGHT }),
          ],
        }),
        new TableRow({
          children: [
            cell("VAT (if applicable)", { color: MUTED }),
            cell("—", { align: AlignmentType.RIGHT, color: MUTED }),
            cell(vatPlaceholder, { align: AlignmentType.RIGHT, color: MUTED }),
          ],
        }),
        new TableRow({
          children: [
            cell("Subtotal", { bold: true }),
            cell("", {}),
            cell(rentAmountText, { bold: true, align: AlignmentType.RIGHT }),
          ],
        }),
        new TableRow({
          children: [
            cell("TOTAL DUE", { bold: true, shade: ROW_BG }),
            cell("", { shade: ROW_BG }),
            cell(totalLine, { bold: true, align: AlignmentType.RIGHT, shade: ROW_BG }),
          ],
        }),
      ],
    }),

    // ── Payment instructions ──────────────────────────────
    new Paragraph({
      spacing: { before: 320, after: 100 },
      children: [
        new TextRun({ text: "PAYMENT INSTRUCTIONS", bold: true, color: SUBTLE, size: 14 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: "Please remit by bank transfer to the account designated under the lease agreement.",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: `Reference: ${invoiceNumber} — ${lease.lessee.legalName || lease.lessee.displayName}.`,
          color: MUTED,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Email proof of payment to accounts@capitaltrust.lk and your relationship manager.",
          color: MUTED,
        }),
      ],
    }),

    // ── Terms / closing line ──────────────────────────────
    new Paragraph({
      spacing: { before: 320, after: 80 },
      children: [new TextRun({ text: "TERMS", bold: true, color: SUBTLE, size: 14 })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: isOverdue
            ? "Payment is overdue. Failure to settle this invoice by return may result in disconnection of services and recovery action as provided in the lease agreement. Late-payment interest may accrue at the contractual rate."
            : "Payment is due by the date stated above. Late settlement may attract interest at the contractual rate. All amounts are in the currency stated under Invoice Details.",
          color: isOverdue ? ACCENT_RED : INK,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 320 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "This is a computer-generated invoice and does not require a signature.",
          italics: true,
          color: SUBTLE,
          size: 16,
        }),
      ],
    }),
  ];

  return new Document({
    creator: "Capital Trust",
    title: `${heading} ${invoiceNumber}`,
    styles: {
      default: {
        document: { run: { font: "Helvetica", size: 20, color: "1F2937" } },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } },
        children,
      },
    ],
  });
}

function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
  return {
    top: none,
    bottom: none,
    left: none,
    right: none,
    insideHorizontal: none,
    insideVertical: none,
  };
}

function hairlineBorders() {
  const line = { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" } as const;
  return {
    top: line,
    bottom: line,
    left: line,
    right: line,
    insideHorizontal: line,
    insideVertical: line,
  };
}

export async function downloadInvoice(
  lease: LeaseDocumentData,
  ctx: InvoiceContext = {},
): Promise<void> {
  const blob = await Packer.toBlob(buildInvoiceDocument(lease, ctx));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = (ctx.isOverdue ? "disconnection" : "invoice") + "-" + lease.id.slice(0, 8);
  a.href = url;
  a.download = `${slug}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
