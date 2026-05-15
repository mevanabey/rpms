"use client";

import Link from "next/link";

import { ArrowRight, Bot, GraduationCap, ShieldCheck, Sparkles, UserCheck, UserCog } from "lucide-react";

import { AutonomyMeter } from "@/components/ui/autonomy-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDemoStore } from "@/lib/demo/store";
import { useAutonomyMatrix } from "@/lib/demo/use-store";
import {
  AUTONOMY_DESCRIPTION,
  AUTONOMY_LABEL,
  AUTONOMY_NEXT,
  AUTONOMY_THRESHOLD,
  WORKFLOW_LABEL,
  type AutonomyLevel,
  type WorkflowKind,
} from "@/lib/demo/types";

const LEVEL_ORDER: AutonomyLevel[] = ["manual", "human-gated", "auto-with-review", "auto"];
const LEVEL_ICON: Record<AutonomyLevel, React.ComponentType<{ className?: string }>> = {
  manual: UserCog,
  "human-gated": UserCheck,
  "auto-with-review": ShieldCheck,
  auto: Bot,
};

export default function AutomationPage() {
  const autonomy = useAutonomyMatrix();
  const promote = useDemoStore((s) => s.promoteAutonomy);

  const entries = Object.values(autonomy).sort((a, b) => b.confidencePct - a.confidencePct);

  // Roll-ups
  const counts: Record<AutonomyLevel, number> = {
    manual: 0,
    "human-gated": 0,
    "auto-with-review": 0,
    auto: 0,
  };
  for (const e of entries) counts[e.level] += 1;
  const totalAuto = entries.length;
  const avgConfidence = Math.round(
    entries.reduce((acc, e) => acc + e.confidencePct, 0) / Math.max(1, entries.length),
  );

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div data-onborda="page-title">
        <h1 className="flex items-center gap-2 font-bold text-2xl tracking-tight">
          Automation
          <GraduationCap className="size-6 text-muted-foreground" />
        </h1>
        <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
          The training matrix. Each workflow climbs from <em>manual</em> through{" "}
          <em>human-gated</em> and <em>auto with review</em> to{" "}
          <em>fully automated</em>. Approvals raise confidence; rejections lower
          it. When confidence crosses the threshold, the workflow graduates.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              Avg confidence
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{avgConfidence}%</CardTitle>
          </CardHeader>
        </Card>
        {LEVEL_ORDER.map((lvl) => {
          const Icon = LEVEL_ICON[lvl];
          return (
            <Card key={lvl}>
              <CardHeader>
                <CardDescription className="flex items-center gap-1.5">
                  <Icon className="size-3.5" /> {AUTONOMY_LABEL[lvl]}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {counts[lvl]}
                  <span className="ml-1 text-muted-foreground text-xs font-normal">
                    of {totalAuto}
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow autonomy matrix</CardTitle>
          <CardDescription>
            Each row is a Vercel Workflow handler. Promote manually, or let the
            system promote itself when confidence crosses the threshold.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {entries.map((e) => {
            const next = AUTONOMY_NEXT[e.level];
            const canPromote = next && e.confidencePct >= AUTONOMY_THRESHOLD[e.level];
            return (
              <Link
                key={e.workflow}
                href={`/automation/${e.workflow}`}
                className="block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40"
                data-onborda={
                  e.workflow === "rent-collection-cycle" ? "automation-row" : undefined
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 font-medium text-sm">
                      {WORKFLOW_LABEL[e.workflow as WorkflowKind]}
                      <ArrowRight className="size-3 text-muted-foreground" />
                    </div>
                    <div className="font-mono text-muted-foreground text-xs">{e.workflow}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      auto: {e.autoExecutions}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      ✓ {e.approvedHuman}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      ✗ {e.rejectedHuman}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3">
                  <AutonomyMeter level={e.level} confidencePct={e.confidencePct} expanded />
                </div>
                {next && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-xs">
                      {AUTONOMY_DESCRIPTION[next]}
                    </p>
                    <Button
                      size="sm"
                      variant={canPromote ? "default" : "outline"}
                      disabled={!canPromote}
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        promote(e.workflow as WorkflowKind);
                      }}
                    >
                      {canPromote ? "Promote ↑" : "Below threshold"}
                    </Button>
                  </div>
                )}
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
