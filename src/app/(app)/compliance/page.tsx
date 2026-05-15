import Link from "next/link";

import { Calendar, ClipboardList } from "lucide-react";

import { ObligationStatusBadge } from "@/components/app/status-badge";
import { MoneyDisplay } from "@/components/app/money-display";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Obligation, ObligationKind } from "@/core/types";
import { formatDate } from "@/lib/utils";
import { getBackend } from "@/server/container";

const COMPLIANCE_KINDS: ObligationKind[] = [
  "stamp_duty",
  "legal_fees",
  "vat_reimbursement",
  "lift_service",
  "generator_service",
  "fire_inspection",
  "colour_wash",
  "statue_inspection",
  "renewal_notice",
  "termination_notice",
  "grace_end",
  "lockin_end",
  "escalation",
  "lease_expiry",
  "insurance",
];

const KIND_LABEL: Record<ObligationKind, string> = {
  rent_due: "Rent",
  deposit_due: "Deposit",
  stamp_duty: "Stamp duty",
  legal_fees: "Legal fees",
  vat_reimbursement: "VAT reimbursement",
  lift_service: "Lift service",
  generator_service: "Generator service",
  fire_inspection: "Fire inspection",
  colour_wash: "Colour wash",
  statue_inspection: "Statue inspection",
  renewal_notice: "Renewal notice",
  termination_notice: "Termination notice",
  grace_end: "Grace ends",
  lockin_end: "Lock-in ends",
  escalation: "Rent escalation",
  lease_expiry: "Lease expiry",
  insurance: "Insurance",
};

function bucket(o: Obligation): "30d" | "90d" | "year" | "later" {
  const today = new Date("2026-05-05").getTime();
  const due = new Date(o.dueDate).getTime();
  const days = (due - today) / 86400000;
  if (days < 30) return "30d";
  if (days < 90) return "90d";
  if (days < 365) return "year";
  return "later";
}

export default async function CompliancePage() {
  const backend = getBackend();
  const [obligations, leases] = await Promise.all([
    backend.payments.listObligations(),
    backend.leases.list(),
  ]);
  const leaseById = new Map(leases.map((l) => [l.id, l]));

  const compliance = obligations.filter((o) => COMPLIANCE_KINDS.includes(o.kind));
  const sorted = [...compliance].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const buckets = {
    "30d": sorted.filter((o) => bucket(o) === "30d"),
    "90d": sorted.filter((o) => bucket(o) === "90d"),
    year: sorted.filter((o) => bucket(o) === "year"),
    later: sorted.filter((o) => bucket(o) === "later"),
  };

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Compliance</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Lift, generator, fire, VAT, stamp duty, colour-wash, statue inspection. Every clause-derived obligation.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <BucketCard label="Next 30 days" count={buckets["30d"].length} accent="rose" />
        <BucketCard label="31 – 90 days" count={buckets["90d"].length} accent="amber" />
        <BucketCard label="Within 1 year" count={buckets.year.length} accent="blue" />
        <BucketCard label="Later" count={buckets.later.length} accent="zinc" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance calendar</CardTitle>
          <CardDescription>
            All non-rent obligations across all leases, ordered by due date. Each row traces back to a lease clause.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Due</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Lease</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Clause</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground text-sm">
                    No compliance obligations defined.
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((o) => {
                const lease = leaseById.get(o.leaseId);
                return (
                  <TableRow key={o.id}>
                    <TableCell className="tabular-nums">{formatDate(o.dueDate)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{KIND_LABEL[o.kind]}</Badge>
                    </TableCell>
                    <TableCell>
                      {lease ? (
                        <Link href={`/leases/${lease.id}`} className="font-mono text-xs hover:underline">
                          {lease.id}
                        </Link>
                      ) : (
                        <span className="font-mono text-muted-foreground text-xs">{o.leaseId}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MoneyDisplay amount={o.amount} />
                    </TableCell>
                    <TableCell>
                      <ObligationStatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      {o.sourceClause ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 text-muted-foreground text-xs">
          <ClipboardList className="size-4 shrink-0" />
          <div>
            Phase 02 generates recurring lift-service / generator-service / fire-inspection
            obligations from each head-lease clause and lights up overdue alerts here.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BucketCard({ label, count, accent }: { label: string; count: number; accent: "rose" | "amber" | "blue" | "zinc" }) {
  const tint: Record<typeof accent, string> = {
    rose: "text-rose-700 dark:text-rose-300",
    amber: "text-amber-700 dark:text-amber-300",
    blue: "text-blue-700 dark:text-blue-300",
    zinc: "text-zinc-700 dark:text-zinc-300",
  };
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Calendar className="size-4" /> {label}
        </CardDescription>
        <CardTitle className={`text-2xl ${tint[accent]}`}>{count}</CardTitle>
      </CardHeader>
    </Card>
  );
}
