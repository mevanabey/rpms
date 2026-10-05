import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getLeaseAuditEntry } from "@/server/audit";
import { LeaseAuditHistory } from "@/components/app/lease-audit-history";
import { Button } from "@/components/ui/button";

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const entry = await getLeaseAuditEntry(id);
  if (!entry) notFound();
  return <div className="space-y-4">
    <Button variant="ghost" asChild><Link href="/activity">Back to activity</Link></Button>
    <h1 className="text-2xl font-bold">Lease change</h1>
    <LeaseAuditHistory entries={[entry]} showLease />
  </div>;
}
