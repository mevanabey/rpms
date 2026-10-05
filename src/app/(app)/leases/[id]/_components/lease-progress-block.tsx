"use client";

import { useSubmission } from "@/hooks/use-submission";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileSignature,
  FileText,
  Receipt,
  RefreshCw,
  Send,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lease, LeaseStatus, Money, OnboardingStage, PaymentCadence } from "@/core/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  generateLeaseAgreementAction,
  generateRentScheduleAction,
  getLeaseAgreementUrlAction,
  loadLeaseDocumentDataAction,
  markLeaseActiveAction,
  sendLeaseEmailAction,
  uploadLeaseAgreementAction,
} from "@/server/actions";
import { downloadInvoice } from "@/templates/leases/lease-invoice";

import { MarkRentPaidDialog } from "./mark-rent-paid-dialog";
import { useOptimisticPaidEntries } from "./use-lease-payments-store";
import { useProgressOpen } from "./use-progress-collapse";
import { ManualEmailDialog } from "./manual-email-dialog";
import { useCanCheck } from "@/lib/demo/use-store";

interface Stage {
  key: "draft" | "send_emails" | "advisor_approval" | "accounts" | "active";
  label: string;
}

const STAGES: Stage[] = [
  { key: "draft", label: "Draft" },
  { key: "send_emails", label: "Send Emails" },
  { key: "advisor_approval", label: "Advisor Approval" },
  { key: "accounts", label: "Accounts" },
  { key: "active", label: "Active" },
];

function currentStageIndex(status: LeaseStatus, onboardingStage?: OnboardingStage): number {
  if (
    status === "signed" ||
    status === "active" ||
    status === "grace" ||
    status === "expired" ||
    status === "terminated" ||
    status === "renewed"
  ) {
    return 4;
  }
  if (onboardingStage === "at_accounts") return 3;
  if (onboardingStage === "emails_sent") return 2;
  if (onboardingStage === "agreement_ready") return 1;
  return 0;
}

export interface LeaseProgressData {
  leaseId: string;
  status: LeaseStatus;
  onboardingStage?: OnboardingStage;
  agreementPath?: string;
  lawyerEmailSentAt?: string;
  advisorEmailSentAt?: string;
  /** Earliest unpaid rent line, or first tranche start as a fallback. */
  nextDueDate?: string;
  paymentsMade?: number;
  cumulativeBalance?: { amount: number; currency: "LKR" | "USD" };
  /** Rent currency used to default the Mark-as-paid method. */
  rentCurrency?: "LKR" | "USD";
  /** Contracted monthly rent — preloads the amount field on Mark-as-paid
   *  and drives the default payment method. */
  rentAmount?: Money;
  /** Lease's payment cadence — drives how the "Next due" date advances
   *  when an optimistic Mark-paid bumps the schedule forward. */
  paymentCadence?: PaymentCadence;
  /** IDs of rent ledger entries the server already considers PAID. Used to
   *  dedupe against the optimistic overlay — once router.refresh propagates
   *  the new entry, the same id appears in both places and we must not
   *  count it twice. */
  serverPaidEntryIds?: readonly string[];
  /** "Today" in ISO yyyy-mm-dd for the overdue check. */
  today: string;
}

/**
 * Subset of `Lease` that drives the stepper. Server actions return a full
 * `Lease`; we extract these fields and overlay them on top of the props so
 * the panel advances *before* `router.refresh()` finishes — which in Next 16
 * doesn't reliably re-render server components after a mutation.
 */
type ProgressOverride = {
  status: LeaseStatus;
  onboardingStage?: OnboardingStage;
  agreementPath?: string;
  lawyerEmailSentAt?: string;
  advisorEmailSentAt?: string;
};

function leaseToOverride(lease: Lease): ProgressOverride {
  return {
    status: lease.status,
    onboardingStage: lease.onboardingStage,
    agreementPath: lease.agreementPath,
    lawyerEmailSentAt: lease.lawyerEmailSentAt,
    advisorEmailSentAt: lease.advisorEmailSentAt,
  };
}

export function LeaseProgressBlock(props: LeaseProgressData) {
  const open = useProgressOpen(props.leaseId);
  if (!open) return null;
  // Keying the body on the lease state means when the server catches up
  // (props change) the body remounts and any optimistic override resets to
  // null. Until then, the override drives the visible stage.
  const propsKey = [
    props.status,
    props.onboardingStage ?? "",
    props.agreementPath ?? "",
    props.lawyerEmailSentAt ?? "",
    props.advisorEmailSentAt ?? "",
  ].join("|");
  return <LeaseProgressBlockBody key={propsKey} {...props} />;
}

