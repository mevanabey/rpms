import "server-only";

import type { Backend } from "@/core/services";
import { requireAppUser } from "@/lib/auth/identity";
import { canSeeLease, scopeByLease } from "@/lib/demo/scope";
import { withAudit } from "@/server/db/client";

/** Apply scoping before any service result reaches a page, export, or action.
 * Actors come from the verified session, never a client-supplied user ID. */
export function secureBackend(backend: Backend): Backend {
  function audited<A extends unknown[], R>(action: string, operation: (...args: A) => Promise<R>) {
    return async (...args: A): Promise<R> => {
      const actor = await requireAppUser();
      return withAudit(actor, action, () => operation(...args));
    };
  }
  return {
    ...backend,
    leases: {
      ...backend.leases,
      async list(filter) {
        const user = await requireAppUser();
        return scopeByLease(user, await backend.leases.list(filter), (lease) => lease.id);
      },
      async get(id) {
        const user = await requireAppUser();
        return canSeeLease(user, id) ? backend.leases.get(id) : null;
      },
      create: audited("Lease created", backend.leases.create),
      update: audited("Lease edited", backend.leases.update),
      updateStatus: audited("Lease status changed", backend.leases.updateStatus),
      updateTranche: audited("Rent terms edited", backend.leases.updateTranche),
      softDelete: audited("Lease deleted", backend.leases.softDelete),
      attachSignedLease: audited("Signed lease uploaded", backend.leases.attachSignedLease),
      setOnboardingStage: audited("Lease workflow stage changed", backend.leases.setOnboardingStage),
      markAgreementGenerated: audited("Lease agreement saved", backend.leases.markAgreementGenerated),
      markLeaseEmailSent: audited("Lease email sent", backend.leases.markLeaseEmailSent),
      markLeaseActive: audited("Lease activated", backend.leases.markLeaseActive),
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
        const user = await requireAppUser();
        return scopeByLease(user, await backend.payments.listLedger(filter), (entry) => entry.leaseId);
      },
      async listObligations(id) {
        const user = await requireAppUser();
        return scopeByLease(user, await backend.payments.listObligations(id), (entry) => entry.leaseId);
      },
      async inboxQueue() {
        const user = await requireAppUser();
        return scopeByLease(user, await backend.payments.inboxQueue(), (entry) => entry.leaseId);
      },
      markPaid: audited("Rent marked paid", backend.payments.markPaid),
      unmarkPaid: audited("Rent payment reversed", backend.payments.unmarkPaid),
      markNextRentPaid: audited("Rent marked paid", backend.payments.markNextRentPaid),
    },
  };
}
