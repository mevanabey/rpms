"use client";

import Link from "next/link";

import { ArrowLeft, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canSeeLease } from "@/lib/demo/scope";
import { useCurrentUser } from "@/lib/demo/use-store";

/**
 * Per-lease scope gate. Wrap any page whose data is keyed to a single lease.
 * Lawyers see an "Out of scope" screen if the lease isn't on their assignment
 * list. Admins and account managers always pass.
 */
export function LeaseScopeGate({
  leaseId,
  children,
}: {
  leaseId: string;
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  if (!user) return null;
  if (canSeeLease(user, leaseId)) return <>{children}</>;

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/leases">
          <ArrowLeft className="size-3.5" /> All leases
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
              <ShieldOff className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Out of your scope</CardTitle>
              <CardDescription className="mt-0.5 text-sm">
                This lease isn't on your assignment list. Ask an admin if you
                believe this is wrong.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Lease id:{" "}
            <code className="font-mono text-xs">{leaseId}</code>
          </p>
          <Button asChild>
            <Link href="/leases">Back to your leases</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
