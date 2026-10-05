import Link from "next/link";
import type { LeaseAuditEntry } from "@/server/audit";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function valueText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function LeaseAuditHistory({ entries, showLease = false }: { entries: LeaseAuditEntry[]; showLease?: boolean }) {
  if (!entries.length) return <p className="py-6 text-sm text-muted-foreground">No changes recorded yet.</p>;
  return <ol className="space-y-3">
    {entries.map((entry) => {
      const before = entry.before ?? {};
      const after = entry.after ?? {};
      const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) =>
        key !== "updated_at" && JSON.stringify(before[key]) !== JSON.stringify(after[key]));
      return <li key={entry.id} className="rounded-md border p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/activity/${entry.id}`} className="font-medium text-sm hover:underline">{entry.action}</Link>
          <time dateTime={entry.createdAt} className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Colombo" })} (SL)</time>
        </div>
        <p className="text-sm">{entry.actorName}{entry.actorEmail && <span className="text-muted-foreground"> · {entry.actorEmail}</span>}</p>
        <div className="flex flex-wrap gap-2 items-center text-xs">
          <Badge variant="outline">{entry.tableName.replaceAll("_", " ")}</Badge>
          <Badge variant="outline">{entry.operation.toLowerCase()}</Badge>
          {showLease && <Link href={`/leases/${entry.leaseId}`} className="text-primary hover:underline">Open lease</Link>}
        </div>
        {entry.details && Object.keys(entry.details).length > 0 && <dl className="text-xs space-y-1">{Object.entries(entry.details).map(([key, value]) =>
          <div key={key}><dt className="inline font-medium">{key.replaceAll("_", " ")}: </dt><dd className="inline break-words">{valueText(value)}</dd></div>)}</dl>}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">View {fields.length} field change{fields.length === 1 ? "" : "s"}</summary>
          <div className="overflow-x-auto mt-2"><Table>
            <TableHeader><TableRow><TableHead>Field</TableHead><TableHead>Before</TableHead><TableHead>After</TableHead></TableRow></TableHeader>
            <TableBody>{fields.map((key) => <TableRow key={key}><TableCell>{key.replaceAll("_", " ")}</TableCell><TableCell className="whitespace-pre-wrap break-all">{valueText(before[key])}</TableCell><TableCell className="whitespace-pre-wrap break-all">{valueText(after[key])}</TableCell></TableRow>)}</TableBody>
          </Table></div>
        </details>
      </li>;
    })}
  </ol>;
}
