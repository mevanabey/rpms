import Link from "next/link";

import { Building2 } from "lucide-react";

import { NewPropertyButton } from "@/components/app/forms/new-property-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBackend } from "@/server/container";

import { DraftPropertiesCard } from "./_components/draft-properties-card";

export default async function PropertiesPage() {
  const backend = getBackend();
  const [properties, allUnits, allLeases] = await Promise.all([
    backend.properties.listProperties(),
    backend.properties.listUnits(),
    backend.leases.list(),
  ]);

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Properties</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Buildings under management. Click through for units and active leases.
          </p>
        </div>
        <NewPropertyButton />
      </div>

      <DraftPropertiesCard />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {properties.map((p) => {
          const units = allUnits.filter((u) => u.propertyId === p.id);
          const leases = allLeases.filter((l) => l.propertyId === p.id);
          const occupied = units.filter((u) => u.status === "occupied").length;
          const occupancy =
            units.length === 0 ? 0 : Math.round((occupied / units.length) * 100);
          return (
            <Link key={p.id} href={`/properties/${p.id}`} className="block">
              <Card className="h-full transition-colors hover:bg-muted/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <CardDescription className="mt-1">{p.addressLine}</CardDescription>
                    </div>
                    <Building2 className="size-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono">
                    {units.length} units
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    {leases.length} leases
                  </Badge>
                  <Badge
                    variant="outline"
                    className="ml-auto font-mono tabular-nums"
                  >
                    {occupancy}% occupied
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
