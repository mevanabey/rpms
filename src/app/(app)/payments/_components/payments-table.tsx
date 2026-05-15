"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { LeaseStatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LedgerEntry, LedgerKind, Lease, Party } from "@/core/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type PaidFilter = "all" | "paid" | "unpaid";

export type PaymentRow = {
  entry: LedgerEntry;
  lease?: Lease;
  counterparty?: Party;
};

const KIND_OPTIONS: Array<{ value: "all" | LedgerKind; label: string }> = [
  { value: "all", label: "All kinds" },
  { value: "rent", label: "Rent" },
  { value: "deposit", label: "Deposit" },
  { value: "stamp_duty", label: "Stamp duty" },
  { value: "legal_fees", label: "Legal fees" },
  { value: "vat", label: "VAT" },
  { value: "late_fee", label: "Late fee" },
  { value: "refund", label: "Refund" },
  { value: "commission", label: "Commission" },
];

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  const [search, setSearch] = useState("");
  const [paid, setPaid] = useState<PaidFilter>("all");
  const [kind, setKind] = useState<"all" | LedgerKind>("all");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (paid === "paid" && !r.entry.paidDate) return false;
      if (paid === "unpaid" && r.entry.paidDate) return false;
      if (kind !== "all" && r.entry.kind !== kind) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          r.entry.id,
          r.entry.leaseId,
          r.lease?.propertyId ?? "",
          r.counterparty?.displayName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, paid, kind, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter by lease, property, party…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={paid} onValueChange={(v) => setPaid(v as PaidFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={(v) => setKind(v as "all" | LedgerKind)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-muted-foreground text-xs">
          {filtered.length} of {rows.length}
        </div>
        <Button variant="outline" size="sm" disabled>
          Export CSV
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Due</TableHead>
              <TableHead>Lease</TableHead>
              <TableHead>Counterparty</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Paid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground text-sm">
                  No matching ledger entries.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => {
              const e = r.entry;
              return (
                <TableRow key={e.id}>
                  <TableCell>{formatDate(e.dueDate)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/leases/${e.leaseId}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {e.leaseId}
                    </Link>
                    {r.lease && (
                      <span className="ml-2">
                        <LeaseStatusBadge status={r.lease.status} />
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{r.counterparty?.displayName ?? "—"}</TableCell>
                  <TableCell className="text-xs">{e.kind.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(
                      e.direction === "out" ? -e.amount.amount : e.amount.amount,
                      { currency: e.amount.currency, noDecimals: true },
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.paymentMethod ? e.paymentMethod.replace(/_/g, " ") : "—"}
                  </TableCell>
                  <TableCell>
                    {e.paidDate ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                      >
                        {formatDate(e.paidDate)}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                      >
                        unpaid
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
