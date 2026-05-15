"use client";

import { AlertTriangle, CheckCircle2, ListChecks, Wrench } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTickets } from "@/lib/demo/use-store";

export function MaintenanceStats() {
  const tickets = useTickets();
  const open = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;
  const blocked = tickets.filter((t) => t.status === "blocked").length;
  const done = tickets.filter((t) => t.status === "done").length;
  const urgent = tickets.filter(
    (t) => t.severity === "urgent" && t.status !== "done" && t.status !== "cancelled",
  ).length;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <ListChecks className="size-3.5" /> Open
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">{open}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <Wrench className="size-3.5" /> In progress
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">{inProgress}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-amber-500" /> Blocked
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">{blocked}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-500" /> Done
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">{done}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-rose-500" /> Urgent open
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums text-rose-700 dark:text-rose-300">
            {urgent}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
