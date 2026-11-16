import type { AgreementLabel } from "@/core/types";

export const AGREEMENT_LABELS = ["lease_agreement", "rental_agreement", "service_agreement", "other"] as const;

export const AGREEMENT_TITLES: Record<AgreementLabel, string> = {
  lease_agreement: "Lease Agreement",
  rental_agreement: "Rental Agreement",
  service_agreement: "Service Agreement",
  other: "Other",
};

/** Stored party slots stay stable so access, payments and existing records
 * retain their relationships when the instrument type changes. */
export function agreementPartyLabels(label?: AgreementLabel) {
  return label === "service_agreement"
    ? { lessor: "Service Provider", lessee: "Client" }
    : { lessor: "Landlord", lessee: "Tenant" };
}

/** Adapt UI labels only; never rewrite user notes or contract clauses. */
export function agreementFieldLabel(label: AgreementLabel | undefined, text: string): string {
  if (label !== "service_agreement") return text;
  return text
    .replace(/Lessor \/ Landlord|Lessor \(Landlord\)|\bLessor\b|\bLandlord\b/gi, "Service Provider")
    .replace(/Lessee \/ Tenant|Lessee \(Tenant\)|\bLessee\b|\bTenant\b/gi, "Client");
}
