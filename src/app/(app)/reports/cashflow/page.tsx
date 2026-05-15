import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Currency } from "@/core/types";
import { formatCurrency } from "@/lib/utils";
import { getBackend } from "@/server/container";

import { CashflowChart } from "./_components/cashflow-chart";

const TODAY = "2026-05-05";

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function monthsRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(start + "-01");
  const stop = new Date(end + "-01");
  while (cur <= stop) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

export default async function CashflowPage() {
  const backend = getBackend();
  const ledger = await backend.payments.listLedger();

  const range = monthsRange("2025-06", "2026-12");
  const series: Record<Currency, Map<string, { in: number; out: number }>> = {
    LKR: new Map(range.map((m) => [m, { in: 0, out: 0 }])),
    USD: new Map(range.map((m) => [m, { in: 0, out: 0 }])),
  };

  for (const e of ledger) {
    const m = monthKey(e.dueDate);
    if (!series[e.amount.currency].has(m)) continue;
    const cur = series[e.amount.currency].get(m)!;
    if (e.direction === "in") cur.in += e.amount.amount;
    else cur.out += e.amount.amount;
  }

  const lkrPoints = range.map((m) => {
    const { in: i, out } = series.LKR.get(m)!;
    return { month: m, in: i, out, net: i - out };
  });
  const usdPoints = range.map((m) => {
    const { in: i, out } = series.USD.get(m)!;
    return { month: m, in: i, out, net: i - out };
  });

  const totalLkr = lkrPoints.reduce((acc, p) => acc + p.net, 0);
  const totalUsd = usdPoints.reduce((acc, p) => acc + p.net, 0);

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Cashflow</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Monthly cash in/out · snapshot <span className="font-mono">{TODAY}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Net cashflow (LKR, range)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrency(totalLkr, { currency: "LKR", noDecimals: true })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Net cashflow (USD, range)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrency(totalUsd, { currency: "USD", noDecimals: true })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <CashflowChart data={lkrPoints} currency="LKR" />
      <CashflowChart data={usdPoints} currency="USD" />
    </div>
  );
}
