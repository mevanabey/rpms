/**
 * Shared option lists for lease edit mode. Plain module (no "use client") so
 * both server components (which build the details list and its field specs)
 * and the client field cell can import the same canonical enum values — the
 * cell zod-parses against these before building a `LeaseUpdateInput` patch.
 */

export type EditableOption = { value: string; label: string };

export const LEASE_STATUSES = [
  "draft",
  "signed",
  "active",
  "grace",
  "terminated",
  "expired",
  "renewed",
] as const;

export const LEASE_PURPOSES = ["commercial", "residential", "bpo"] as const;

export const PAYMENT_CADENCES = ["monthly", "quarterly", "biannual"] as const;

export const PAYMENT_METHODS = [
  "lkr_cash",
  "lkr_transfer",
  "usd_transfer",
  "bank_draft",
  "cheque",
] as const;

export const AGREEMENT_LABELS = [
  "lease_agreement",
  "rental_agreement",
  "other",
] as const;

const humanize = (s: string) => s.replace(/_/g, " ");

const toOptions = (values: readonly string[]): EditableOption[] =>
  values.map((v) => ({ value: v, label: humanize(v) }));

export const statusOptions = toOptions(LEASE_STATUSES);
export const purposeOptions = toOptions(LEASE_PURPOSES);
export const cadenceOptions = toOptions(PAYMENT_CADENCES);
export const paymentMethodOptions = toOptions(PAYMENT_METHODS);
export const agreementLabelOptions = toOptions(AGREEMENT_LABELS);

export const responsibleOptions: EditableOption[] = [
  { value: "lessor", label: "Landlord" },
  { value: "lessee", label: "Tenant" },
  { value: "shared", label: "Shared" },
  { value: "other", label: "Other" },
];

export const sublettingOptions: EditableOption[] = [
  { value: "no", label: "Not permitted" },
  { value: "with_consent", label: "Permitted with consent" },
  { value: "to_group", label: "Permitted to group / affiliates" },
  { value: "yes", label: "Permitted" },
];

export const depositRefundOptions: EditableOption[] = [
  { value: "lessee", label: "Refunded to Tenant" },
  { value: "lessor", label: "Refunded to Landlord" },
  { value: "other", label: "Other" },
];
