import Link from "next/link";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LedgerEntry } from "@/core/types";
import { partyMap, propertyMap } from "@/lib/lookup";
import { getBackend } from "@/server/container";

import { DraftLeasesCard } from "./_components/draft-leases-card";
import { LeasesTable, type LeaseRow } from "./_components/leases-table";

export default async function LeasesPage() {
  const backend = getBackend();
  const [leases, parties, properties, ledger] = await Promise.all([
    backend.leases.list(),
    backend.parties.list(),
    backend.properties.listProperties(),
    backend.payments.listLedger({ kind: ["rent"] }),
  ]);

  const partyById = partyMap(parties);
  const propertyById = propertyMap(properties);
  const nextRentByLease = new Map<string, LedgerEntry>();
  for (const e of ledger) {
    if (e.direction !== "in" || e.paidDate) continue;
    const cur = nextRentByLease.get(e.leaseId);
    if (!cur || e.dueDate < cur.dueDate) nextRentByLease.set(e.leaseId, e);
  }
  const rows: LeaseRow[] = leases.map((lease) => ({
    lease,
    property: propertyById.get(lease.propertyId),
    lessor: partyById.get(lease.lessorPartyId),
    lessee: partyById.get(lease.lesseePartyId),
    nextRentEntry: nextRentByLease.get(lease.id),
  }));

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Leases</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Every lease — head and sub — with parties, schedule, and status.
          </p>
        </div>
        <Button asChild>
          <Link href="/leases/new">
            <Plus className="size-4" />
            New lease
          </Link>
        </Button>
      </div>

      <DraftLeasesCard />

      <div data-onborda="leases-table">
        <LeasesTable rows={rows} />
      </div>
    </div>
  );
}
