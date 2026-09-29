import { requireResource } from "@/lib/auth/authorization";
import Link from "next/link";

import { NewUnitButton } from "@/components/app/forms/new-unit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { propertyMap } from "@/lib/lookup";
import { getBackend } from "@/server/container";

import { DraftUnitsCard } from "./_components/draft-units-card";

export default async function UnitsPage() {
  await requireResource("units:read");
  const backend = getBackend();
  const [units, properties, leases] = await Promise.all([
    backend.properties.listUnits(),
    backend.properties.listProperties(),
    backend.leases.list(),
  ]);
  const propertyById = propertyMap(properties);

  // Compute the active lease for each unit (first lease that includes the unit)
  const unitLease = new Map<string, string>();
  for (const l of leases) {
    if (l.status === "draft" || l.status === "expired" || l.status === "terminated") continue;
    for (const uid of l.unitIds) {
      if (!unitLease.has(uid)) unitLease.set(uid, l.id);
    }
  }

  const totalCount = units.length;
  const occupied = units.filter((u) => u.status === "occupied").length;
  const vacant = totalCount - occupied;

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Units</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Floor / apartment / storage / penthouse subdivisions across all properties.
          </p>
        </div>
        <NewUnitButton properties={properties} />
      </div>

      <DraftUnitsCard properties={properties} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">{totalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Occupied</CardDescription>
            <CardTitle className="text-2xl">{occupied}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Vacant</CardDescription>
            <CardTitle className="text-2xl">{vacant}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Occupancy</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {totalCount === 0 ? 0 : Math.round((occupied / totalCount) * 100)}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead className="text-right">Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active lease</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <Link href={`/properties/${u.propertyId}`} className="hover:underline">
                      {propertyById.get(u.propertyId)?.name ?? u.propertyId}
                    </Link>
                  </TableCell>
                  <TableCell>{u.label}</TableCell>
                  <TableCell>{u.type}</TableCell>
                  <TableCell>{u.floor ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {u.areaSqft ? u.areaSqft.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{u.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {unitLease.get(u.id) ? (
                      <Link
                        href={`/leases/${unitLease.get(u.id)}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {unitLease.get(u.id)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
