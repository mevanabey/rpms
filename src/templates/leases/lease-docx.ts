/**
 * Builds the lease document as a real .docx (Word) file from the shared clause
 * model. Isomorphic — `buildLeaseDocxBlob` runs in the browser for download;
 * `buildLeaseDocument` is reused by node tooling/tests.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { LeaseDocSettings } from "@/lib/demo/types";

import { leaseDocModel, type Block, type LeaseDocModel } from "./lease-document-blocks";
import type { DocumentParty, LeaseDocumentData } from "./lease-document-data";

const INK = "111827";
const MUTED = "666666";
const DRAFT = "DC2626";

function nameOf(p: DocumentParty): string {
  return p.legalName?.trim() || p.displayName?.trim() || "________________";
}

function dataUrlToImage(dataUrl: string): { data: Uint8Array; type: "png" | "jpg" } | undefined {
  const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!m) return undefined;
  const type = /png/i.test(m[1]) ? "png" : "jpg";
  const b64 = m[2];
  let bytes: Uint8Array;
  if (typeof atob === "function") {
    const bin = atob(b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    bytes = new Uint8Array(Buffer.from(b64, "base64"));
  }
  return { data: bytes, type };
}

function blockToParagraphs(b: Block): Paragraph[] {
  if (b.kind === "center") {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 140, after: 140 },
        children: [new TextRun({ text: b.text, bold: true, color: INK })],
      }),
    ];
  }
  if (b.kind === "head") {
    return [
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: b.text, bold: true, color: INK })],
      }),
    ];
  }
  return [
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 140 },
      children: [
        ...(b.heading ? [new TextRun({ text: `${b.heading} `, bold: true, color: INK })] : []),
        new TextRun({ text: b.text }),
      ],
    }),
  ];
}

function unitsTable(model: LeaseDocModel): (Paragraph | Table)[] {
  if (model.units.length === 0) return [];
  const headerCell = (text: string) =>
    new TableCell({
      shading: { fill: "F3F4F6" },
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 16 })] })],
    });
  const cell = (text: string) =>
    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })] });

  return [
    new Paragraph({ spacing: { before: 160, after: 80 }, children: [new TextRun({ text: model.scheduleHeading, bold: true, color: INK })] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [headerCell("Unit / Parcel"), headerCell("Floor"), headerCell("Area (sqft)"), headerCell("Bedrooms")],
        }),
        ...model.units.map(
          (u) =>
            new TableRow({
              children: [
                cell(u.label),
                cell(u.floor != null ? String(u.floor) : "—"),
                cell(u.areaSqft ? u.areaSqft.toLocaleString() : "—"),
                cell(u.bedrooms != null ? String(u.bedrooms) : "—"),
              ],
            }),
        ),
      ],
    }),
  ];
}

function signatureCell(party: DocumentParty, roleLabel: string, model: LeaseDocModel): TableCell {
  const sig = party.id ? model.signatures?.[party.id] : undefined;
  const img = sig ? dataUrlToImage(sig.dataUrl) : undefined;
  const children: Paragraph[] = [];
  if (img) {
    children.push(
      new Paragraph({ children: [new ImageRun({ type: img.type, data: img.data, transformation: { width: 150, height: 44 } })] }),
    );
  } else {
    children.push(new Paragraph({ spacing: { before: 360 }, children: [] }));
  }
  children.push(
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: INK, space: 1 } },
      children: [new TextRun({ text: roleLabel, size: 16, color: MUTED })],
    }),
    new Paragraph({ children: [new TextRun({ text: nameOf(party), bold: true })] }),
  );
  if (party.idNumber) children.push(new Paragraph({ children: [new TextRun({ text: party.idNumber, size: 16, color: MUTED })] }));
  return new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: noBorders(), children });
}

function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none };
}

export function buildLeaseDocument(data: LeaseDocumentData, settings?: LeaseDocSettings): Document {
  const model = leaseDocModel(data, settings);

  const body: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: model.title, bold: true, size: 32, color: INK })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: model.subtitle, size: 18, color: MUTED })],
    }),
  ];

  if (model.isDraft) {
    body.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: model.draftBanner, bold: true, color: DRAFT })],
      }),
    );
  }

  for (const b of model.blocks) body.push(...blockToParagraphs(b));
  body.push(...unitsTable(model));

  body.push(
    new Paragraph({ spacing: { before: 200, after: 160 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: model.sealLine })] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders(),
      rows: [
        new TableRow({
          children: [signatureCell(model.lessor, "LESSOR", model), signatureCell(model.lessee, "LESSEE", model)],
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: "WITNESSES:", bold: true })] }),
    new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: "1. ____________________________________________" })] }),
    new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: "2. ____________________________________________" })] }),
    new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: "____________________________________________" })] }),
    new Paragraph({ children: [new TextRun({ text: "NOTARY PUBLIC", size: 16, color: MUTED })] }),
  );

  return new Document({
    creator: model.brandLine,
    title: model.title,
    styles: { default: { document: { run: { font: "Times New Roman", size: 20, color: "1F2937" } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${model.footerNote ? model.footerNote + " · " : ""}${model.title}    `, size: 14, color: MUTED }),
                  new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 14, color: MUTED }),
                ],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });
}

export async function buildLeaseDocxBlob(data: LeaseDocumentData, settings?: LeaseDocSettings): Promise<Blob> {
  return Packer.toBlob(buildLeaseDocument(data, settings));
}

/** Client-only: build the .docx and trigger a download. */
export async function downloadLeaseDocx(data: LeaseDocumentData, settings?: LeaseDocSettings): Promise<void> {
  const model = leaseDocModel(data, settings);
  const blob = await buildLeaseDocxBlob(data, settings);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${model.fileBaseName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
