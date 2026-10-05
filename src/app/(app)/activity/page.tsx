import Link from "next/link";
import { listLeaseAudit } from "@/server/audit";
import { LeaseAuditHistory } from "@/components/app/lease-audit-history";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const query = await searchParams;
  const history = await listLeaseAudit({ page: Number(query.page) || 1, search: query.search });
  const pageHref = (page: number) => `/activity?${new URLSearchParams({ page: String(page), search: query.search ?? "" })}`;
  return <div className="flex flex-col gap-6">
    <div><h1 className="font-bold text-2xl">Activity</h1><p className="mt-1 text-sm text-muted-foreground">Permanent history of changes to leases you can access.</p></div>
    <Card>
      <CardHeader><CardTitle>Lease audit log</CardTitle><CardDescription>{history.total} recorded changes. Times are in Sri Lanka time.</CardDescription>
        <form className="flex gap-2" action="/activity"><Input name="search" defaultValue={query.search} placeholder="Search by action, person, or record type" aria-label="Search lease history" /><Button type="submit" variant="outline">Search</Button></form>
      </CardHeader>
      <CardContent><LeaseAuditHistory entries={history.entries} showLease />
        <div className="flex justify-between mt-4 text-sm">
          {history.page > 1 ? <Link className="text-primary hover:underline" href={pageHref(history.page - 1)}>Newer changes</Link> : <span />}
          <span>Page {history.page} of {Math.max(1, Math.ceil(history.total / history.pageSize))}</span>
          {history.page * history.pageSize < history.total ? <Link className="text-primary hover:underline" href={pageHref(history.page + 1)}>Older changes</Link> : <span />}
        </div>
      </CardContent>
    </Card>
  </div>;
}
