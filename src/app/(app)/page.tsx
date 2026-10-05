import { can, DEFAULT_PERMISSIONS } from "@/lib/demo/identity";
import Link from "next/link";

import {
  CalendarClock,
  CheckCircle2,
  FileSignature,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LiveDot } from "@/components/ui/live-dot";
import type { Currency } from "@/core/types";
import { leasePartyByRole, partyMap, propertyMap } from "@/lib/lookup";
import { formatCurrency } from "@/lib/utils";
import { getBackend } from "@/server/container";
import { requireAppUser } from "@/lib/auth/identity";
import { scopeByLease } from "@/lib/demo/scope";
import { recentLeaseAudit } from "@/server/audit";
import { LeaseAuditHistory } from "@/components/app/lease-audit-history";

import { RentBoard, type RentRow } from "./rent/_components/rent-board";

const DUE_SOON_WINDOW_DAYS = 14;

function emptyByCurrency(): Record<Currency, number> {
  return { LKR: 0, USD: 0 };
}

function formatLkrUsd(totals: Record<Currency, number>): string {
  return `${formatCurrency(totals.LKR, { currency: "LKR", noDecimals: true })} · ${formatCurrency(totals.USD, { currency: "USD", noDecimals: true })}`;
}

export default async function Home() {
  const TODAY = new Date().toISOString().slice(0, 10);
  const user = await requireAppUser();
  const activity = await recentLeaseAudit(6);
  const canViewRent = can(user, DEFAULT_PERMISSIONS, "payments:read");
  const backend = getBackend();
  const [allLeases, allParties, allProperties, allLedger] = await Promise.all([
    backend.leases.list(),
    backend.parties.list(),
    backend.properties.listProperties(),
    canViewRent ? backend.payments.listLedger({ kind: ["rent"] }) : Promise.resolve([]),
  ]);
  const leases = scopeByLease(user, allLeases, (lease) => lease.id);
  const visibleIds = new Set(leases.map((lease) => lease.id));
  const ledger = allLedger.filter((entry) => visibleIds.has(entry.leaseId));
  const propertyIds = new Set(leases.map((lease) => lease.propertyId));
  const properties = allProperties.filter((property) => propertyIds.has(property.id));
  const partyIds = new Set(leases.flatMap((lease) => [
    lease.lessorPartyId, lease.lesseePartyId,
    ...(lease.additionalRoles ?? []).map((role) => role.partyId),
  ]));
  const parties = allParties.filter((party) => partyIds.has(party.id));

  const activeLeases = leases.filter(
    (l) => l.status === "active" || l.status === "signed" || l.status === "grace",
  );

  const todayTs = new Date(TODAY).getTime();
  const dueSoonCutoff = todayTs + DUE_SOON_WINDOW_DAYS * 86_400_000;
  const monthPrefix = TODAY.slice(0, 7); // "YYYY-MM"

  const overdueTotals = emptyByCurrency();
  const dueSoonTotals = emptyByCurrency();
  const paidThisMonthTotals = emptyByCurrency();
  let overdueCount = 0;
  let dueSoonCount = 0;
  let paidThisMonthCount = 0;

  for (const e of ledger) {
    if (e.direction !== "in") continue;
    if (e.paidDate) {
      if (e.paidDate.startsWith(monthPrefix)) {
        paidThisMonthTotals[e.amount.currency] += e.amount.amount;
        paidThisMonthCount += 1;
      }
      continue;
    }
    if (e.dueDate < TODAY) {
      overdueTotals[e.amount.currency] += e.amount.amount;
      overdueCount += 1;
    } else if (new Date(e.dueDate).getTime() <= dueSoonCutoff) {
      dueSoonTotals[e.amount.currency] += e.amount.amount;
      dueSoonCount += 1;
    }
  }

  const KPIS = [
    {
      label: "Active leases",
      value: activeLeases.length,
      sub: `${leases.length} total · ${properties.length} buildings · ${parties.length} parties`,
      icon: FileSignature,
      href: "/leases",
    },
    {
      label: "Overdue",
      value: overdueCount,
      sub: formatLkrUsd(overdueTotals),
      icon: TrendingUp,
      href: "/rent",
    },
    {
      label: "Due in 14 days",
      value: dueSoonCount,
      sub: formatLkrUsd(dueSoonTotals),
      icon: CalendarClock,
      href: "/rent",
    },
    {
      label: "Paid this month",
      value: paidThisMonthCount,
      sub: formatLkrUsd(paidThisMonthTotals),
      icon: CheckCircle2,
      href: "/rent",
    },
  ].filter((k) => canViewRent || k.label === "Active leases");

  const leaseById = new Map(leases.map((l) => [l.id, l]));
  const partyById = partyMap(parties);
  const propertyById = propertyMap(properties);
  const rentRows: RentRow[] = ledger
    .filter((e) => e.direction === "in")
    .map((entry) => {
      const lease = leaseById.get(entry.leaseId);
      const property = lease ? propertyById.get(lease.propertyId) : undefined;
      const tenant = lease ? partyById.get(lease.lesseePartyId) : undefined;
      const landlord = lease ? partyById.get(lease.lessorPartyId) : undefined;
      const advisor = leasePartyByRole(lease, "advisor", partyById);
      return { entry, lease, property, tenant, landlord, advisor };
    })
    .sort((a, b) => a.entry.dueDate.localeCompare(b.entry.dueDate));

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div data-onborda="dashboard-title">
          <h1 className="flex items-center gap-2 font-bold text-2xl tracking-tight">
            Overview
            <LiveDot tone="live" />
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            The system runs in the background. You step in only when it asks.
            Snapshot <span className="font-mono">{TODAY}</span>.
          </p>
        </div>
        {(can(user, DEFAULT_PERMISSIONS, "leases:write")) && <Button asChild variant="outline" size="sm">
          <Link href="/leases/new">
            <Sparkles className="size-3.5" /> Onboard new tenant
          </Link>
        </Button>}
      </div>

      <div
        data-onborda="dashboard-kpis"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {KPIS.map((k) => (
          <Link key={k.label} href={k.href}>
            <Card className="h-full transition-colors hover:bg-muted/30">
              <CardHeader>
                <CardDescription className="flex items-center gap-2">
                  <k.icon className="size-4" />
                  {k.label}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{k.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs tabular-nums">{k.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {canViewRent && <div data-onborda="dashboard-leases">
        <RentBoard rows={rentRows} showHeader={false} showSummary={false} />
      </div>}
      <Card><CardHeader><CardTitle>Recent lease activity</CardTitle><CardDescription>Recorded changes to leases you can access.</CardDescription></CardHeader><CardContent><LeaseAuditHistory entries={activity} showLease /><Button variant="link" asChild><Link href="/activity">View full activity log</Link></Button></CardContent></Card>
    </div>
  );
}
