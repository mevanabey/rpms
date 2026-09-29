import { requireResource } from "@/lib/auth/authorization";
import Link from "next/link";

import { Coins } from "lucide-react";

import { MoneyDisplay } from "@/components/app/money-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Lease, Party } from "@/core/types";
import { partyMap } from "@/lib/lookup";
import { formatCurrency } from "@/lib/utils";
import { getBackend } from "@/server/container";

// Commission rule (placeholder until per-lease rules wire up): 1 month rent, paid once.
const DEFAULT_COMMISSION_FRACTION = 1;

type IntroducerRow = {
  introducer: Party;
  leases: Lease[];
  accruedLkr: number;
  accruedUsd: number;
};

export default async function CommissionsPage() {
  await requireResource("commissions:read");
  const backend = getBackend();
  const [leases, parties] = await Promise.all([backend.leases.list(), backend.parties.list()]);
  const partyById = partyMap(parties);

  const byIntroducer = new Map<string, IntroducerRow>();
  for (const l of leases) {
    const intro = l.additionalRoles?.find((r) => r.role === "introducer");
    if (!intro) continue;
    const introducer = partyById.get(intro.partyId);
    if (!introducer) continue;
    const r = byIntroducer.get(introducer.id) ?? {
      introducer,
      leases: [],
      accruedLkr: 0,
      accruedUsd: 0,
    };
    r.leases.push(l);
    const t = l.tranches[0];
    if (t) {
      const accrued = t.monthlyRent.amount * DEFAULT_COMMISSION_FRACTION;
      if (t.monthlyRent.currency === "LKR") r.accruedLkr += accrued;
      else r.accruedUsd += accrued;
    }
    byIntroducer.set(introducer.id, r);
  }

  const rows = Array.from(byIntroducer.values()).sort(
    (a, b) => b.leases.length - a.leases.length,
  );

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Introducer commissions</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Accrued per introducer · default rule: <span className="font-mono">1× monthly rent at lease start</span>.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled>
          Run payout batch
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Introducers</CardTitle>
          <CardDescription>{rows.length} introducer(s) on the books.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Introducer</TableHead>
                <TableHead className="text-right">Leases</TableHead>
                <TableHead className="text-right">Accrued (LKR)</TableHead>
                <TableHead className="text-right">Accrued (USD)</TableHead>
                <TableHead>Latest leases</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground text-sm">
                    No introducers found.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.introducer.id}>
                  <TableCell>
                    <Link href={`/parties/${r.introducer.id}`} className="font-medium hover:underline">
                      {r.introducer.displayName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.leases.length}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.accruedLkr ? formatCurrency(r.accruedLkr, { currency: "LKR", noDecimals: true }) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.accruedUsd ? formatCurrency(r.accruedUsd, { currency: "USD", noDecimals: true }) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.leases.slice(0, 4).map((l) => (
                        <Link key={l.id} href={`/leases/${l.id}`}>
                          <Badge variant="outline" className="font-mono text-xs hover:bg-muted">
                            {l.id.replace(/^lease_/, "")}
                          </Badge>
                        </Link>
                      ))}
                      {r.leases.length > 4 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          +{r.leases.length - 4}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 text-muted-foreground text-xs">
          <Coins className="size-4 shrink-0" />
          <div>
            Phase 02 wires per-lease commission rules (one-off vs monthly), accrual against
            paid rent ledger, and the payout batch workflow.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
