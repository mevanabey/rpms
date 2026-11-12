import { can, DEFAULT_PERMISSIONS, hasRole } from "@/lib/demo/identity";
import Link from "next/link";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getBackend } from "@/server/container";
import { requireResource } from "@/lib/auth/authorization";
import { scopeByLease } from "@/lib/demo/scope";

import { DraftLeasesCard } from "./_components/draft-leases-card";
import { LeasesTable, type LeaseRow } from "./_components/leases-table";

export default async function LeasesPage() {
  const user = await requireResource("leases:read");
  const backend = getBackend();
  const overview = scopeByLease(user, await backend.leases.listOverview(), (row) => row.lease.id);
  const leaseById = new Map(overview.map((row) => [row.lease.id, row]));
  const rows: LeaseRow[] = overview.map((row) => {
    const parent = row.lease.parentLeaseId ? leaseById.get(row.lease.parentLeaseId) : undefined;
    return {
      ...row,
      parentLabel: parent ? parent.lessee?.displayName ?? parent.property?.name ?? parent.lease.id : undefined,
    };
  });

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Leases</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {hasRole(user, "admin")
              ? "Every lease — head and sub — with parties, schedule, and status."
              : "Leases assigned to you or created by you."}
          </p>
        </div>
        {(can(user, DEFAULT_PERMISSIONS, "leases:create")) && <Button asChild>
          <Link href="/leases/new">
            <Plus className="size-4" />
            New lease
          </Link>
        </Button>}
      </div>

      {(can(user, DEFAULT_PERMISSIONS, "leases:write")) && <DraftLeasesCard />}

      <div data-onborda="leases-table">
        <LeasesTable rows={rows} />
      </div>
    </div>
  );
}
