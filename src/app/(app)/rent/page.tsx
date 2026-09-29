import { RoleGate } from "@/components/app/role-gate";
import { leasePartyByRole, partyMap, propertyMap } from "@/lib/lookup";
import { getBackend } from "@/server/container";
import { requireResource } from "@/lib/auth/authorization";
import { scopeByLease } from "@/lib/demo/scope";

import { RentBoard, type RentRow } from "./_components/rent-board";

export default async function RentPage() {
  const user = await requireResource("payments:read");
  const backend = getBackend();
  const [allLedger, allLeases, parties, properties] = await Promise.all([
    backend.payments.listLedger({ kind: ["rent"] }),
    backend.leases.list(),
    backend.parties.list(),
    backend.properties.listProperties(),
  ]);
  const leases = scopeByLease(user, allLeases, (lease) => lease.id);
  const visibleIds = new Set(leases.map((lease) => lease.id));
  const ledger = allLedger.filter((entry) => visibleIds.has(entry.leaseId));

  const leaseById = new Map(leases.map((l) => [l.id, l]));
  const partyById = partyMap(parties);
  const propertyById = propertyMap(properties);

  // Only inbound rent rows reach the operator. Refunds / outbound stay out.
  const rows: RentRow[] = ledger
    .filter((e) => e.direction === "in")
    .map((entry) => {
      const lease = leaseById.get(entry.leaseId);
      const property = lease ? propertyById.get(lease.propertyId) : undefined;
      const tenant = lease ? partyById.get(lease.lesseePartyId) : undefined;
      const landlord = lease ? partyById.get(lease.lessorPartyId) : undefined;
      const advisor = leasePartyByRole(lease, "advisor", partyById);
      return {
        entry,
        lease,
        property,
        tenant,
        landlord,
        advisor,
      };
    })
    .sort((a, b) => a.entry.dueDate.localeCompare(b.entry.dueDate));

  return (
    <RoleGate required={["payments:read"]}>
      <RentBoard rows={rows} />
    </RoleGate>
  );
}
