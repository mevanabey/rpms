import { requireResource } from "@/lib/auth/authorization";
import Link from "next/link";

import { LeaseStatusBadge } from "@/components/app/status-badge";
import { MoneyDisplay } from "@/components/app/money-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Currency, Lease, RentScheduleTranche } from "@/core/types";
import { partyMap, propertyMap } from "@/lib/lookup";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getBackend } from "@/server/container";

const TODAY = "2026-05-05";

function activeTranche(lease: Lease): RentScheduleTranche | undefined {
  return (
    lease.tranches.find((t) => t.startDate <= TODAY && TODAY <= t.endDate) ?? lease.tranches[0]
  );
}

export default async function RentRollPage() {
  await requireResource("reports:read");
  const backend = getBackend();
  const [leases, properties, parties, ledger] = await Promise.all([
    backend.leases.list(),
    backend.properties.listProperties(),
    backend.parties.list(),
    backend.payments.listLedger(),
  ]);

  const propertyById = propertyMap(properties);
  const partyById = partyMap(parties);

  const active = leases.filter(
    (l) => l.status === "active" || l.status === "signed" || l.status === "grace",
  );

  // Per-currency totals of current monthly rent
  const monthly: Record<Currency, number> = { LKR: 0, USD: 0 };
  for (const l of active) {
    const t = activeTranche(l);
    if (t) monthly[t.monthlyRent.currency] += t.monthlyRent.amount;
  }

  // Paid-to-date per lease
  const paidByLease = new Map<string, Record<Currency, number>>();
  for (const e of ledger) {
    if (e.kind !== "rent" || !e.paidDate) continue;
    const cur = paidByLease.get(e.leaseId) ?? { LKR: 0, USD: 0 };
    cur[e.amount.currency] += e.amount.amount;
    paidByLease.set(e.leaseId, cur);
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Rent roll</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            All active leases · current tranche rent · paid-to-date · snapshot{" "}
            <span className="font-mono">{TODAY}</span>.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled>
          Export PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Active leases</CardDescription>
            <CardTitle className="text-2xl">{active.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Monthly rental (LKR)</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(monthly.LKR, { currency: "LKR", noDecimals: true })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Monthly rental (USD)</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(monthly.USD, { currency: "USD", noDecimals: true })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Annualised (USD)</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(monthly.USD * 12, { currency: "USD", noDecimals: true })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lease</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead className="text-right">Monthly rental</TableHead>
                <TableHead>Payment frequency</TableHead>
                <TableHead className="text-right">Paid (LKR)</TableHead>
                <TableHead className="text-right">Paid (USD)</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((l) => {
                const t = activeTranche(l);
                const paid = paidByLease.get(l.id) ?? { LKR: 0, USD: 0 };
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link
                        href={`/leases/${l.id}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {l.id}
                      </Link>
                    </TableCell>
                    <TableCell>{propertyById.get(l.propertyId)?.name ?? "—"}</TableCell>
                    <TableCell>{partyById.get(l.lesseePartyId)?.displayName ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MoneyDisplay amount={t?.monthlyRent} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {l.paymentCadence}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {paid.LKR ? formatCurrency(paid.LKR, { currency: "LKR", noDecimals: true }) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {paid.USD ? formatCurrency(paid.USD, { currency: "USD", noDecimals: true }) : "—"}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {formatDate(l.startDate)} → {formatDate(l.endDate)}
                    </TableCell>
                    <TableCell>
                      <LeaseStatusBadge status={l.status} />
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
