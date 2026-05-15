"use client";

import Link from "next/link";

import { motion } from "framer-motion";
import { ArrowUpRight, Bot, ChevronRight, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";

import { AttachmentList } from "@/components/app/attachment-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LiveDot } from "@/components/ui/live-dot";
import type { ApprovalRequest } from "@/lib/demo/types";
import { WORKFLOW_LABEL } from "@/lib/demo/types";
import { useDemoStore } from "@/lib/demo/store";
import { cn, formatCurrency } from "@/lib/utils";

interface Props {
  approval: ApprovalRequest;
  /** Compact = used in dashboard / panel. Full = on /tasks page. */
  variant?: "compact" | "full";
}

export function ApprovalCard({ approval, variant = "full" }: Props) {
  const decideApproval = useDemoStore((s) => s.decideApproval);

  const handle = (optionId: string, optionLabel: string) => {
    decideApproval(approval.id, optionId, "human");
    toast.success(`Decision recorded · ${optionLabel}`, {
      description:
        "The system updated its training matrix and may execute autonomously next time.",
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card data-slot="approval-card" className={cn(variant === "compact" && "shadow-none")}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                <ShieldQuestion className="size-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">{approval.title}</CardTitle>
                <CardDescription className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                    <Bot className="size-2.5" />
                    {WORKFLOW_LABEL[approval.workflow]}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <LiveDot tone="warning" size="xs" />
                    Awaiting human decision
                  </span>
                </CardDescription>
              </div>
            </div>
            {approval.amount && (
              <div className="text-right">
                <div className="text-muted-foreground text-xs">Amount</div>
                <div className="font-medium tabular-nums">
                  {formatCurrency(approval.amount.amount, {
                    currency: approval.amount.currency,
                    noDecimals: true,
                  })}
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">{approval.question}</p>

          <ul className="space-y-1 rounded-md border bg-muted/40 p-3 text-muted-foreground text-xs">
            {approval.context.map((line) => (
              <li key={line} className="flex items-start gap-1.5">
                <ChevronRight className="mt-0.5 size-3 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {approval.attachments && approval.attachments.length > 0 && (
            <div>
              <div className="mb-1.5 text-muted-foreground text-[11px] uppercase tracking-wider">
                Documents ({approval.attachments.length})
              </div>
              <AttachmentList attachments={approval.attachments} />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {approval.options.map((opt) => (
              <Button
                key={opt.id}
                onClick={() => handle(opt.id, opt.label)}
                variant={
                  opt.tone === "primary"
                    ? "default"
                    : opt.tone === "destructive"
                      ? "destructive"
                      : "outline"
                }
                size="sm"
              >
                {opt.label}
              </Button>
            ))}
            {approval.leaseId && (
              <Button asChild variant="ghost" size="sm" className="ml-auto">
                <Link href={`/leases/${approval.leaseId}`}>
                  View lease <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
