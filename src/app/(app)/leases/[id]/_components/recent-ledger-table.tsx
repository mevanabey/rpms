"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LedgerEntry } from "@/core/types";
import { formatCurrency, formatDate } from "@/lib/utils";

import { useOptimisticPaidEntries } from "./use-lease-payments-store";

/**
 * Client wrapper for the Recent ledger table. Takes the server-rendered
 * entries and overlays anything in the optimistic store (entries the user
 * just marked-paid via the dialog) so the table reflects the change before
 * `router.refresh()` propagates new RSC data.
 *
 * De-dupe rule: if the optimistic entry shares an `id` with a server row,
 * the server row's fields are preferred (it's the authoritative copy after
 * the action completed). Otherwise the optimistic entry is prepended.
 */
export function RecentLedgerTable({
  leaseId,
  serverEntries,
  limit = 12,
}: {
  leaseId: string;
  serverEntries: LedgerEntry[];
  limit?: number;
}) {
  const optimistic = useOptimisticPaidEntries(leaseId);

  // Merge: server entries take precedence by id. Optimistic ids that are
  // already in serverEntries are dropped (the server has caught up).
  const serverIds = new Set(serverEntries.map((e) => e.id));
  const optimisticPending = optimistic.filter((e) => !serverIds.has(e.id));
  const merged = [...serverEntries, ...optimisticPending]
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .slice(0, limit);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Due</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Paid</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {merged.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
              No ledger entries yet.
            </TableCell>
          </TableRow>
        )}
        {merged.map((e) => (
          <TableRow key={e.id}>
            <TableCell>{formatDate(e.dueDate)}</TableCell>
            <TableCell className="text-xs">{e.kind}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(
                e.direction === "out" ? -e.amount.amount : e.amount.amount,
                { currency: e.amount.currency, noDecimals: true },
              )}
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
        ))}
      </TableBody>
    </Table>
  );
}
