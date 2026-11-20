"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ChecklistApprovalPreview, ChecklistApprovalRequest, ChecklistRentRow } from "@/lib/checklist/review";
import { approveChecklistAction, loadChecklistApprovalAction, prepareChecklistAgreementUploadAction } from "@/server/actions/checklist-approval";
import { createClient } from "@/lib/supabase/client";
import { useSubmission } from "@/hooks/use-submission";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { MoneyDisplay } from "@/components/app/money-display";
import { paymentMethodOptions } from "./lease-field-options";

type Receipt = ChecklistApprovalRequest["receipts"][number];

export default function ChecklistApprovalDialog({ leaseId, canRecordPayments, onClose }: { leaseId: string; canRecordPayments: boolean; onClose: () => void }) {
  const [preview, setPreview] = useState<ChecklistApprovalPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<{ file: File; path: string } | null>(null);
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});
  const [through, setThrough] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [rentConfirmed, setRentConfirmed] = useState(false);
  const [notes, setNotes] = useState("");
  const { pending, run } = useSubmission();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    loadChecklistApprovalAction(leaseId).then((result) => {
      if (!active) return;
      if (!result.ok) setError(result.error);
      else { setPreview(result.data); setThrough(result.data.today); }
    }).catch(() => { if (active) setError("Could not load the review. Close and try again."); });
    return () => { active = false; };
  }, [leaseId]);

  const receiptFor = (row: ChecklistRentRow): Receipt => ({ dueDate: row.dueDate, paidDate, amount: row.amount.amount, currency: row.amount.currency, paymentMethod: preview!.defaultPaymentMethod, reference: "" });
  const changeReceipt = (date: string, patch: Partial<Receipt>) => { setReceipts((values) => ({ ...values, [date]: { ...values[date], ...patch } })); setRentConfirmed(false); };
  const toggle = (row: ChecklistRentRow, selected: boolean) => {
    setReceipts((values) => { const next = { ...values }; if (selected) next[row.dueDate] = receiptFor(row); else delete next[row.dueDate]; return next; });
    setRentConfirmed(false);
  };
  const selected = Object.values(receipts);
  const submit = () => void run(async () => {
    if (!preview || !reviewed || !rentConfirmed) return;
    setError(null);
    if (selected.some((r) => !r.paidDate || r.paidDate > preview.today || !(r.amount > 0))) throw new Error("Enter a valid payment date and positive amount for every selected period.");
    let path = uploaded?.file === file ? uploaded.path : undefined;
    if (file && !path) {
      if (!file.size || file.size > 20 * 1024 * 1024) throw new Error("Upload a non-empty agreement up to 20 MB.");
      const prepared = await prepareChecklistAgreementUploadAction(leaseId, { contentType: file.type, size: file.size });
      if (!prepared.ok) throw new Error(prepared.error);
      const uploadedFile = await createClient().storage.from(prepared.data.bucket).uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: file.type });
      if (uploadedFile.error) throw new Error(uploadedFile.error.message);
      path = prepared.data.path;
      setUploaded({ file, path });
    }
    if (!path && !preview.hasSignedAgreement) throw new Error("Upload the executed agreement before approving.");
    const result = await approveChecklistAction(leaseId, { version: preview.version, reviewed: true, rentConfirmed: true, notes, receipts: selected }, path);
    if (!result.ok) { setError(result.error); return; }
    toast.success("Checklist signed off — lease is active", { description: `${selected.length} historical rent payments recorded.` });
    router.refresh();
    onClose();
  });

  return <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
    <DialogContent className="sm:max-w-5xl" showCloseButton={!pending}>
      <DialogHeader><DialogTitle>Review, sign off &amp; activate</DialogTitle><DialogDescription>Confirm the checklist and lease details, attach the executed agreement, and reconcile historical rent. Approval activates this lease directly.</DialogDescription></DialogHeader>
      {!preview && !error && <p role="status" className="flex items-center gap-2"><Spinner />Loading rent periods…</p>}
      {error && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</p>}
      {preview && <fieldset disabled={pending} className="min-w-0 space-y-5">
        <div className="space-y-2"><Label htmlFor="review-agreement">Executed agreement {preview.hasSignedAgreement ? "(already attached; replacement optional)" : "(required)"}</Label>
          <Input id="review-agreement" type="file" accept=".pdf,.doc,.docx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setUploaded(null); }} />
          <p className="text-xs text-muted-foreground">PDF or Word, up to 20 MB. This is the agreement already signed by the parties.</p>
        </div>
        <div className="space-y-3">
          <div><p className="font-medium">Rent already collected</p><p className="text-xs text-muted-foreground">Select each collected period and enter its actual amount and payment date. Unselected periods remain unpaid; previously recorded payments are preserved.</p></div>
          {!canRecordPayments && <p className="text-sm text-muted-foreground">You can approve without adding payments. If historical rent needs recording, an accountant or account manager must complete this step.</p>}
          {canRecordPayments && <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label htmlFor="paid-through">Select unpaid periods through</Label><Input id="paid-through" type="date" value={through} onChange={(e) => setThrough(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="collection-date">Payment date for selection</Label><Input id="collection-date" type="date" max={preview.today} value={paidDate} onChange={(e) => setPaidDate(e.target.value)} /></div>
            <Button type="button" variant="outline" disabled={!through || !paidDate || paidDate > preview.today} onClick={() => {
              setReceipts((values) => ({ ...values, ...Object.fromEntries(preview.rent.filter((r) => !r.paidDate && r.dueDate <= through).map((r) => [r.dueDate, receiptFor(r)])) })); setRentConfirmed(false);
            }}>Select periods</Button>
            <Button type="button" variant="ghost" onClick={() => { setReceipts({}); setRentConfirmed(false); }}>Clear selection</Button>
          </div>}
          <div className="max-h-80 overflow-auto rounded-md border"><Table>
            <TableHeader><TableRow><TableHead>Collected</TableHead><TableHead>Rent due</TableHead><TableHead>Scheduled / recorded</TableHead><TableHead>Amount collected</TableHead><TableHead>Payment date</TableHead><TableHead>Method / reference</TableHead></TableRow></TableHeader>
            <TableBody>{preview.rent.map((row) => { const receipt = receipts[row.dueDate]; return <TableRow key={row.dueDate}>
              <TableCell>{row.paidDate ? <span className="text-xs">Already recorded</span> : <Checkbox aria-label={`Collected rent due ${row.dueDate}`} disabled={!canRecordPayments} checked={Boolean(receipt)} onCheckedChange={(value) => toggle(row, value === true)} />}</TableCell>
              <TableCell>{row.dueDate}</TableCell><TableCell><MoneyDisplay amount={row.amount} /></TableCell>
              <TableCell>{receipt ? <div className="flex items-center gap-2"><span className="text-xs">{row.amount.currency}</span><Input className="w-32" type="number" min="0.01" step="0.01" aria-label={`Amount collected for ${row.dueDate}`} value={receipt.amount || ""} onChange={(e) => changeReceipt(row.dueDate, { amount: Number(e.target.value) })} /></div> : "—"}</TableCell>
              <TableCell>{receipt ? <Input type="date" max={preview.today} aria-label={`Payment date for ${row.dueDate}`} value={receipt.paidDate} onChange={(e) => changeReceipt(row.dueDate, { paidDate: e.target.value })} /> : row.paidDate ?? "—"}</TableCell>
              <TableCell>{receipt ? <div className="space-y-1"><NativeSelect aria-label={`Payment method for ${row.dueDate}`} value={receipt.paymentMethod} onChange={(e) => changeReceipt(row.dueDate, { paymentMethod: e.target.value as Receipt["paymentMethod"] })}>{paymentMethodOptions.map((option) => <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>)}</NativeSelect><Input placeholder="Reference (optional)" aria-label={`Reference for ${row.dueDate}`} value={receipt.reference} onChange={(e) => changeReceipt(row.dueDate, { reference: e.target.value })} /></div> : "—"}</TableCell>
            </TableRow>; })}</TableBody>
          </Table></div>
          <p className="text-sm">{selected.length} new collections selected{(["LKR", "USD"] as const).map((currency) => { const total = selected.filter((r) => r.currency === currency).reduce((sum, r) => sum + r.amount, 0); return total ? <span key={currency}> · <MoneyDisplay amount={{ amount: total, currency }} /></span> : null; })}</p>
        </div>
        <div className="space-y-2"><Label htmlFor="signoff-notes">Review notes (optional)</Label><Textarea id="signoff-notes" value={notes} maxLength={4000} onChange={(e) => setNotes(e.target.value)} /></div>
        <Label className="items-start leading-relaxed"><Checkbox checked={reviewed} onCheckedChange={(value) => setReviewed(value === true)} />I have reviewed the original checklist and mapped lease details, resolved discrepancies, and approve this import.</Label>
        <Label className="items-start leading-relaxed"><Checkbox checked={rentConfirmed} onCheckedChange={(value) => setRentConfirmed(value === true)} />{selected.length ? "I confirm the selected collections and existing payment history are correct." : "I have checked the payment history and confirm there is no additional collected rent to record."}</Label>
        <p className="text-xs text-muted-foreground">Your name and sign-off time will be saved in the lease history. Unpaid historical periods remain outstanding.</p>
      </fieldset>}
      <DialogFooter><Button variant="outline" disabled={pending} onClick={onClose}>Cancel</Button><Button disabled={!preview || !reviewed || !rentConfirmed || (!file && !preview.hasSignedAgreement) || pending} onClick={submit}>{pending ? <><Spinner />Signing off…</> : "Sign off & activate lease"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
