import "server-only";

import type { MailAddress } from "@/core/services/mailer";
import type { Lease, Party, PartyRole } from "@/core/types";

import type { LeaseEmailKind } from "@/templates/emails/lease-onboarding";

/**
 * Which lease-attached roles receive each onboarding email. A lease carries
 * its people in `additionalRoles`, so the recipient list is data, never a
 * hardcoded address (SPEC §7 — the pipeline follows the lease's own graph).
 */
const ROLES_FOR: Record<LeaseEmailKind, PartyRole[]> = {
  lawyer: ["lessor_lawyer", "lessee_lawyer"],
  advisor: ["advisor"],
  accounts: ["accountant_handler"],
};

const LABEL: Record<LeaseEmailKind, string> = {
  lawyer: "lawyer",
  advisor: "advisor",
  accounts: "accounts handler",
};

/** Loose sanity check — the real validation happened when the party was created. */
function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/**
 * Resolves the addresses for one onboarding email, deduped case-insensitively
 * (the same lawyer can sit on both sides of a group lease).
 *
 * Throws when nothing resolves. That is deliberate: silently "sending" to
 * nobody and then advancing the pipeline would let a lease reach Accounts
 * without a lawyer ever seeing it.
 */
export function resolveLeaseRecipients(
  lease: Lease,
  kind: LeaseEmailKind,
  partyById: Map<string, Party>,
): MailAddress[] {
  const roles = new Set<PartyRole>(ROLES_FOR[kind]);
  const seen = new Set<string>();
  const out: MailAddress[] = [];

  for (const ref of lease.additionalRoles ?? []) {
    if (!roles.has(ref.role)) continue;
    const party = partyById.get(ref.partyId);
    if (!party) continue;
    for (const raw of party.emails ?? []) {
      const email = raw.trim();
      const key = email.toLowerCase();
      if (!isEmail(email) || seen.has(key)) continue;
      seen.add(key);
      out.push({ email, name: party.displayName });
    }
  }

  if (out.length === 0) {
    const named = (lease.additionalRoles ?? [])
      .filter((r) => roles.has(r.role))
      .map((r) => partyById.get(r.partyId)?.displayName)
      .filter((n): n is string => Boolean(n));

    throw new Error(
      named.length > 0
        ? `No email address on file for the ${LABEL[kind]} (${named.join(", ")}). Add one on the party record, then send again.`
        : `This lease has no ${LABEL[kind]} assigned. Add one under the lease's parties, then send again.`,
    );
  }

  return out;
}
