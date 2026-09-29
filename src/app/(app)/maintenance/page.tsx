import { requireResource } from "@/lib/auth/authorization";
import { AlertTriangle, CheckCircle2, ListChecks, Wrench } from "lucide-react";

import { NewTicketButton } from "@/components/app/forms/new-ticket-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBackend } from "@/server/container";

import { TicketsList } from "./_components/tickets-list";
import { MaintenanceStats } from "./_components/maintenance-stats";

export default async function MaintenancePage() {
  await requireResource("maintenance:read");
  const backend = getBackend();
  const [properties, units] = await Promise.all([
    backend.properties.listProperties(),
    backend.properties.listUnits(),
  ]);

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Maintenance</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Tickets per property and unit. Auto-cap at Rs. 75,000 / job / floor for lessee-side
            running maintenance (Lucky Seven §4(m)).
          </p>
        </div>
        <NewTicketButton properties={properties} units={units} />
      </div>

      <MaintenanceStats />

      <TicketsList properties={properties} units={units} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="size-4" /> Spending caps from the lease
          </CardTitle>
          <CardDescription>
            Driving rules that determine when a ticket needs a human approval gate.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground text-xs">Tenant-side running maintenance</div>
            <div className="mt-1 font-medium">Rs. 75,000 per job, per floor</div>
            <div className="mt-1 text-muted-foreground text-xs">
              Tickets within this cap can auto-progress to vendor assignment without
              additional approvals.
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground text-xs">Landlord-side structural repairs</div>
            <div className="mt-1 font-medium">No cap; landlord&apos;s vendor</div>
            <div className="mt-1 text-muted-foreground text-xs">
              Lift, generator, fire — categories handled by the building owner. The
              compliance scheduler raises these automatically.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
