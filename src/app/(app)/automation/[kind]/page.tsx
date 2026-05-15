"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ArrowLeft,
  Bot,
  CircleCheck,
  CircleDashed,
  Hand,
  ShieldCheck,
  ShieldQuestion,
  UserCog,
  ExternalLink,
} from "lucide-react";

import { ActivityFeed } from "@/components/app/activity-feed";
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
import { LiveDot } from "@/components/ui/live-dot";
import { useDemoStore } from "@/lib/demo/store";
import {
  useAutonomyMatrix,
  useDecidedApprovals,
  usePendingApprovals,
  useVisibleActivities,
} from "@/lib/demo/use-store";
import { WORKFLOW_DEFS, type WorkflowStep } from "@/lib/demo/workflow-defs";
import {
  AUTONOMY_DESCRIPTION,
  AUTONOMY_LABEL,
  AUTONOMY_NEXT,
  AUTONOMY_THRESHOLD,
  WORKFLOW_LABEL,
  type WorkflowKind,
} from "@/lib/demo/types";
import { cn } from "@/lib/utils";

const STEP_TONE: Record<WorkflowStep["type"], { ring: string; icon: typeof Bot; chip: string }> = {
  auto: {
    ring: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
    icon: Bot,
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  gate: {
    ring: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
    icon: Hand,
    chip: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  external: {
    ring: "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40",
    icon: ExternalLink,
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  },
};

export default function AutomationDetailPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = use(params);
  const def = WORKFLOW_DEFS[kind as WorkflowKind];
  if (!def) notFound();

  const matrix = useAutonomyMatrix();
  const aut = matrix[def.kind];
  const promote = useDemoStore((s) => s.promoteAutonomy);

  const allActivities = useVisibleActivities();
  const pending = usePendingApprovals();
  const decided = useDecidedApprovals();

  const runs = useMemo(
    () => allActivities.filter((a) => a.workflow === def.kind),
    [allActivities, def.kind],
  );
  const pendingForKind = pending.filter((a) => a.workflow === def.kind);
  const decidedForKind = decided.filter((a) => a.workflow === def.kind);

  const next = AUTONOMY_NEXT[aut.level];
  const canPromote = next && aut.confidencePct >= AUTONOMY_THRESHOLD[aut.level];

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div data-onborda="page-title">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/automation">
            <ArrowLeft className="size-3.5" /> Automation matrix
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-bold text-2xl tracking-tight">
              {def.title}
              <Badge variant="outline" className="font-mono text-[10px]">
                {def.kind}
              </Badge>
            </h1>
            <p className="mt-1 max-w-3xl text-muted-foreground text-sm">{def.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">Trigger · {def.trigger}</Badge>
              <Badge variant="outline" className="font-mono">
                idem: {def.idempotencyKey}
              </Badge>
              <Badge variant="outline">Phase {def.phase}</Badge>
            </div>
          </div>
          <div className="w-[260px] max-w-full">
            <AutonomyMeter level={aut.level} confidencePct={aut.confidencePct} expanded />
            {next && (
              <Button
                size="sm"
                variant={canPromote ? "default" : "outline"}
                disabled={!canPromote}
                onClick={() => promote(def.kind)}
                className="mt-3 w-full"
              >
                {canPromote ? `Promote to ${AUTONOMY_LABEL[next]}` : `Reach ${AUTONOMY_THRESHOLD[aut.level]}% to promote`}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Bot className="size-3.5" /> Auto runs
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{aut.autoExecutions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <CircleCheck className="size-3.5 text-emerald-500" /> Human approved
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{aut.approvedHuman}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <CircleDashed className="size-3.5 text-rose-500" /> Human rejected
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{aut.rejectedHuman}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <UserCog className="size-3.5" /> Pending
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{pendingForKind.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step graph</CardTitle>
          <CardDescription>
            Auto steps run without asking; gate steps pause for human approval; external steps
            wait on a third-party (e-sign provider, vendor, bank).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {def.steps.map((step, i) => {
            const tone = STEP_TONE[step.type];
            const Icon = tone.icon;
            return (
              <div
                key={step.id}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border-2 p-4 sm:flex-row sm:items-start sm:gap-4",
                  tone.ring,
                )}
              >
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full border bg-background font-mono text-xs">
                    {i + 1}
                  </div>
                  <Icon className="size-4 shrink-0" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-sm">{step.name}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 font-medium text-[10px]",
                        tone.chip,
                      )}
                    >
                      {step.type}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground text-xs">{step.description}</p>
                  {step.type === "gate" && step.gateQuestion && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900 text-xs dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                      <ShieldQuestion className="size-3" />
                      {step.gateQuestion}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" /> Guardrails
            </CardTitle>
            <CardDescription>
              Hard limits the system honours regardless of autonomy level.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {def.guardrails.map((g) => (
              <div key={g.id} className="rounded-md border bg-muted/40 p-3">
                <div className="font-medium text-sm">{g.label}</div>
                <p className="mt-0.5 text-muted-foreground text-xs">{g.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inputs &amp; outputs</CardTitle>
            <CardDescription>The contract Phase 02 will implement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="font-medium text-xs text-muted-foreground">Inputs</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {def.inputs.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-medium text-xs text-muted-foreground">Outputs</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {def.outputs.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
            <div className="text-muted-foreground text-xs">
              {AUTONOMY_DESCRIPTION[aut.level]}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LiveDot tone="live" size="xs" /> Recent runs
          </CardTitle>
          <CardDescription>
            Activities and decisions logged for this workflow only.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3">
          <ActivityFeed activities={runs} limit={20} />
        </CardContent>
      </Card>

      {decidedForKind.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decided requests · history</CardTitle>
            <CardDescription>{decidedForKind.length} past decisions on this workflow.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {decidedForKind.slice(0, 12).map((a) => (
                <li key={a.id} className="px-6 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{a.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {a.options.find((o) => o.id === a.decision?.optionId)?.label ??
                        a.decision?.optionId}{" "}
                      · by {a.decision?.by}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
