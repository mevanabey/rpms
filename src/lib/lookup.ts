import type { Lease, Party, PartyRole, Property, Unit } from "@/core/types";

/** Build O(1) lookup tables for joining list views. Cheap and stateless. */
export function partyMap(parties: Party[]): Map<string, Party> {
  return new Map(parties.map((p) => [p.id, p]));
}

export function propertyMap(properties: Property[]): Map<string, Property> {
  return new Map(properties.map((p) => [p.id, p]));
}

export function unitMap(units: Unit[]): Map<string, Unit> {
  return new Map(units.map((u) => [u.id, u]));
}

/** Resolve a party attached to a lease by its role (e.g. advisor, introducer). */
export function leasePartyByRole(
  lease: Lease | undefined,
  role: PartyRole,
  partyById: Map<string, Party>,
): Party | undefined {
  const ref = lease?.additionalRoles?.find((r) => r.role === role);
  return ref ? partyById.get(ref.partyId) : undefined;
}
