import Link from "next/link";

import { Mail, Phone } from "lucide-react";

import { NewPartyButton } from "@/components/app/forms/new-party-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Lease, Party, PartyRole } from "@/core/types";
import { getBackend } from "@/server/container";

import { DraftPartiesCard } from "./_components/draft-parties-card";

const ROLE_PRIORITY: PartyRole[] = [
  "lessor",
  "lessee",
  "tenant",
  "client",
  "introducer",
  "accountant_handler",
  "advisor",
  "lessor_lawyer",
  "lessee_lawyer",
  "witness",
];

function rolesForParty(party: Party, leases: Lease[]): PartyRole[] {
  const roles = new Set<PartyRole>();
  for (const l of leases) {
    if (l.lessorPartyId === party.id) roles.add("lessor");
    if (l.lesseePartyId === party.id) roles.add("lessee");
    for (const r of l.additionalRoles ?? []) {
      if (r.partyId === party.id) roles.add(r.role);
    }
  }
  return ROLE_PRIORITY.filter((r) => roles.has(r));
}

function leasesForParty(party: Party, leases: Lease[]): number {
  return leases.filter((l) => {
    if (l.lessorPartyId === party.id || l.lesseePartyId === party.id) return true;
    return l.additionalRoles?.some((r) => r.partyId === party.id) ?? false;
  }).length;
}

export default async function PartiesPage() {
  const backend = getBackend();
  const [parties, leases] = await Promise.all([
    backend.parties.list(),
    backend.leases.list(),
  ]);

  // Sort: companies first, then by display name
  const sorted = [...parties].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "company" ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  const tenantCount = parties.filter((p) =>
    leases.some((l) => l.additionalRoles?.some((r) => r.partyId === p.id && r.role === "tenant")),
  ).length;
  const landlordCount = parties.filter((p) =>
    leases.some((l) => l.lessorPartyId === p.id),
  ).length;

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Parties</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Unified directory — landlords, tenants, lessees, introducers, lawyers, handlers.
          </p>
        </div>
        <NewPartyButton />
      </div>

      <DraftPartiesCard />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total parties</CardDescription>
            <CardTitle className="text-2xl">{parties.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Landlords</CardDescription>
            <CardTitle className="text-2xl">{landlordCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Tenants</CardDescription>
            <CardTitle className="text-2xl">{tenantCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Companies</CardDescription>
            <CardTitle className="text-2xl">
              {parties.filter((p) => p.kind === "company").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>ID / Reg no.</TableHead>
                <TableHead>Roles on leases</TableHead>
                <TableHead className="text-right">Leases</TableHead>
                <TableHead>Contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => {
                const roles = rolesForParty(p, leases);
                const count = leasesForParty(p, leases);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/parties/${p.id}`} className="font-medium hover:underline">
                        {p.displayName}
                      </Link>
                      {p.legalName && p.legalName !== p.displayName && (
                        <div className="text-muted-foreground text-xs">{p.legalName}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.kind}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      {p.nicOrPassport ?? p.companyRegNo ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {roles.length === 0 ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          roles.map((r) => (
                            <Badge key={r} variant="outline" className="text-xs">
                              {r.replace(/_/g, " ")}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{count}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        {p.emails.slice(0, 1).map((e) => (
                          <div key={e} className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="size-3" /> {e}
                          </div>
                        ))}
                        {p.phones.slice(0, 1).map((ph) => (
                          <div key={ph} className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="size-3" /> {ph}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
