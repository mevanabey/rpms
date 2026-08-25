"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Currency, Money, PaymentMethod } from "@/core/types";
import { markNextRentPaidAction } from "@/server/actions";

import { useLeasePaymentsStore } from "./use-lease-payments-store";

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "lkr_transfer", label: "Bank transfer (LKR)" },
  { value: "usd_transfer", label: "Bank transfer (USD)" },
  { value: "lkr_cash", label: "Cash (LKR)" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_draft", label: "Bank draft" },
];

interface Props {
  leaseId: string;
  /** Lease's contracted monthly rent — preloads the amount input and drives
   *  the default payment method. */
  defaultAmount?: Money;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkRentPaidDialog(props: Props) {
  // Conditionally mount the body so each open is a fresh form (avoids the
  // setState-in-effect lint pattern and gives operators a clean dialog).
  if (!props.open) {
    return (
      <Dialog open={false} onOpenChange={props.onOpenChange}>
        {/* no content while closed */}
      </Dialog>
    );
  }
  return <MarkRentPaidDialogBody {...props} />;
}

function MarkRentPaidDialogBody({
  leaseId,
  defaultAmount,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const addOptimistic = useLeasePaymentsStore((s) => s.add);
  const today = new Date().toISOString().slice(0, 10);

  const defaultCurrency: Currency = defaultAmount?.currency ?? "LKR";
  const initialMethod: PaymentMethod =
    defaultCurrency === "USD" ? "usd_transfer" : "lkr_transfer";

  const [paidDate, setPaidDate] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>(initialMethod);
  const [amountText, setAmountText] = useState(
    defaultAmount ? String(defaultAmount.amount) : "",
  );
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const onSubmit = () => {
    const parsedAmount = Number(amountText.replace(/,/g, "").trim());
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount", {
        description: "Amount must be a positive number.",
      });
      return;
    }
    const payload = {
      paidDate,
      paymentMethod: method,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      amount: { amount: parsedAmount, currency: defaultCurrency },
    };
    // Close the dialog immediately and run the action in the background.
    // Server-side revalidatePath + router.refresh on dev can take several
    // seconds, which used to leave the dialog button stuck on "Saving…".
    // Decoupling means the user gets toast feedback while continuing work.
    onOpenChange(false);
    const toastId = toast.loading("Recording payment…");
    void (async () => {
      const res = await markNextRentPaidAction(leaseId, payload);
      if (!res.ok) {
        toast.error("Could not mark rent paid", {
          id: toastId,
          description: res.error,
        });
        return;
      }
      // Surface the new entry locally so the Active panel stats + the
      // Recent ledger table reflect it before router.refresh propagates.
      addOptimistic(leaseId, res.data);
      toast.success("Rent marked as paid", { id: toastId });
      router.refresh();
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark rent as paid</DialogTitle>
          <DialogDescription>
            Records receipt of the next rent line for this lease.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">Amount received</Label>
            <div className="flex items-center gap-2">
              <div className="rounded-md border bg-muted px-2.5 py-2 font-mono text-muted-foreground text-xs">
                {defaultCurrency}
              </div>
              <Input
                id="amount"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder={defaultAmount ? String(defaultAmount.amount) : "0"}
              />
            </div>
            {defaultAmount && (
              <p className="text-muted-foreground text-xs">
                Lease default monthly rent. Override if the tenant paid a
                different amount.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paidDate">Payment date</Label>
              <Input
                id="paidDate"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                max={today}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="method">Payment method</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as PaymentMethod)}
              >
                <SelectTrigger id="method">
                  <SelectValue placeholder="Choose method" />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reference">Reference</Label>
            <Input
              id="reference"
              placeholder="e.g. SLIP-0241 / Cheque #12345"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional — e.g. paid by tenant via Mr. Perera"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>
            <CheckCircle2 className="size-3.5" />
            Mark as paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
