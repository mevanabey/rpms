import Link from "next/link";

import { MoneyDisplay } from "@/components/app/money-display";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Lease, RentScheduleTranche } from "@/core/types";
import { propertyMap } from "@/lib/lookup";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getBackend } from "@/server/container";

const TODAY = "2026-05-05";
const HORIZON_YEARS = 12;

type EscalationRow = {
  lease: Lease;
  fromTranche?: RentScheduleTranche;
  toTranche: RentScheduleTranche;
  startDate: string;
  pctChange?: number;
};

export default async function EscalationsPage() {
  const backend = getBackend();
  const [leases, properties] = await Promise.all([
    backend.leases.list(),
    backend.properties.listProperties(),
  ]);
  const propertyById = propertyMap(properties);

  const cutoff = new Date(TODAY);
  cutoff.setFullYear(cutoff.getFullYear() + HORIZON_YEARS);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const rows: EscalationRow[] = [];
  for (const l of leases) {
    if (l.tranches.length < 2) continue;
    for (let i = 1; i < l.tranches.length; i++) {
      const to = l.tranches[i];
      if (to.startDate < TODAY || to.startDate > cutoffIso) continue;
      const from = l.tranches[i - 1];
      const pct =
        from.monthlyRent.currency === to.monthlyRent.currency
          ? ((to.monthlyRent.amount - from.monthlyRent.amount) / from.monthlyRent.amount) * 100
          : undefined;
      rows.push({ lease: l, fromTranche: from, toTranche: to, startDate: to.startDate, pctChange: pct });
    }
  }
  rows.sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Escalations</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Upcoming rent escalation boundaries across head leases — next {HORIZON_YEARS} years.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Upcoming escalations</CardDescription>
            <CardTitle className="text-2xl">{rows.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Affected leases</CardDescription>
            <CardTitle className="text-2xl">
              {new Set(rows.map((r) => r.lease.id)).size}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Earliest</CardDescription>
            <CardTitle className="text-xl">
              {rows[0] ? formatDate(rows[0].startDate) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Effective</TableHead>
                <TableHead>Lease</TableHead>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">From</TableHead>
                <TableHead className="text-right">To</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead>Period window</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-sm">
                    No escalations within the next {HORIZON_YEARS} years.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={`${r.lease.id}_${r.toTranche.id}`}>
                  <TableCell className="tabular-nums">{formatDate(r.startDate)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/leases/${r.lease.id}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {r.lease.id}
                    </Link>
                  </TableCell>
                  <TableCell>{propertyById.get(r.lease.propertyId)?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    <MoneyDisplay amount={r.fromTranche?.monthlyRent} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MoneyDisplay amount={r.toTranche.monthlyRent} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.pctChange !== undefined ? (
                      <Badge variant="outline" className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        +{r.pctChange.toFixed(1)}%
                      </Badge>
                    ) : (
                      <Badge variant="outline">currency change</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {formatDate(r.toTranche.startDate)} → {formatDate(r.toTranche.endDate)}
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
