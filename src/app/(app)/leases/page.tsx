import Link from "next/link";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LedgerEntry } from "@/core/types";
import { leasePartyByRole, partyMap, propertyMap } from "@/lib/lookup";
import { getBackend } from "@/server/container";
import { requireResource } from "@/lib/auth/authorization";
import { scopeByLease } from "@/lib/demo/scope";

import { DraftLeasesCard } from "./_components/draft-leases-card";
import { LeasesTable, type LeaseRow } from "./_components/leases-table";

export default async function LeasesPage() {
  const user = await requireResource("leases:read");
  const backend = getBackend();
  const [allLeases, parties, properties, allLedger] = await Promise.all([
    backend.leases.list(),
    backend.parties.list(),
    backend.properties.listProperties(),
    backend.payments.listLedger({ kind: ["rent"] }),
  ]);
  const leases = scopeByLease(user, allLeases, (lease) => lease.id);
  const visibleIds = new Set(leases.map((lease) => lease.id));
  const ledger = allLedger.filter((entry) => visibleIds.has(entry.leaseId));

  const partyById = partyMap(parties);
  const propertyById = propertyMap(properties);
  const nextRentByLease = new Map<string, LedgerEntry>();
  for (const e of ledger) {
    if (e.direction !== "in" || e.paidDate) continue;
    const cur = nextRentByLease.get(e.leaseId);
    if (!cur || e.dueDate < cur.dueDate) nextRentByLease.set(e.leaseId, e);
  }
  const leaseById = new Map(leases.map((l) => [l.id, l]));
  const rows: LeaseRow[] = leases.map((lease) => {
    const parent = lease.parentLeaseId ? leaseById.get(lease.parentLeaseId) : undefined;
    const parentTenant = parent ? partyById.get(parent.lesseePartyId) : undefined;
    return {
      lease,
      property: propertyById.get(lease.propertyId),
      lessor: partyById.get(lease.lessorPartyId),
      lessee: partyById.get(lease.lesseePartyId),
      advisor: leasePartyByRole(lease, "advisor", partyById),
      nextRentEntry: nextRentByLease.get(lease.id),
      parentLabel: parent
        ? parentTenant?.displayName ?? propertyById.get(parent.propertyId)?.name ?? parent.id
        : undefined,
    };
  });

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Leases</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {user.role === "admin" || user.role === "account_manager"
              ? "Every lease — head and sub — with parties, schedule, and status."
              : "Leases assigned to you."}
          </p>
        </div>
        {(user.role === "admin" || user.role === "account_manager") && <Button asChild>
          <Link href="/leases/new">
            <Plus className="size-4" />
            New lease
          </Link>
        </Button>}
      </div>

      {(user.role === "admin" || user.role === "account_manager") && <DraftLeasesCard />}

      <div data-onborda="leases-table">
        <LeasesTable rows={rows} />
      </div>
    </div>
  );
}
