"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ExternalLink,
  Info,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LiveDot } from "@/components/ui/live-dot";
import { useVisibleActivities } from "@/lib/demo/use-store";
import {
  WORKFLOW_LABEL,
  type Severity,
  type WorkflowKind,
} from "@/lib/demo/types";
import { WORKFLOW_DEFS } from "@/lib/demo/workflow-defs";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

const SEVERITY_ICON: Record<Severity, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const SEVERITY_TONE: Record<Severity, string> = {
  info: "text-violet-600 bg-violet-50 border-violet-200 dark:text-violet-300 dark:bg-violet-950/40 dark:border-violet-900",
  success: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900",
  warning: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-900",
  error: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-900",
};

export default function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const activities = useVisibleActivities();
  const activity = activities.find((a) => a.id === id);

  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
  }, []);

  if (!activity) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
          <Link href="/activity">
            <ArrowLeft className="size-3.5" /> Activity
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">Activity not found</p>
            <p className="mt-1 text-muted-foreground text-sm">
              The activity may have been pruned (we only retain the last 250).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Icon = SEVERITY_ICON[activity.severity];
  const isWorkflow =
    activity.workflow !== "system" && activity.workflow !== "human";
  const workflowDef = isWorkflow ? WORKFLOW_DEFS[activity.workflow as WorkflowKind] : null;
  const fresh = now !== 0 && now - activity.ts < 30_000;

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div data-onborda="page-title">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/activity">
            <ArrowLeft className="size-3.5" /> Activity
          </Link>
        </Button>
        <div
          className={cn(
            "rounded-lg border-2 p-5",
            SEVERITY_TONE[activity.severity],
          )}
        >
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background">
              {fresh ? <LiveDot tone="live" size="md" /> : <Icon className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-xl tracking-tight text-foreground">
                {activity.title}
              </h1>
              {activity.body && (
                <p className="mt-1 text-sm text-foreground/80">{activity.body}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-background">
                  {activity.severity}
                </Badge>
                <Badge variant="outline" className="bg-background">
                  <Bot className="mr-1 size-3" />
                  {isWorkflow
                    ? WORKFLOW_LABEL[activity.workflow as WorkflowKind]
                    : activity.workflow}
                </Badge>
                {activity.amount && (
                  <Badge variant="outline" className="bg-background font-mono tabular-nums">
                    {formatCurrency(activity.amount.amount, {
                      currency: activity.amount.currency,
                      noDecimals: true,
                    })}
                  </Badge>
                )}
                <Badge variant="outline" className="bg-background font-mono">
                  {new Date(activity.ts).toLocaleString()}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {workflowDef && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">From workflow</CardTitle>
              <CardDescription>The handler that emitted this event.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={`/automation/${workflowDef.kind}`}
                className="group block rounded-md border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  {workflowDef.title}
                  <ExternalLink className="size-3 text-muted-foreground" />
                </div>
                <p className="mt-1 text-muted-foreground text-xs">
                  {workflowDef.description.slice(0, 140)}…
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {workflowDef.trigger}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    Phase {workflowDef.phase}
                  </Badge>
                </div>
              </Link>
            </CardContent>
          </Card>
        )}

        {activity.leaseId && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Related lease</CardTitle>
              <CardDescription>Click through for the full lease workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={`/leases/${activity.leaseId}`}
                className="group block rounded-md border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="font-mono text-sm">{activity.leaseId}</div>
                <div className="mt-1 text-muted-foreground text-xs">
                  Open the parties, schedule, ledger, and obligations for this lease.
                </div>
              </Link>
            </CardContent>
          </Card>
        )}

        {activity.partyId && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Related party</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/parties/${activity.partyId}`}
                className="group block rounded-md border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="font-mono text-sm">{activity.partyId}</div>
                <div className="mt-1 text-muted-foreground text-xs">
                  Their leases, role timeline, contact info.
                </div>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Raw payload</CardTitle>
          <CardDescription>
            What Phase 02 will store in the audit log row.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 font-mono text-xs">
{JSON.stringify(
  {
    id: activity.id,
    ts: activity.ts,
    iso: new Date(activity.ts).toISOString(),
    workflow: activity.workflow,
    severity: activity.severity,
    title: activity.title,
    body: activity.body,
    leaseId: activity.leaseId,
    partyId: activity.partyId,
    amount: activity.amount,
    acked: activity.acked,
  },
  null,
  2,
)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
