import { createHash } from "node:crypto";
import type { Lease, LedgerEntry } from "@/core/types";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}

/** Reject sign-off if agreement terms or recorded payments changed while open. */
export function checklistReviewVersion(lease: Lease, ledger: LedgerEntry[]): string {
  return createHash("sha256").update(JSON.stringify(canonical({
    lease: { ...lease, importMeta: undefined,
      unitIds: [...lease.unitIds].sort(),
      tranches: [...lease.tranches].sort((a, b) => a.id.localeCompare(b.id)),
      additionalRoles: lease.additionalRoles?.slice().sort((a, b) => `${a.role}:${a.partyId}`.localeCompare(`${b.role}:${b.partyId}`)),
    },
    ledger: [...ledger].sort((a, b) => a.id.localeCompare(b.id)),
  }))).digest("hex");
}
