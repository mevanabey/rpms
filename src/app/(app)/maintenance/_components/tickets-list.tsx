"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { ArrowRight, Wrench } from "lucide-react";

import { LiveDot } from "@/components/ui/live-dot";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Property, Unit } from "@/core/types";
import { propertyMap, unitMap } from "@/lib/lookup";
import { useTickets } from "@/lib/demo/use-store";
import {
  type TicketCategory,
  type TicketSeverity,
  type TicketStatus,
} from "@/lib/demo/types";
import { formatCurrency } from "@/lib/utils";

const SEVERITY_TONE: Record<TicketSeverity, StatusTone> = {
  low: "muted",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

const STATUS_TONE: Record<TicketStatus, StatusTone> = {
  open: "warning",
  in_progress: "pending",
  blocked: "danger",
  done: "active",
  cancelled: "muted",
};

const CATEGORY_LABEL: Record<TicketCategory, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  structural: "Structural",
  appliance: "Appliance",
  lift: "Lift",
  generator: "Generator",
  fire: "Fire / safety",
  cleaning: "Cleaning",
  other: "Other",
};

export function TicketsList({
  properties,
  units,
}: {
  properties: Property[];
  units: Unit[];
}) {
  const tickets = useTickets();
  const propertyById = propertyMap(properties);
  const unitById = unitMap(units);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | TicketStatus>("all");
  const [severity, setSeverity] = useState<"all" | TicketSeverity>("all");

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (severity !== "all" && t.severity !== severity) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${t.title} ${t.description} ${propertyById.get(t.propertyId)?.name ?? ""} ${t.unitId ? unitById.get(t.unitId)?.label ?? "" : ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, status, severity, search, propertyById, unitById]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4" /> Tickets
            <LiveDot tone="live" size="xs" />
          </CardTitle>
          <span className="ml-auto text-muted-foreground text-xs">
            {filtered.length} of {tickets.length}
          </span>
        </div>
        <CardDescription>
          Click any row to drill in. New tickets you create show up here instantly.
        </CardDescription>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={status} onValueChange={(v) => setStatus(v as "all" | TicketStatus)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={(v) => setSeverity(v as "all" | TicketSeverity)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-muted-foreground text-sm">
            No tickets match the current filters.
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/maintenance/${t.id}`}
                  className="flex items-start justify-between gap-3 px-6 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{t.title}</span>
                      <StatusPill tone={STATUS_TONE[t.status]} label={t.status.replace("_", " ")} />
                      <StatusPill tone={SEVERITY_TONE[t.severity]} label={t.severity} iconless />
                    </div>
                    <p className="mt-1 line-clamp-1 text-muted-foreground text-xs">
                      {propertyById.get(t.propertyId)?.name ?? t.propertyId}
                      {t.unitId
                        ? ` · ${unitById.get(t.unitId)?.label ?? t.unitId}`
                        : ""}
                      {" · "}
                      {CATEGORY_LABEL[t.category]}
                      {t.assignedTo ? ` · ${t.assignedTo}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-right">
                    {t.costEstimate && (
                      <span className="font-mono text-muted-foreground text-xs tabular-nums">
                        {formatCurrency(t.costEstimate.amount, {
                          currency: t.costEstimate.currency,
                          noDecimals: true,
                        })}
                      </span>
                    )}
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
