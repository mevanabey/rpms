"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteLeaseAction } from "@/server/actions";

/**
 * Confirm + soft-delete a lease. Controlled (open/onOpenChange). By default it
 * refreshes the current route; pass `onDeleted` to redirect instead (used by
 * the detail page, where the row the user is on disappears).
 */
export function DeleteLeaseDialog({
  leaseId,
  label,
  open,
  onOpenChange,
  onDeleted,
}: {
  leaseId: string;
  label?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteLeaseAction(leaseId);
      if (!result.ok) {
        toast.error("Could not delete lease", { description: result.error });
        return;
      }
      toast.success("Lease deleted", { description: label });
      onOpenChange(false);
      if (onDeleted) onDeleted();
      else router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete lease</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this lease?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
