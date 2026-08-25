import { z } from "zod";

/**
 * Zod schemas for the lease clause bag (`lease.clauses` jsonb). Mirrors
 * `LeaseClauses` in `@/core/types`.
 *
 * Used at every boundary that touches clauses:
 *  - read: `parseLeaseClauses` (never trust raw jsonb)
 *  - write: `leaseClausesPatchSchema` in the server action, then the adapters
 *    merge the patch key-by-key and re-parse the result.
 */

const responsibleParty = z.enum(["lessor", "lessee", "shared", "other"]);
const currency = z.enum(["LKR", "USD"]);

const money = z.object({
  amount: z.number(),
  currency,
});

export const leaseClausesSchema = z
  .object({
    managementFeesBy: responsibleParty.optional(),
    managementFeesNote: z.string().optional(),
    serviceChargesBy: responsibleParty.optional(),
    serviceChargesNote: z.string().optional(),
    acServiceBy: responsibleParty.optional(),
    acServiceNote: z.string().optional(),
    acServicePeriod: z.string().optional(),
    minorRepairsThreshold: money.optional(),
    maintenanceText: z.string().optional(),
    handoverDelayPenalty: money.optional(),
    earlyTerminationPenalty: z.string().optional(),
    terminationNoticeMonths: z.number().optional(),
    renewalNoticeMonths: z.number().optional(),
    sublettingAllowed: z
      .enum(["no", "with_consent", "to_group", "yes"])
      .optional(),
    sublettingNote: z.string().optional(),
    depositRefundTo: z.enum(["lessee", "lessor", "other"]).optional(),
    depositRefundOther: z.string().optional(),
    advancePaymentAmount: money.optional(),
    lockInPeriodText: z.string().optional(),
    additionalCharges: z.string().optional(),
    lesseeEmployer: z.string().optional(),
    taxApplicabilityBy: responsibleParty.optional(),
    taxApplicabilityNote: z.string().optional(),
    fxBasis: z.string().optional(),
    firstFxRate: z.number().optional(),
    firstFxRateNote: z.string().optional(),
    ctpLawyerName: z.string().optional(),
    legalFeesNote: z.string().optional(),
    stampDutyNote: z.string().optional(),
  })
  // Non-strict so legacy / future rows survive a round-trip without losing
  // unknown keys when the front-end schema lags the database.
  .passthrough();

export type LeaseClausesParsed = z.infer<typeof leaseClausesSchema>;

/**
 * Patch form of the clause bag — every key nullable so a clause can be
 * cleared, and `.strict()` so an unknown key is rejected rather than written
 * into the jsonb blob.
 */
export const leaseClausesPatchSchema = z
  .object({
    managementFeesBy: responsibleParty.nullable(),
    managementFeesNote: z.string().nullable(),
    serviceChargesBy: responsibleParty.nullable(),
    serviceChargesNote: z.string().nullable(),
    acServiceBy: responsibleParty.nullable(),
    acServiceNote: z.string().nullable(),
    acServicePeriod: z.string().nullable(),
    minorRepairsThreshold: money.nullable(),
    maintenanceText: z.string().nullable(),
    handoverDelayPenalty: money.nullable(),
    earlyTerminationPenalty: z.string().nullable(),
    terminationNoticeMonths: z.number().int().nonnegative().nullable(),
    renewalNoticeMonths: z.number().int().nonnegative().nullable(),
    sublettingAllowed: z.enum(["no", "with_consent", "to_group", "yes"]).nullable(),
    sublettingNote: z.string().nullable(),
    depositRefundTo: z.enum(["lessee", "lessor", "other"]).nullable(),
    depositRefundOther: z.string().nullable(),
    advancePaymentAmount: money.nullable(),
    lockInPeriodText: z.string().nullable(),
    additionalCharges: z.string().nullable(),
    lesseeEmployer: z.string().nullable(),
    taxApplicabilityBy: responsibleParty.nullable(),
    taxApplicabilityNote: z.string().nullable(),
    fxBasis: z.string().nullable(),
    firstFxRate: z.number().nonnegative().nullable(),
    firstFxRateNote: z.string().nullable(),
    ctpLawyerName: z.string().nullable(),
    legalFeesNote: z.string().nullable(),
    stampDutyNote: z.string().nullable(),
  })
  .partial()
  .strict();

export type LeaseClausesPatchParsed = z.infer<typeof leaseClausesPatchSchema>;

/**
 * Merge a validated clause patch into the stored bag: `null` clears the key,
 * an absent key is left untouched. Returns `undefined` when nothing survives,
 * so the lease reads as "no clauses captured".
 */
export function mergeLeaseClauses(
  current: unknown,
  patch: LeaseClausesPatchParsed,
): LeaseClausesParsed | undefined {
  const merged: Record<string, unknown> = { ...(parseLeaseClauses(current) ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) delete merged[key];
    else merged[key] = value;
  }
  if (Object.keys(merged).length === 0) return undefined;
  return leaseClausesSchema.parse(merged);
}

export function parseLeaseClauses(
  raw: unknown,
): LeaseClausesParsed | undefined {
  if (raw === null || raw === undefined) return undefined;
  const result = leaseClausesSchema.safeParse(raw);
  if (!result.success) {
    // Don't throw — surface a warning and return undefined so the lease still
    // renders. Production hardening: log this through the observability layer
    // (Sentry / Axiom) when that lands.
    console.warn("Invalid lease.clauses jsonb shape:", result.error.flatten());
    return undefined;
  }
  return result.data;
}

export const agreementLabelSchema = z.enum([
  "lease_agreement",
  "rental_agreement",
  "other",
]);

export type AgreementLabelParsed = z.infer<typeof agreementLabelSchema>;

export function parseAgreementLabel(
  raw: string | null | undefined,
): AgreementLabelParsed | undefined {
  if (!raw) return undefined;
  const result = agreementLabelSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}
