import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LeaseAuditEntry } from "@/server/audit";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function valueText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function LeaseAuditHistory({ entries, showLease = false, defaultOpen = false }: {
  entries: LeaseAuditEntry[];
  showLease?: boolean;
  defaultOpen?: boolean;
}) {
  if (!entries.length) return <p className="py-6 text-sm text-muted-foreground">No changes recorded yet.</p>;
  return <ol className="space-y-2">
    {entries.map((entry) => {
      const before = entry.before ?? {};
      const after = entry.after ?? {};
      const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) =>
        key !== "updated_at" && JSON.stringify(before[key]) !== JSON.stringify(after[key]));
      return <li key={entry.id} className="overflow-hidden rounded-md border">
        <details className="group/history" open={defaultOpen}>
          <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1 px-3 py-2 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[auto_1fr_auto] [&::-webkit-details-marker]:hidden">
            <ChevronRight aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-open/history:rotate-90" />
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-medium">{entry.action}</span>
              <span className="text-xs text-muted-foreground">{entry.actorName}</span>
            </span>
            <time dateTime={entry.createdAt} className="col-start-2 text-xs tabular-nums text-muted-foreground sm:col-start-3 sm:row-start-1 sm:pt-0.5">{new Date(entry.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Colombo" })} (SL)</time>
          </summary>
          <div className="space-y-3 border-t bg-muted/20 px-3 py-3">
            <p className="break-words text-xs text-muted-foreground">{entry.actorName}{entry.actorEmail && <> · {entry.actorEmail}</>}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{entry.tableName.replaceAll("_", " ")}</Badge>
              <Badge variant="outline">{entry.operation.toLowerCase()}</Badge>
              <Link href={`/activity/${entry.id}`} className="text-primary hover:underline">View activity</Link>
              {showLease && <Link href={`/leases/${entry.leaseId}`} className="text-primary hover:underline">Open lease</Link>}
            </div>
            {entry.details && Object.keys(entry.details).length > 0 && <dl className="space-y-1 text-xs">{Object.entries(entry.details).map(([key, value]) =>
              <div key={key}><dt className="inline font-medium">{key.replaceAll("_", " ")}: </dt><dd className="inline break-words">{valueText(value)}</dd></div>)}</dl>}
            <details className="text-xs">
              <summary className="cursor-pointer rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View {fields.length} field change{fields.length === 1 ? "" : "s"}</summary>
              <div className="mt-2 overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead className="text-xs">Field</TableHead><TableHead className="text-xs">Before</TableHead><TableHead className="text-xs">After</TableHead></TableRow></TableHeader>
                <TableBody>{fields.map((key) => <TableRow key={key}><TableCell className="py-1.5 text-xs">{key.replaceAll("_", " ")}</TableCell><TableCell className="whitespace-pre-wrap break-all py-1.5 text-xs">{valueText(before[key])}</TableCell><TableCell className="whitespace-pre-wrap break-all py-1.5 text-xs">{valueText(after[key])}</TableCell></TableRow>)}</TableBody>
              </Table></div>
            </details>
          </div>
        </details>
      </li>;
    })}
  </ol>;
}
