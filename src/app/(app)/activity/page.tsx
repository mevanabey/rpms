"use client";

import { useMemo, useState } from "react";

import { Activity as ActivityIcon, Bot } from "lucide-react";

import { ActivityFeed } from "@/components/app/activity-feed";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LiveDot } from "@/components/ui/live-dot";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDemoStore } from "@/lib/demo/store";
import { useVisibleActivities } from "@/lib/demo/use-store";
import { WORKFLOW_LABEL, type WorkflowKind } from "@/lib/demo/types";

const ALL_KINDS: Array<"all" | WorkflowKind> = [
  "all",
  "rent-collection-cycle",
  "lease-lifecycle-tick",
  "compliance-scheduler",
  "bank-reconcile",
  "commission-accrual",
  "commission-payout",
  "esign-resume",
  "breach-detect",
  "renewal-open",
  "move-out",
  "onboard-tenant",
];

export default function ActivityPage() {
  const activities = useVisibleActivities();
  const ackAll = useDemoStore((s) => s.ackAllActivities);
  const lastTickAt = useDemoStore((s) => s.lastTickAt);
  const [search, setSearch] = useState("");
  const [workflow, setWorkflow] = useState<"all" | WorkflowKind>("all");

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (workflow !== "all" && a.workflow !== workflow) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${a.title} ${a.body ?? ""} ${a.leaseId ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activities, workflow, search]);

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div data-onborda="page-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-bold text-2xl tracking-tight">
              Activity
              <LiveDot tone="live" />
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Every autonomous action and human decision. Audit log + live ticker.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={ackAll}>
              Mark all read
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Bot className="size-3.5" /> Total events
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{activities.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Unread</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {activities.filter((a) => !a.acked).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Last tick</CardDescription>
            <CardTitle className="text-base">
              {lastTickAt ? new Date(lastTickAt).toLocaleTimeString() : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <ActivityIcon className="size-3.5" /> Heartbeat
            </CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              <LiveDot tone="live" /> Live
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search activity by lease, title, body…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={workflow} onValueChange={(v) => setWorkflow(v as "all" | WorkflowKind)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k === "all" ? "All workflows" : WORKFLOW_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-muted-foreground text-xs">
              {filtered.length} of {activities.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-3">
          <ActivityFeed activities={filtered} />
        </CardContent>
      </Card>
    </div>
  );
}
