import { getBackend } from "@/server/container";
import { requireResource } from "@/lib/auth/authorization";
import { getAssignableStaff } from "@/lib/auth/staff";

import { NewLeaseForm } from "./_components/new-lease-form";

export default async function NewLeasePage() {
  await requireResource("leases:create");
  const backend = getBackend();
  const [properties, units, parties, leases, staff] = await Promise.all([
    backend.properties.listProperties(),
    backend.properties.listUnits(),
    backend.parties.list(),
    backend.leases.list(),
    getAssignableStaff(),
  ]);
  const headLeases = leases.filter((l) => l.kind === "head");

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">New lease</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          One form, one submission — captures every row on the lawyer/handler intake
          checklist. Toggle on a paired sub-tenancy to capture a Master+Sub pair in one go.
        </p>
      </div>

      <NewLeaseForm
        properties={properties}
        units={units}
        parties={parties}
        headLeases={headLeases}
        staff={staff}
      />
    </div>
  );
}
