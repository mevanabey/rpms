import { notFound } from "next/navigation";
import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import { LeaseStatusBadge } from "@/components/app/status-badge";
import { MoneyDisplay } from "@/components/app/money-display";
import { SectionHeader } from "@/components/app/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { partyMap } from "@/lib/lookup";
import { formatDate } from "@/lib/utils";
import { getBackend } from "@/server/container";
import { requireResource } from "@/lib/auth/authorization";

import { PropertyUnitsSection } from "./_components/property-units-section";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireResource("properties:read");
  const backend = getBackend();
  const property = await backend.properties.getProperty(id);
  if (!property) notFound();

  const [units, leases, parties, allProperties] = await Promise.all([
    backend.properties.listUnits(id),
    backend.leases.list({ propertyId: id }),
    backend.parties.list(),
    backend.properties.listProperties(),
  ]);
  const partyById = partyMap(parties);

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/properties">
            <ArrowLeft className="size-3.5" /> All properties
          </Link>
        </Button>
        <h1 className="font-bold text-2xl tracking-tight">{property.name}</h1>
        <p className="mt-1 text-muted-foreground text-sm">{property.addressLine}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-muted-foreground text-xs">
          {property.lotNo && <span>Lot {property.lotNo}</span>}
          {property.planNo && <span>Plan {property.planNo}</span>}
          {property.perches && <span>{property.perches} perches</span>}
          {property.asstNo && <span>Asst No. {property.asstNo}</span>}
        </div>
      </div>

      <PropertyUnitsSection
        property={property}
        units={units}
        properties={allProperties}
      />

      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Leases"
          description={`${leases.length} lease(s) covering this property.`}
        />
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lease</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Landlord</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-right">Monthly rental</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground text-sm"
                    >
                      No leases on this property yet.
                    </TableCell>
                  </TableRow>
                )}
                {leases.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link href={`/leases/${l.id}`} className="font-mono text-xs hover:underline">
                        {l.id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.kind}</Badge>
                    </TableCell>
                    <TableCell>{partyById.get(l.lessorPartyId)?.displayName ?? "—"}</TableCell>
                    <TableCell>{partyById.get(l.lesseePartyId)?.displayName ?? "—"}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {formatDate(l.startDate)} → {formatDate(l.endDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MoneyDisplay amount={l.tranches[0]?.monthlyRent} />
                    </TableCell>
                    <TableCell>
                      <LeaseStatusBadge status={l.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
