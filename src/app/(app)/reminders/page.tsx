import { requireResource } from "@/lib/auth/authorization";
import Link from "next/link";

import { Bell, Mail, MessageSquare, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Lease, Obligation, Party } from "@/core/types";
import { partyMap } from "@/lib/lookup";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getBackend } from "@/server/container";

const TODAY = "2026-05-05";

function daysUntil(dueDate: string): number {
  return Math.round(
    (new Date(dueDate).getTime() - new Date(TODAY).getTime()) / 86400000,
  );
}

function urgency(days: number): { label: string; tone: string } {
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200" };
  if (days <= 1) return { label: "Today", tone: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200" };
  if (days <= 7) return { label: `${days}d`, tone: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" };
  return { label: `${days}d`, tone: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" };
}

export default async function RemindersPage() {
  await requireResource("reminders:read");
  const backend = getBackend();
  const [obligations, leases, parties, queue] = await Promise.all([
    backend.payments.listObligations(),
    backend.leases.list(),
    backend.parties.list(),
    backend.reminders.listQueue(),
  ]);

  const leaseById = new Map(leases.map((l) => [l.id, l] as [string, Lease]));
  const partyById = partyMap(parties);

  // What WOULD send in the next 14 days under the rent-collection-cycle workflow.
  const upcomingPreview = obligations
    .filter((o) => o.kind === "rent_due" && daysUntil(o.dueDate) <= 14)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 30);

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Reminders</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Replaces the Excel-driven mail merge. Phase 02 wires the live send through Resend + Twilio.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Queued (next 14d)" value={upcomingPreview.length} icon={Bell} />
        <KpiCard label="Email" value={0} icon={Mail} />
        <KpiCard label="WhatsApp" value={0} icon={MessageSquare} />
        <KpiCard label="SMS" value={0} icon={Phone} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming send queue (preview)</CardTitle>
          <CardDescription>
            Rent obligations due in the next 14 days. Each row would fire a tenant + landlord
            reminder under the <code className="font-mono">rent-collection-cycle</code> workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Due</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Lease</TableHead>
                <TableHead>To (tenant)</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Channels</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingPreview.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground text-sm">
                    Nothing due in the next 14 days.
                  </TableCell>
                </TableRow>
              )}
              {upcomingPreview.map((o) => (
                <ReminderPreviewRow
                  key={o.id}
                  obligation={o}
                  lease={leaseById.get(o.leaseId)}
                  partyById={partyById}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            Sent, delivered, opened, failed. Empty until Phase 02.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="rounded-md border border-dashed py-10 text-center text-muted-foreground text-sm">
              No reminders sent yet.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ReminderPreviewRow({
  obligation,
  lease,
  partyById,
}: {
  obligation: Obligation;
  lease?: Lease;
  partyById: Map<string, Party>;
}) {
  const days = daysUntil(obligation.dueDate);
  const u = urgency(days);
  const tenantRole = lease?.additionalRoles?.find((r) => r.role === "tenant");
  const tenant = tenantRole ? partyById.get(tenantRole.partyId) : undefined;

  return (
    <TableRow>
      <TableCell className="tabular-nums">{formatDate(obligation.dueDate)}</TableCell>
      <TableCell>
        <Badge variant="outline" className={`font-medium ${u.tone}`}>
          {u.label}
        </Badge>
      </TableCell>
      <TableCell>
        {lease ? (
          <Link href={`/leases/${lease.id}`} className="font-mono text-xs hover:underline">
            {lease.id}
          </Link>
        ) : (
          <span className="font-mono text-muted-foreground text-xs">{obligation.leaseId}</span>
        )}
      </TableCell>
      <TableCell>{tenant?.displayName ?? "—"}</TableCell>
      <TableCell className="text-right tabular-nums">
        {obligation.amount
          ? formatCurrency(obligation.amount.amount, {
              currency: obligation.amount.currency,
              noDecimals: true,
            })
          : "—"}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Badge variant="outline" className="text-xs">
            <Mail className="mr-1 size-3" /> email
          </Badge>
          {tenant?.phones.length ? (
            <Badge variant="outline" className="text-xs">
              <MessageSquare className="mr-1 size-3" /> wa
            </Badge>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Bell;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" /> {label}
        </CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
