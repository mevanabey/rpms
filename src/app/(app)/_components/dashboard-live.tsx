"use client";

import Link from "next/link";

import { Bot, Brain, ShieldQuestion, Sparkles } from "lucide-react";

import { ActivityFeed } from "@/components/app/activity-feed";
import { ApprovalCard } from "@/components/app/approval-card";
import { AutonomyMeter } from "@/components/ui/autonomy-meter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LiveDot } from "@/components/ui/live-dot";
import { useAutonomyMatrix, usePendingApprovals, useVisibleActivities } from "@/lib/demo/use-store";
import { WORKFLOW_LABEL, type WorkflowKind } from "@/lib/demo/types";

/**
 * The live ticker block on the dashboard. Three columns:
 *  - Activity feed (recent autonomous events)
 *  - Pending approvals (top 2)
 *  - Autonomy training summary
 */
export function DashboardLive() {
  const activities = useVisibleActivities();
  const pending = usePendingApprovals();
  const autonomy = useAutonomyMatrix();
  const topAutonomy = Object.values(autonomy)
    .sort((a, b) => b.confidencePct - a.confidencePct)
    .slice(0, 5);
  const avgConfidence = Math.round(
    Object.values(autonomy).reduce((acc, e) => acc + e.confidencePct, 0) /
      Math.max(1, Object.values(autonomy).length),
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 md:gap-6">
      {/* Live activity */}
      <Card data-onborda="live-activity" className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="size-4" /> The system is working
            <LiveDot tone="live" size="sm" />
          </CardTitle>
          <CardDescription>
            Latest autonomous actions — refreshes on its own.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3">
          <ActivityFeed activities={activities} limit={6} compact />
          <div className="mt-3 px-3">
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/activity">View full activity log</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending approvals */}
      <Card data-onborda="dashboard-approvals" className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldQuestion className="size-4" /> Decisions waiting
            {pending.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 text-xs dark:bg-amber-950/60 dark:text-amber-200">
                <LiveDot tone="warning" size="xs" />
                {pending.length}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            The system asks for human input only when it’s not yet trained.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {pending.length === 0 ? (
            <div className="rounded-md border border-dashed py-8 text-center text-muted-foreground text-sm">
              All caught up — system is running on its own.
            </div>
          ) : (
            pending.slice(0, 1).map((a) => (
              <ApprovalCard key={a.id} approval={a} variant="compact" />
            ))
          )}
          {pending.length > 1 && (
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/tasks">{pending.length - 1} more · View all tasks</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Autonomy training summary */}
      <Card data-onborda="dashboard-autonomy" className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="size-4" /> Training matrix
          </CardTitle>
          <CardDescription>
            Each workflow climbs from manual to fully automated. Average{" "}
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              {avgConfidence}%
              <Sparkles className="size-3" />
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {topAutonomy.map((e) => (
            <div key={e.workflow}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-medium">
                  {WORKFLOW_LABEL[e.workflow as WorkflowKind]}
                </span>
              </div>
              <AutonomyMeter level={e.level} confidencePct={e.confidencePct} />
            </div>
          ))}
          <div className="pt-1">
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/automation">Open the matrix</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
