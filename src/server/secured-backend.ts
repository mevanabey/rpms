import "server-only";

import type { Backend } from "@/core/services";
import { assertChecklistReviewed } from "@/lib/checklist/review-status";
import { can, DEFAULT_PERMISSIONS } from "@/lib/demo/identity";
import type { AppUser } from "@/lib/demo/identity";
import { requireAppUser } from "@/lib/auth/identity";
import { canSeeLease, scopedLeaseIds, scopeByLease } from "@/lib/demo/scope";
import { withAudit } from "@/server/db/client";

/** Apply scoping before any service result reaches a page, export, or action.
 * Actors come from the verified session, never a client-supplied user ID. */
export function secureBackend(backend: Backend, getUser: () => Promise<AppUser> = requireAppUser): Backend {
  function audited<A extends unknown[], R>(action: string, operation: (...args: A) => Promise<R>) {
    return async (...args: A): Promise<R> => {
      const actor = await getUser();
      return withAudit(actor, action, () => operation(...args));
    };
  }
  async function requireReviewed(id: string) {
    const user = await getUser();
    if (!canSeeLease(user, id)) throw new Error("Access denied.");
    const lease = await backend.leases.get(id);
    if (!lease) throw new Error("Lease not found.");
    assertChecklistReviewed(lease);
  }
  function reviewed<A extends [string, ...unknown[]], R>(action: string, operation: (...args: A) => Promise<R>) {
    return async (...args: A): Promise<R> => { await requireReviewed(args[0]); return audited(action, operation)(...args); };
  }
  return {
    ...backend,
    leases: {
      ...backend.leases,
      async getChecklist(id) {
        const user = await getUser();
        if (!canSeeLease(user, id)) return null;
        const checklist = await backend.leases.getChecklist(id);
        if (checklist && !checklist.requiredLeaseIds.every((leaseId) => canSeeLease(user, leaseId))) {
          throw new Error("This source checklist contains linked agreements that are outside your access.");
        }
        return checklist;
      },
      // The import action authorizes checklists:manage; attachment authorizes
      // writes to the existing lease. Newly created import IDs are not yet in
      // the request-cached identity's createdLeaseIds, so scope those at the
      // action boundary rather than rejecting the creator here.
      saveChecklist: audited("Original checklist saved", backend.leases.saveChecklist),
      async list(filter) {
        const user = await getUser();
        const ids = scopedLeaseIds(user, filter?.ids);
        if (ids?.length === 0) return [];
        return scopeByLease(user, await backend.leases.list({ ...filter, ids }), (lease) => lease.id);
      },
      async listOverview(filter) {
        const user = await getUser();
        const ids = scopedLeaseIds(user, filter?.ids);
        if (ids?.length === 0) return [];
        return scopeByLease(user, await backend.leases.listOverview({ ...filter, ids }), (row) => row.lease.id);
      },
      async get(id) {
        const user = await getUser();
        return canSeeLease(user, id) ? backend.leases.get(id) : null;
      },
      async getDetails(id) {
        const user = await getUser();
        if (!canSeeLease(user, id)) return null;
        const result = await backend.leases.getDetails(id);
        if (!result) return null;
        const relatedLeases = scopeByLease(user, result.relatedLeases, (lease) => lease.id);
        const partyIds = new Set([result.lease, ...relatedLeases].flatMap((lease) => [
          lease.lessorPartyId, lease.lesseePartyId,
          ...(lease.additionalRoles ?? []).map((role) => role.partyId),
        ]));
        return {
          ...result,
          relatedLeases,
          parties: result.parties.filter((party) => partyIds.has(party.id)),
          ledger: result.ledger.filter((entry) => entry.leaseId === id),
          obligations: result.obligations.filter((entry) => entry.leaseId === id),
        };
      },
      async approveChecklist(id, input) {
        const actor = await getUser();
        if (!canSeeLease(actor, id) || !can(actor, DEFAULT_PERMISSIONS, "leases:write")) throw new Error("Access denied.");
        if (input.receipts.length && !can(actor, DEFAULT_PERMISSIONS, "payments:write")) throw new Error("Payment access is required to record collected rent.");
        const original = await backend.leases.getChecklist(id);
        if (!original) throw new Error("Attach the original checklist before sign-off.");
        if (!original.requiredLeaseIds.every((leaseId) => canSeeLease(actor, leaseId))) throw new Error("Reviewing this checklist requires access to its linked agreements.");
        return withAudit(actor, "Checklist reviewed, approved and signed off", () => backend.leases.approveChecklist(id, { ...input,
          approvedById: actor.id, approvedByName: actor.name, approvedAt: new Date().toISOString(),
        }));
      },
      create: audited("Lease created", backend.leases.create),
      async update(id, patch) {
        if (patch.status && patch.status !== "draft") await requireReviewed(id);
        return audited("Lease edited", backend.leases.update)(id, patch);
      },
      async updateStatus(id, status) {
        if (status !== "draft") await requireReviewed(id);
        return audited("Lease status changed", backend.leases.updateStatus)(id, status);
      },
      updateTranche: audited("Rent terms edited", backend.leases.updateTranche),
      softDelete: audited("Lease deleted", backend.leases.softDelete),
      attachSignedLease: reviewed("Signed lease uploaded", backend.leases.attachSignedLease),
      setOnboardingStage: reviewed("Lease workflow stage changed", backend.leases.setOnboardingStage),
      markAgreementGenerated: reviewed("Lease agreement saved", backend.leases.markAgreementGenerated),
      markLeaseEmailSent: reviewed("Lease email sent", backend.leases.markLeaseEmailSent),
      markLeaseActive: reviewed("Lease activated", backend.leases.markLeaseActive),
      generateRentSchedule: audited("Rent schedule generated", backend.leases.generateRentSchedule),
    },
    parties: {
      ...backend.parties,
      create: audited("Contact created", backend.parties.create),
      update: audited("Contact edited", backend.parties.update),
    },
    properties: {
      ...backend.properties,
      createProperty: audited("Property created", backend.properties.createProperty),
      createUnit: audited("Unit created", backend.properties.createUnit),
      updateProperty: audited("Property edited", backend.properties.updateProperty),
    },
    payments: {
      ...backend.payments,
      async listLedger(filter) {
        const user = await getUser();
        if (filter?.leaseId && !canSeeLease(user, filter.leaseId)) return [];
        const leaseIds = scopedLeaseIds(user, filter?.leaseIds);
        if (leaseIds?.length === 0) return [];
        return scopeByLease(user, await backend.payments.listLedger({ ...filter, leaseIds }), (entry) => entry.leaseId);
      },
      async listObligations(id) {
        const user = await getUser();
        return scopeByLease(user, await backend.payments.listObligations(id), (entry) => entry.leaseId);
      },
      async inboxQueue() {
        const user = await getUser();
        return scopeByLease(user, await backend.payments.inboxQueue(), (entry) => entry.leaseId);
      },
      markPaid: audited("Rent marked paid", backend.payments.markPaid),
      unmarkPaid: audited("Rent payment reversed", backend.payments.unmarkPaid),
      markNextRentPaid: audited("Rent marked paid", backend.payments.markNextRentPaid),
    },
  };
}
