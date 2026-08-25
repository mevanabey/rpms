"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  MessageSquare,
  Send,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDemoStore } from "@/lib/demo/store";
import {
  type TicketSeverity,
  type TicketStatus,
} from "@/lib/demo/types";
import { useTickets } from "@/lib/demo/use-store";
import { formatCurrency } from "@/lib/utils";

const STATUS_TONE: Record<TicketStatus, StatusTone> = {
  open: "warning",
  in_progress: "pending",
  blocked: "danger",
  done: "active",
  cancelled: "muted",
};

const SEVERITY_TONE: Record<TicketSeverity, StatusTone> = {
  low: "muted",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const tickets = useTickets();
  const ticket = tickets.find((t) => t.id === id);
  const updateStatus = useDemoStore((s) => s.updateTicketStatus);
  const addComment = useDemoStore((s) => s.addTicketComment);
  const [comment, setComment] = useState("");

  if (!ticket) notFound();

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div data-onborda="page-title">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/maintenance">
            <ArrowLeft className="size-3.5" /> All tickets
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-bold text-2xl tracking-tight">{ticket.title}</h1>
              <StatusPill tone={STATUS_TONE[ticket.status]} label={ticket.status.replace("_", " ")} />
              <StatusPill tone={SEVERITY_TONE[ticket.severity]} label={ticket.severity} />
              <Badge variant="outline">{ticket.category}</Badge>
            </div>
            <p className="mt-2 max-w-3xl text-muted-foreground text-sm">{ticket.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Select
              value={ticket.status}
              onValueChange={(v) => {
                updateStatus(ticket.id, v as TicketStatus, "Capital Trust handler");
                toast.success("Status updated");
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            {ticket.costCapApplies && (
              <Badge variant="outline" className="text-xs">
                <ShieldAlert className="mr-1 size-3" />
                Tenant-side · Rs. 75,000 cap
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="size-4" /> Timeline
            </CardTitle>
            <CardDescription>
              Comments, status changes, and assignments — all recorded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ticket.comments.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-muted-foreground text-sm">
                No activity yet. Add a note below.
              </div>
            ) : (
              <ul className="space-y-3">
                {ticket.comments.map((c) => (
                  <li
                    key={c.id}
                    className="flex gap-3 rounded-md border bg-muted/40 p-3"
                  >
                    <div className="mt-0.5 shrink-0">
                      {c.kind === "status_change" ? (
                        <CircleDashed className="size-4 text-blue-500" />
                      ) : c.kind === "assign" ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : c.kind === "cost_estimate" ? (
                        <ClipboardList className="size-4 text-amber-500" />
                      ) : (
                        <MessageSquare className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-sm">{c.author}</span>
                        <span className="text-muted-foreground text-[10px] tabular-nums">
                          {new Date(c.ts).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!comment.trim()) return;
                addComment(ticket.id, {
                  author: "Capital Trust handler",
                  body: comment.trim(),
                  kind: "note",
                });
                setComment("");
              }}
              className="flex flex-col gap-2 rounded-md border p-2"
            >
              <Textarea
                placeholder="Add a note (vendor confirmed, photo attached, follow-up scheduled…)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!comment.trim()}>
                  <Send className="size-3.5" /> Add note
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Property" value={ticket.propertyId}>
              <Link
                href={`/properties/${ticket.propertyId}`}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Building2 className="size-3" /> {ticket.propertyId}{" "}
                <ArrowUpRight className="size-3" />
              </Link>
            </Row>
            {ticket.unitId && <Row label="Unit" value={ticket.unitId} />}
            {ticket.leaseId && (
              <Row label="Lease">
                <Link
                  href={`/leases/${ticket.leaseId}`}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  {ticket.leaseId} <ArrowUpRight className="size-3" />
                </Link>
              </Row>
            )}
            <Row label="Reported by" value={ticket.reportedBy ?? "—"} />
            <Row label="Assigned to" value={ticket.assignedTo ?? "—"} />
            <Row label="Category" value={ticket.category} />
            <Row label="Severity">
              <StatusPill tone={SEVERITY_TONE[ticket.severity]} label={ticket.severity} />
            </Row>
            {ticket.costEstimate && (
              <Row label="Cost estimate">
                <span className="font-mono tabular-nums">
                  {formatCurrency(ticket.costEstimate.amount, {
                    currency: ticket.costEstimate.currency,
                    noDecimals: true,
                  })}
                </span>
              </Row>
            )}
            <Row label="Opened" value={new Date(ticket.ts).toLocaleString()} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children ?? value}</span>
    </div>
  );
}