function LeaseProgressBlockBody(props: LeaseProgressData) {
  const [override, setOverride] = useState<ProgressOverride | null>(null);
  const merged: LeaseProgressData = override ? { ...props, ...override } : props;
  const current = currentStageIndex(merged.status, merged.onboardingStage);
  const onLeaseUpdated = (lease: Lease) => setOverride(leaseToOverride(lease));

  return (
    <Card id={`lease-progress-${props.leaseId}`}>
      <CardHeader>
        <CardTitle className="text-sm">Lease progress</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {STAGES.map((s, i) => {
            const last = i === STAGES.length - 1;
            // The final stage ("Active") is the terminal state — when we're
            // AT it, treat it as done (green + tick), not "current". The
            // blue "5" with a number used to read as "in progress, not
            // done", which was confusing for the actual active lease.
            const done = i < current || (last && i === current);
            const cur = i === current && !done;
            return (
              <li key={s.key} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border text-xs font-medium",
                    done &&
                      "border-emerald-500 bg-emerald-500 text-white dark:border-emerald-500 dark:bg-emerald-500",
                    cur && !done && "border-primary bg-primary/10 text-primary",
                    !done && !cur && "border-muted-foreground/30 text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "whitespace-nowrap text-xs",
                    cur && "font-medium text-foreground",
                    !cur && !done && "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
                {!last && (
                  <span
                    aria-hidden
                    className={cn(
                      "text-xs",
                      done ? "text-emerald-500" : "text-muted-foreground/50",
                    )}
                  >
                    →
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <StagePanel current={current} onLeaseUpdated={onLeaseUpdated} {...merged} />
      </CardContent>
    </Card>
  );
}

type PanelExtras = { onLeaseUpdated: (lease: Lease) => void };
type PanelProps = LeaseProgressData & PanelExtras;

// ─────────────────────────────────────────────── stage panels

function PanelShell({
  description,
  children,
}: {
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4">
      {description && (
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function StagePanel(props: PanelProps & { current: number }) {
  const { current } = props;
  if (current === 0) return <DraftPanel {...props} />;
  if (current === 1) return <SendEmailsPanel {...props} />;
  if (current === 2) return <AdvisorApprovalPanel {...props} />;
  if (current === 3) return <AccountsPanel {...props} />;
  return <ActivePanel {...props} />;
}

function DraftPanel({ leaseId, onLeaseUpdated }: PanelProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const { pending: busy, run } = useSubmission();
  const [operation, setOperation] = useState<"upload" | "generate">("upload");
  const uploading = busy && operation === "upload";
  const generating = busy && operation === "generate";

  const onUploadPicked = (file: File) => {
    void run(async () => {
      setOperation("upload");
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadLeaseAgreementAction(leaseId, fd);
      if (!res.ok) {
        toast.error("Upload failed", { description: res.error });
        return;
      }
      toast.success("Lease agreement uploaded");
      onLeaseUpdated(res.data);
      router.refresh();
    });
  };

  const onGenerate = () => {
    void run(async () => {
      setOperation("generate");
      try {
        const res = await generateLeaseAgreementAction(leaseId);
        if (!res.ok) {
          toast.error("Could not generate agreement", { description: res.error });
          return;
        }
        // Open the freshly-uploaded copy in a new tab so the user gets it.
        window.open(res.data.url, "_blank", "noopener,noreferrer");
        toast.success("Lease agreement generated", {
          description: "Saved to the lease.",
        });
        onLeaseUpdated(res.data.lease);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[generate lease agreement]", err);
        toast.error("Could not generate document", { description: message });
      }
    });
  };


  return (
    <PanelShell description="Review the figures, then either generate the lease agreement from the template or upload a manually-prepared one.">
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
      >
        <Upload className="size-3.5" />
        {uploading ? "Uploading…" : "Upload Lease Agreement"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.currentTarget.value = "";
          if (f) onUploadPicked(f);
        }}
      />
      <Button size="sm" onClick={onGenerate} disabled={busy}>
        <Sparkles className="size-3.5" />
        {generating ? "Generating…" : "Generate Lease Agreement"}
      </Button>
    </PanelShell>
  );
}

type SendResult = Lease & { emailedTo: string[]; redirected: boolean };

/**
 * Toast detail for a completed send. Always names the addresses reached — an
 * unqualified "sent" gives the operator no way to catch mail that went to a
 * stale address on a party record.
 *
 * `redirected` means MAIL_REDIRECT_TO intercepted the message, so it never
 * reached the lawyer. That has to be loud: the stepper will show the stage as
 * advanced, and without this warning a staging send looks identical to a real
 * one.
 */
function describeSend(data: SendResult): { description: string } | undefined {
  const to = data.emailedTo.join(", ");
  if (data.redirected) {
    return {
      description: `⚠ Redirected to the test mailbox — ${to || "the real recipients"} were NOT emailed. Unset MAIL_REDIRECT_TO to send for real.`,
    };
  }
  return to ? { description: `Delivered to ${to}` } : undefined;
}

function ViewAgreementButton({ leaseId }: { leaseId: string }) {
  const { pending: opening, run: start } = useSubmission();
  const onClick = () => {
    start(async () => {
      const res = await getLeaseAgreementUrlAction(leaseId);
      if (!res.ok) {
        toast.error("Could not open agreement", { description: res.error });
        return;
      }
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    });
  };
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={opening}>
      <FileText className="size-3.5" />
      {opening ? "Opening…" : "View agreement"}
    </Button>
  );
}

function SendEmailsPanel({
  leaseId,
  lawyerEmailSentAt,
  advisorEmailSentAt,
  onLeaseUpdated,
}: PanelProps) {
  const router = useRouter();
  const { pending: busy, run: start } = useSubmission();
  const lawyerSent = Boolean(lawyerEmailSentAt);
  const advisorSent = Boolean(advisorEmailSentAt);

  const sendOne = (kind: "lawyer" | "advisor") => {
    start(async () => {
      const res = await sendLeaseEmailAction(leaseId, kind);
      if (!res.ok) {
        toast.error("Could not send email", { description: res.error });
        return;
      }
      toast.success(
        `Sent to ${kind === "lawyer" ? "lawyer" : "advisors"}`,
        describeSend(res.data),
      );
      onLeaseUpdated(res.data);
      router.refresh();
    });
  };

  const sendRemaining = () => {
    start(async () => {
      const pending: ("lawyer" | "advisor")[] = [];
      if (!lawyerSent) pending.push("lawyer");
      if (!advisorSent) pending.push("advisor");
      if (pending.length === 0) return;
      let last: SendResult | undefined;
      for (const kind of pending) {
        const res = await sendLeaseEmailAction(leaseId, kind);
        if (!res.ok) {
          // Stop on the first failure rather than pressing on — a partial
          // send leaves the stepper honest about which side was reached.
          toast.error(`Could not send ${kind} email`, { description: res.error });
          if (last) {
            onLeaseUpdated(last);
            router.refresh();
          }
          return;
        }
        last = res.data;
      }
      toast.success(
        `Sent ${pending.length} email${pending.length === 1 ? "" : "s"}`,
        last ? describeSend(last) : undefined,
      );
      if (last) onLeaseUpdated(last);
      router.refresh();
    });
  };

  return (
    <PanelShell
      description={
        <span>
          Agreement is ready for review. Send it to the lawyer and the advisors.
          {" "}
          <span className="text-foreground">
            Lawyer: {lawyerSent ? <span className="text-emerald-600">sent {formatDate(lawyerEmailSentAt!)}</span> : "not sent"} ·{" "}
            Advisors: {advisorSent ? <span className="text-emerald-600">sent {formatDate(advisorEmailSentAt!)}</span> : "not sent"}
          </span>
        </span>
      }
    >
      <ViewAgreementButton leaseId={leaseId} />
      <Button
        variant="outline"
        size="sm"
        onClick={() => sendOne("lawyer")}
        disabled={busy || lawyerSent}
      >
        <Send className="size-3.5" />
        {lawyerSent ? "Sent to lawyer" : "Send To Lawyer"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => sendOne("advisor")}
        disabled={busy || advisorSent}
      >
        <Send className="size-3.5" />
        {advisorSent ? "Sent to advisors" : "Send To Advisors"}
      </Button>
      <Button
        size="sm"
        onClick={sendRemaining}
        disabled={busy || (lawyerSent && advisorSent)}
      >
        <Send className="size-3.5" />
        {busy ? "Sending…" : lawyerSent && advisorSent ? "Both sent" : "Send Emails"}
      </Button>
      <ManualEmailDialog leaseId={leaseId} kind="lawyer" disabled={busy || lawyerSent} onLeaseUpdated={onLeaseUpdated} />
      <ManualEmailDialog leaseId={leaseId} kind="advisor" disabled={busy || advisorSent} onLeaseUpdated={onLeaseUpdated} />
    </PanelShell>
  );
}

function AdvisorApprovalPanel({ leaseId, onLeaseUpdated }: PanelProps) {
  const router = useRouter();
  const { pending: busy, run: start } = useSubmission();
  const advance = () => {
    start(async () => {
      const res = await sendLeaseEmailAction(leaseId, "accounts");
      if (!res.ok) {
        toast.error("Could not send accounts email", { description: res.error });
        return;
      }
      toast.success("Sent to accounts · moved to Accounts", describeSend(res.data));
      onLeaseUpdated(res.data);
      router.refresh();
    });
  };
  return (
    <PanelShell description="Lawyer and advisors notified. Mark the lease approved by the advisors — this also emails accounts.">
      <ViewAgreementButton leaseId={leaseId} />
      <Button size="sm" onClick={advance} disabled={busy}>
        <CheckCircle2 className="size-3.5" />
        {busy ? "Saving…" : "Mark Approved · Send to accounts"}
        <ArrowRight className="size-3.5" />
      </Button>
      <ManualEmailDialog leaseId={leaseId} kind="accounts" disabled={busy} onLeaseUpdated={onLeaseUpdated} />
    </PanelShell>
  );
}

function AccountsPanel({ leaseId, onLeaseUpdated }: PanelProps) {
  const router = useRouter();
  const { pending: busy, run: start } = useSubmission();
  const activate = () => {
    start(async () => {
      const res = await markLeaseActiveAction(leaseId);
      if (!res.ok) {
        toast.error("Could not activate lease", { description: res.error });
        return;
      }
      toast.success("Lease is now active");
      onLeaseUpdated(res.data);
      router.refresh();
    });
  };
  return (
    <PanelShell description="With accounts for execution. Flip the lease to active once it's signed and on the books.">
      <ViewAgreementButton leaseId={leaseId} />
      <Button size="sm" onClick={activate} disabled={busy}>
        <FileSignature className="size-3.5" />
        {busy ? "Activating…" : "Mark As Active Lease"}
        <ArrowRight className="size-3.5" />
      </Button>
    </PanelShell>
  );
}

function ActivePanel({
  leaseId,
  nextDueDate,
  paymentsMade,
  cumulativeBalance,
  rentCurrency,
  rentAmount,
  paymentCadence,
  serverPaidEntryIds,
  today,
}: PanelProps) {
  const can = useCanCheck();
  const router = useRouter();
  // Optimistic ledger overlay — see use-lease-payments-store. Each entry
  // the operator marked-paid since the last server snapshot adds to the
  // counts and shifts "Next due" forward by one cadence period.
  //
  // Dedupe by id against `serverPaidEntryIds`: once `router.refresh()` has
  // propagated the new entry, the same id is present in both the server
  // props *and* the optimistic store. Without this filter the panel
  // would count it twice and the visible figures would briefly disagree
  // with the truth.
  const optimisticRaw = useOptimisticPaidEntries(leaseId);
  const knownIds = useMemo(
    () => new Set(serverPaidEntryIds ?? []),
    [serverPaidEntryIds],
  );
  const optimistic = useMemo(
    () => optimisticRaw.filter((e) => !knownIds.has(e.id)),
    [optimisticRaw, knownIds],
  );
  const cadenceMonths =
    paymentCadence === "quarterly" ? 3 : paymentCadence === "biannual" ? 6 : 1;

  const adjPaymentsMade = (paymentsMade ?? 0) + optimistic.length;

  const adjCumulativeBalance = (() => {
    if (optimistic.length === 0) return cumulativeBalance;
    const currency = (cumulativeBalance?.currency ?? rentAmount?.currency) as
      | "LKR"
      | "USD"
      | undefined;
    if (!currency || !rentAmount) return cumulativeBalance;
    const delta = optimistic.reduce((sum, e) => {
      if (e.amount.currency !== currency) return sum;
      const expected = rentAmount.currency === currency ? rentAmount.amount : 0;
      return sum + (e.amount.amount - expected);
    }, 0);
    return {
      amount: (cumulativeBalance?.amount ?? 0) + delta,
      currency,
    };
  })();

  const adjNextDueDate = (() => {
    if (optimistic.length === 0 || !nextDueDate) return nextDueDate;
    const [y, m, d] = nextDueDate.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCMonth(dt.getUTCMonth() + cadenceMonths * optimistic.length);
    return dt.toISOString().slice(0, 10);
  })();

  const isOverdue = Boolean(adjNextDueDate && adjNextDueDate < today);
  const { pending: busy, run: start } = useSubmission();
  const { pending: regenerating, run: startRegenerate } = useSubmission();
  const [paidOpen, setPaidOpen] = useState(false);

  const regenerateSchedule = () => {
    startRegenerate(async () => {
      const res = await generateRentScheduleAction(leaseId);
      if (!res.ok) {
        toast.error("Could not regenerate schedule", { description: res.error });
        return;
      }
      const { created, skipped } = res.data;
      toast.success(
        created === 0
          ? "Schedule already up to date"
          : `Added ${created} rent ${created === 1 ? "entry" : "entries"}`,
        skipped > 0
          ? { description: `${skipped} existing ${skipped === 1 ? "entry" : "entries"} kept.` }
          : undefined,
      );
      router.refresh();
    });
  };

  const generate = (overdue: boolean) => {
    start(async () => {
      const res = await loadLeaseDocumentDataAction(leaseId);
      if (!res.ok) {
        toast.error("Could not load lease data", { description: res.error });
        return;
      }
      try {
        const t = res.data.tranches[0];
        await downloadInvoice(res.data, {
          amount: t?.monthlyRent,
          dueDate: adjNextDueDate,
          isOverdue: overdue,
        });
        toast.success(overdue ? "Disconnection notice generated" : "Invoice generated");
      } catch (err) {
        toast.error("Could not generate invoice", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          icon={<CircleDollarSign className="size-4 text-muted-foreground" />}
          label={`Payment${adjPaymentsMade === 1 ? "" : "s"} made`}
          value={String(adjPaymentsMade)}
        />
        <Stat
          icon={<Receipt className="size-4 text-muted-foreground" />}
          label="Cumulative balance"
          value={
            adjCumulativeBalance
              ? `${adjCumulativeBalance.amount > 0 ? "+" : ""}${formatCurrency(
                  adjCumulativeBalance.amount,
                  { currency: adjCumulativeBalance.currency, noDecimals: true },
                )}`
              : "—"
          }
          tone={
            !adjCumulativeBalance || adjCumulativeBalance.amount === 0
              ? undefined
              : adjCumulativeBalance.amount > 0
                ? "success"
                : "danger"
          }
        />
        <Stat
          icon={
            isOverdue ? (
              <AlertTriangle className="size-4 text-rose-600" />
            ) : (
              <CalendarClock className="size-4 text-muted-foreground" />
            )
          }
          label={isOverdue ? "Overdue since" : "Next due"}
          value={adjNextDueDate ? formatDate(adjNextDueDate) : "—"}
          tone={isOverdue ? "danger" : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <span className="text-muted-foreground text-xs">
          Rent collection — invoices go out 2 weeks, 1 week, and on the due date; an overdue notice fires 1 day past.
        </span>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href="/rent">
              <Receipt className="size-3.5" /> Go to rent
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={regenerateSchedule}
            disabled={regenerating}
            title="Materialise any missing monthly rent ledger entries"
          >
            <RefreshCw className={cn("size-3.5", regenerating && "animate-spin")} />
            {regenerating ? "Regenerating…" : "Regenerate schedule"}
          </Button>
          {isOverdue && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => generate(true)}
              disabled={busy}
            >
              <AlertTriangle className="size-3.5" />
              {busy ? "…" : "Generate disconnection notice"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => generate(false)}
            disabled={busy}
          >
            <Download className="size-3.5" />
            {busy ? "Preparing…" : "Generate Invoice"}
          </Button>
          {can("payments:write") && <Button size="sm" onClick={() => setPaidOpen(true)} disabled={busy}>
            <CheckCircle2 className="size-3.5" />
            Mark as Paid
          </Button>}
        </div>
      </div>

      <MarkRentPaidDialog
        leaseId={leaseId}
        defaultAmount={
          rentAmount ??
          (rentCurrency || cumulativeBalance?.currency
            ? {
                amount: 0,
                currency: (rentCurrency ?? cumulativeBalance!.currency) as "LKR" | "USD",
              }
            : undefined)
        }
        open={paidOpen}
        onOpenChange={setPaidOpen}
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-card px-3 py-2",
        tone === "danger" && "border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40",
        tone === "success" && "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
      )}
    >
      {icon}
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span
          className={cn(
            "font-medium text-sm tabular-nums text-foreground",
            tone === "danger" && "text-rose-700 dark:text-rose-200",
            tone === "success" && "text-emerald-700 dark:text-emerald-200",
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
