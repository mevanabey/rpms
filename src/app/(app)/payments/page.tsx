import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Currency } from "@/core/types";
import { partyMap } from "@/lib/lookup";
import { formatCurrency } from "@/lib/utils";
import { getBackend } from "@/server/container";

import { PaymentsTable, type PaymentRow } from "./_components/payments-table";

export default async function PaymentsPage() {
  const backend = getBackend();
  const [ledger, leases, parties] = await Promise.all([
    backend.payments.listLedger(),
    backend.leases.list(),
    backend.parties.list(),
  ]);

  const leaseById = new Map(leases.map((l) => [l.id, l]));
  const partyById = partyMap(parties);

  const rows: PaymentRow[] = [...ledger]
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .map((entry) => ({
      entry,
      lease: leaseById.get(entry.leaseId),
      counterparty: partyById.get(entry.counterpartyPartyId),
    }));

  const totals: Record<Currency, { in: number; out: number; due: number }> = {
    LKR: { in: 0, out: 0, due: 0 },
    USD: { in: 0, out: 0, due: 0 },
  };
  for (const e of ledger) {
    const c = e.amount.currency;
    if (e.paidDate) {
      if (e.direction === "in") totals[c].in += e.amount.amount;
      else totals[c].out += e.amount.amount;
    } else {
      totals[c].due += e.amount.amount;
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Payments</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Every rent receipt, deposit, stamp duty, late fee, refund, commission.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Collected (LKR)</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(totals.LKR.in, { currency: "LKR", noDecimals: true })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Collected (USD)</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(totals.USD.in, { currency: "USD", noDecimals: true })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Outstanding (LKR)</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(totals.LKR.due, { currency: "LKR", noDecimals: true })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Outstanding (USD)</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(totals.USD.due, { currency: "USD", noDecimals: true })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <PaymentsTable rows={rows} />
    </div>
  );
}
