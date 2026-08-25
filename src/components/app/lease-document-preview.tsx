"use client";

/**
 * On-screen HTML preview of the lease document, rendered from the same clause
 * model the .docx is built from (no PDF). Presentational — takes the lease
 * data + template settings and lays out the document.
 */

import type { LeaseDocSettings } from "@/lib/demo/types";
import { cn } from "@/lib/utils";
import { leaseDocModel } from "@/templates/leases/lease-document-blocks";
import type { DocumentParty, LeaseDocumentData } from "@/templates/leases/lease-document-data";

function nameOf(p: DocumentParty): string {
  return p.legalName?.trim() || p.displayName?.trim() || "________________";
}

function SignatureCell({
  party,
  roleLabel,
  signatures,
}: {
  party: DocumentParty;
  roleLabel: string;
  signatures?: LeaseDocumentData["signatures"];
}) {
  const sig = party.id ? signatures?.[party.id] : undefined;
  return (
    <div className="flex flex-col">
      <div className="flex h-14 items-end justify-center border-b border-foreground">
        {sig && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sig.dataUrl} alt={`${roleLabel} signature`} className="max-h-12 object-contain" />
        )}
      </div>
      <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{roleLabel}</span>
      <span className="font-semibold">{nameOf(party)}</span>
      {party.idNumber && <span className="text-[11px] text-muted-foreground">{party.idNumber}</span>}
    </div>
  );
}

export function LeaseDocumentPreview({
  data,
  settings,
  className,
}: {
  data: LeaseDocumentData;
  settings?: LeaseDocSettings;
  className?: string;
}) {
  const model = leaseDocModel(data, settings);

  return (
    <div className={cn("overflow-y-auto bg-card", className)}>
      <div className="mx-auto max-w-[760px] px-10 py-10 font-serif text-[13px] leading-relaxed text-foreground">
        <h1 className="text-center font-bold text-lg uppercase tracking-wide">{model.title}</h1>
        <p className="mt-1 text-center text-muted-foreground text-xs">{model.subtitle}</p>

        {model.isDraft && (
          <p className="mx-auto mt-4 max-w-md rounded border border-destructive px-3 py-1.5 text-center font-semibold text-destructive text-xs tracking-wide">
            {model.draftBanner}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {model.blocks.map((b, i) => {
            if (b.kind === "center") {
              return (
                <p key={i} className="text-center font-bold">
                  {b.text}
                </p>
              );
            }
            if (b.kind === "head") {
              return (
                <p key={i} className="mt-2 font-bold">
                  {b.text}
                </p>
              );
            }
            return (
              <p key={i} className="text-justify">
                {b.heading && <span className="font-bold">{b.heading} </span>}
                {b.text}
              </p>
            );
          })}
        </div>

        {model.units.length > 0 && (
          <div className="mt-5">
            <p className="font-bold">{model.scheduleHeading}</p>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 text-left">
                  <th className="border border-border p-1.5">Unit / Parcel</th>
                  <th className="border border-border p-1.5">Floor</th>
                  <th className="border border-border p-1.5 text-right">Area (sqft)</th>
                  <th className="border border-border p-1.5 text-right">Bedrooms</th>
                </tr>
              </thead>
              <tbody>
                {model.units.map((u, i) => (
                  <tr key={u.label + i}>
                    <td className="border border-border p-1.5">{u.label}</td>
                    <td className="border border-border p-1.5">{u.floor ?? "—"}</td>
                    <td className="border border-border p-1.5 text-right">
                      {u.areaSqft ? u.areaSqft.toLocaleString() : "—"}
                    </td>
                    <td className="border border-border p-1.5 text-right">{u.bedrooms ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 text-justify">{model.sealLine}</p>
        <div className="mt-8 grid grid-cols-2 gap-8">
          <SignatureCell party={model.lessor} roleLabel="LESSOR" signatures={model.signatures} />
          <SignatureCell party={model.lessee} roleLabel="LESSEE" signatures={model.signatures} />
        </div>
        <div className="mt-6">
          <p className="font-bold text-xs">WITNESSES:</p>
          <p className="mt-2 text-xs">1. ____________________________________________</p>
          <p className="mt-2 text-xs">2. ____________________________________________</p>
          <p className="mt-4 text-xs">____________________________________________</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Notary Public</p>
        </div>
      </div>
    </div>
  );
}
