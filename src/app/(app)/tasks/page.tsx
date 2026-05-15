"use client";

import { CheckCircle2, ShieldQuestion } from "lucide-react";

import { ApprovalCard } from "@/components/app/approval-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LiveDot } from "@/components/ui/live-dot";
import { useDecidedApprovals, usePendingApprovals } from "@/lib/demo/use-store";
import { WORKFLOW_LABEL } from "@/lib/demo/types";
import { formatCurrency } from "@/lib/utils";

export default function TasksPage() {
  const pending = usePendingApprovals();
  const decided = useDecidedApprovals();

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div data-onborda="page-title">
        <h1 className="font-bold text-2xl tracking-tight">Tasks</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Decisions the system needs from a human. Approve or reject — it
          remembers and learns to do the same next time.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldQuestion className="size-4" />
                Awaiting your decision
                {pending.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 text-xs dark:bg-amber-950/60 dark:text-amber-200">
                    <LiveDot tone="warning" size="xs" />
                    {pending.length}
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Each click trains the autonomy matrix.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {pending.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-dashed py-12 text-center">
              <CheckCircle2 className="size-10 text-emerald-500" />
              <div>
                <p className="font-medium">All caught up</p>
                <p className="text-muted-foreground text-sm">
                  The system is running autonomously. New tasks will appear
                  here when human input is needed.
                </p>
              </div>
            </div>
          ) : (
            pending.map((a) => <ApprovalCard key={a.id} approval={a} />)
          )}
        </CardContent>
      </Card>

      {decided.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently decided</CardTitle>
            <CardDescription>
              Last {Math.min(20, decided.length)} decisions. The system uses
              these to shape its training matrix.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {decided.slice(0, 20).map((a) => (
                <li key={a.id} className="px-6 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{a.title.replace(/\?$/, "")}</span>
                        <Badge variant="outline" className="text-xs">
                          {WORKFLOW_LABEL[a.workflow]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground text-xs">
                        Decision:{" "}
                        <span className="font-medium text-foreground">
                          {a.options.find((o) => o.id === a.decision?.optionId)?.label ?? a.decision?.optionId}
                        </span>{" "}
                        · by{" "}
                        <span className="font-medium text-foreground">
                          {a.decision?.by === "auto" ? "system (auto)" : "human"}
                        </span>
                      </p>
                    </div>
                    {a.amount && (
                      <span className="font-mono text-muted-foreground text-xs tabular-nums">
                        {formatCurrency(a.amount.amount, {
                          currency: a.amount.currency,
                          noDecimals: true,
                        })}
                      </span>
                    )}
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
