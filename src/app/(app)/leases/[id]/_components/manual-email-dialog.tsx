"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSubmission } from "@/hooks/use-submission";
import { toast } from "sonner";
import type { Lease } from "@/core/types";
import { markLeaseEmailManuallySentAction } from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

export function ManualEmailDialog({ leaseId, kind, disabled, onLeaseUpdated }: {
  leaseId: string;
  kind: "lawyer" | "advisor" | "accounts";
  disabled?: boolean;
  onLeaseUpdated: (lease: Lease) => void;
}) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState("");
  const [note, setNote] = useState("");
  const { pending, run: start } = useSubmission();
  const router = useRouter();
  return <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
    <DialogTrigger asChild><Button variant="outline" size="sm" disabled={disabled}>
      {kind === "accounts" ? "Approved · Accounts email sent manually" : `${kind === "lawyer" ? "Lawyer" : "Advisor"} email sent manually`}
    </Button></DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Confirm email sent to {kind === "advisor" ? "advisors" : kind}</DialogTitle>
        <DialogDescription>Use this after sending the email outside RPMS. Your confirmation is saved in lease history and advances the workflow when all required emails are confirmed.{kind === "accounts" ? " This also confirms advisor approval." : ""}</DialogDescription>
      </DialogHeader>
      <form aria-busy={pending} className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        void start(async () => {
          const result = await markLeaseEmailManuallySentAction(leaseId, {
            kind, recipients: recipients.split(/[,;\s]+/).filter(Boolean), note,
          });
          if (!result.ok) { toast.error("Could not confirm email", { description: result.error }); return; }
          onLeaseUpdated(result.data);
          setOpen(false);
          toast.success("Manual email confirmation saved");
          router.refresh();
        });
      }}>
        <div className="space-y-2"><Label htmlFor={`manual-recipients-${kind}`}>Recipients</Label><Input disabled={pending} id={`manual-recipients-${kind}`} required value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="Separate email addresses with commas" /></div>
        <div className="space-y-2"><Label htmlFor={`manual-note-${kind}`}>Email details</Label><Textarea disabled={pending} id={`manual-note-${kind}`} required minLength={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="When it was sent, subject, and any approval details" /></div>
        <DialogFooter><Button disabled={pending} type="submit">{pending ? "Saving…" : "Confirm email was sent"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
