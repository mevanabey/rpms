import { requireResource } from "@/lib/auth/authorization";
import Link from "next/link";

import { MoneyDisplay } from "@/components/app/money-display";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Currency, LedgerEntry } from "@/core/types";
import { partyMap } from "@/lib/lookup";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getBackend } from "@/server/container";

const TODAY = "2026-05-05";

function aging(dueDate: string): { bucket: "0-7" | "8-30" | "31-90" | "90+"; days: number } {
  const days = Math.round(
    (new Date(TODAY).getTime() - new Date(dueDate).getTime()) / 86400000,
  );
  if (days <= 7) return { bucket: "0-7", days };
  if (days <= 30) return { bucket: "8-30", days };
  if (days <= 90) return { bucket: "31-90", days };
  return { bucket: "90+", days };
}

export default async function ArrearsPage() {
  await requireResource("reports:read");
  const backend = getBackend();
  const [ledger, leases, parties] = await Promise.all([
    backend.payments.listLedger({ paid: false }),
    backend.leases.list(),
    backend.parties.list(),
  ]);

  const overdue = ledger.filter((e) => e.dueDate < TODAY);
  const leaseById = new Map(leases.map((l) => [l.id, l]));
  const partyById = partyMap(parties);

  const buckets: Record<"0-7" | "8-30" | "31-90" | "90+", LedgerEntry[]> = {
    "0-7": [],
    "8-30": [],
    "31-90": [],
    "90+": [],
  };
  for (const e of overdue) buckets[aging(e.dueDate).bucket].push(e);

  const totals: Record<Currency, number> = { LKR: 0, USD: 0 };
  for (const e of overdue) totals[e.amount.currency] += e.amount.amount;

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Arrears</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Late and unpaid rent across the portfolio · snapshot{" "}
          <span className="font-mono">{TODAY}</span>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <BucketCard label="0 – 7 days" count={buckets["0-7"].length} />
        <BucketCard label="8 – 30 days" count={buckets["8-30"].length} />
        <BucketCard label="31 – 90 days" count={buckets["31-90"].length} />
        <BucketCard label="90+ days" count={buckets["90+"].length} accent="rose" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Total overdue (LKR)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrency(totals.LKR, { currency: "LKR", noDecimals: true })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total overdue (USD)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrency(totals.USD, { currency: "USD", noDecimals: true })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overdue ledger entries</CardTitle>
          <CardDescription>{overdue.length} entries past due as of today.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Due</TableHead>
                <TableHead>Aging</TableHead>
                <TableHead>Lease</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground text-sm">
                    No arrears.
                  </TableCell>
                </TableRow>
              )}
              {overdue
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                .map((e) => {
                  const a = aging(e.dueDate);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="tabular-nums">{formatDate(e.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                          {a.days}d · {a.bucket}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/leases/${e.leaseId}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {e.leaseId}
                        </Link>
                      </TableCell>
                      <TableCell>{partyById.get(e.counterpartyPartyId)?.displayName ?? "—"}</TableCell>
                      <TableCell className="text-xs">{e.kind.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <MoneyDisplay amount={e.amount} />
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

function BucketCard({ label, count, accent }: { label: string; count: number; accent?: "rose" }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-2xl ${accent === "rose" ? "text-rose-700 dark:text-rose-300" : ""}`}>
          {count}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
