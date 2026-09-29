import { notFound } from "next/navigation";
import Link from "next/link";

import { ArrowLeft, Mail, Phone } from "lucide-react";

import { DocumentsCard } from "@/components/app/documents-card";
import { LeaseStatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { propertyMap } from "@/lib/lookup";
import { formatDate } from "@/lib/utils";
import { getBackend } from "@/server/container";
import { requireResource } from "@/lib/auth/authorization";

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireResource("parties:read");
  const backend = getBackend();
  const party = await backend.parties.get(id);
  if (!party) notFound();

  const [leases, properties] = await Promise.all([
    backend.leases.list(),
    backend.properties.listProperties(),
  ]);
  const propertyById = propertyMap(properties);

  type Row = { lease: typeof leases[number]; role: string };
  const rows: Row[] = [];
  for (const l of leases) {
    if (l.lessorPartyId === id) rows.push({ lease: l, role: "lessor" });
    if (l.lesseePartyId === id) rows.push({ lease: l, role: "lessee" });
    for (const r of l.additionalRoles ?? []) {
      if (r.partyId === id) rows.push({ lease: l, role: r.role });
    }
  }
  const partyLeaseIds = Array.from(new Set(rows.map((r) => r.lease.id)));

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/parties">
            <ArrowLeft className="size-3.5" /> All parties
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-bold text-2xl tracking-tight">{party.displayName}</h1>
          <Badge variant="outline">{party.kind}</Badge>
        </div>
        {party.legalName && party.legalName !== party.displayName && (
          <p className="mt-1 text-muted-foreground text-sm">{party.legalName}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {(party.nicOrPassport || party.companyRegNo) && (
            <div className="font-mono text-muted-foreground text-xs">
              {party.nicOrPassport ?? party.companyRegNo}
            </div>
          )}
          {party.emails.map((e) => (
            <div key={e} className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Mail className="size-3" /> {e}
            </div>
          ))}
          {party.phones.map((p) => (
            <div key={p} className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Phone className="size-3" /> {p}
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leases</CardTitle>
          <CardDescription>
            {rows.length} lease(s) involve this party.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Lease</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ lease, role }) => (
                <TableRow key={`${lease.id}_${role}`}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {role.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/leases/${lease.id}`} className="font-mono text-xs hover:underline">
                      {lease.id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {propertyById.get(lease.propertyId)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {formatDate(lease.startDate)} → {formatDate(lease.endDate)}
                  </TableCell>
                  <TableCell>
                    <LeaseStatusBadge status={lease.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DocumentsCard
        partyId={party.id}
        partyLeaseIds={partyLeaseIds}
        description="KYC submissions, draft leases under review, and any other files raised in decisions involving this party."
        emptyState="No documents on file for this party yet."
      />
    </div>
  );
}
