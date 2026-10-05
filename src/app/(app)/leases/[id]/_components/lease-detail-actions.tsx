"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSubmission } from "@/hooks/use-submission";

import {
  Check,
  ChevronDown,
  ChevronUp,
  FileSignature,
  FileSpreadsheet,
  LayoutGrid,
  ListChecks,
  Pencil,
  Rows3,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Lease, Party } from "@/core/types";
import {
  downloadBase64File,
  XLSX_MIME_TYPE,
} from "@/lib/file-download.client";
import {
  exportLeaseChecklistAction,
  getSignedLeaseUrlAction,
  uploadSignedLeaseAction,
} from "@/server/actions";

import { DeleteLeaseDialog } from "../../_components/delete-lease-dialog";
import { useLeaseEditing, useLeaseEditStore } from "./use-lease-edit";
import { useLeaseViewMode, useLeaseViewStore } from "./use-lease-view";
import { useProgressCollapse, useProgressOpen } from "./use-progress-collapse";

export function LeaseDetailActions({
  lease,
  parties,
}: {
  lease: Lease;
  parties: Party[];
}) {
  const router = useRouter();
  const { pending: uploading, run: upload } = useSubmission();
  const { pending: exporting, run: exportFile } = useSubmission();
  const { pending: opening, run: openFile } = useSubmission();
  const editing = useLeaseEditing(lease.id);
  const setEditing = useLeaseEditStore((s) => s.setEditing);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const progressOpen = useProgressOpen(lease.id);
  const toggleProgress = useProgressCollapse((s) => s.toggle);
  const viewMode = useLeaseViewMode(lease.id);
  const toggleView = useLeaseViewStore((s) => s.toggle);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Optimistic flag — flips the moment a signed-lease upload returns
  // success, so the button switches to "View signed lease" without waiting
  // for router.refresh() to propagate the new lease.signedLeasePath through
  // server components (which is the bit that was making the action "hang"
  // in dev).
  const [signedOverride, setSignedOverride] = useState(false);

  const tenant = parties.find((p) => p.id === lease.lesseePartyId);
  const label = tenant?.displayName ?? "this lease";
  const hasSigned = Boolean(lease.signedLeasePath) || signedOverride;
  // Signed-lease control visibility:
  //  - Always shown as "View signed lease" once the lease has a signed file
  //    (or its legal status has flipped to active/signed/etc).
  //  - The "Upload signed lease" path only appears at the Accounts step —
  //    that's the point in the workflow where the executed copy comes back
  //    from notary / advisors. Earlier steps (Draft, Send Emails, Advisor
  //    Approval) shouldn't expose it, because there's nothing to upload yet.
  const isPostSigning =
    lease.status === "signed" ||
    lease.status === "active" ||
    lease.status === "grace" ||
    lease.status === "expired" ||
    lease.status === "terminated" ||
    lease.status === "renewed";
  const showSignedControl =
    hasSigned || isPostSigning || lease.onboardingStage === "at_accounts";

  const onFilePicked = (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    void upload(async () => {
      const res = await uploadSignedLeaseAction(lease.id, fd);
      if (!res.ok) {
        toast.error("Upload failed", { description: res.error });
        return;
      }
      // Flip the button right away — refresh just keeps the rest of the
      // page in sync.
      setSignedOverride(true);
      toast.success("Signed lease uploaded", {
        description: "The lease is now active.",
      });
      router.refresh();
    });
  };

  const exportChecklist = () => {
    void exportFile(async () => {
      const res = await exportLeaseChecklistAction(lease.id);
      if (!res.ok) {
        toast.error("Could not export checklist", {
          description: res.error,
        });
        return;
      }
      downloadBase64File(res.data.base64, res.data.fileName, XLSX_MIME_TYPE);
      toast.success("Checklist exported", {
        description: res.data.fileName,
      });
    });
  };

  const openSignedLease = () => {
    void openFile(async () => {
    // Open a blank window inside the click handler so the browser doesn't
    // block the popup; redirect it once the signed URL is back from the
    // server. Avoids the previous useTransition that made the button stick
    // on "Opening…" while the server fetched the URL.
    const win = window.open("about:blank", "_blank");
    if (!win) {
      toast.error("Could not open signed lease", {
        description: "Allow popups for this site, then try again.",
      });
      return;
    }
      const res = await getSignedLeaseUrlAction(lease.id);
      if (!res.ok) {
        win.close();
        toast.error("Could not open signed lease", { description: res.error });
        return;
      }
      win.location.href = res.data.url;
    });
  };

  return (
    <>
      {/* Edit mode owns the view — it forces the details list on, and puts
          the previous view back when it's switched off — so the manual view
          toggle is disabled while editing. */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleView(lease.id)}
        aria-pressed={viewMode === "details"}
        disabled={editing}
      >
        {viewMode === "details" ? (
          <LayoutGrid className="size-3.5" />
        ) : (
          <Rows3 className="size-3.5" />
        )}
        {viewMode === "details" ? "Default view" : "Details view"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleProgress(lease.id)}
        aria-expanded={progressOpen}
        aria-controls={`lease-progress-${lease.id}`}
      >
        <ListChecks className="size-3.5" />
        Progress
        {progressOpen ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
      </Button>
      {showSignedControl &&
        (hasSigned ? (
          <Button variant="outline" size="sm" onClick={openSignedLease} disabled={opening}>
            <FileSignature className="size-3.5" />
            {opening ? "Opening…" : "View signed lease"}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-3.5" />
            {uploading ? "Uploading…" : "Upload signed lease"}
          </Button>
        ))}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.currentTarget.value = "";
          if (f) onFilePicked(f);
        }}
      />
      <Button
        variant={editing ? "default" : "outline"}
        size="sm"
        aria-pressed={editing}
        onClick={() => {
          const next = !editing;
          setEditing(lease.id, next);
          if (next) {
            toast("Edit mode on", {
              description:
                "Every field in the details list is editable — each one saves on its own as you change it.",
            });
          }
        }}
      >
        {editing ? (
          <>
            <Check className="size-3.5" /> Done
          </>
        ) : (
          <>
            <Pencil className="size-3.5" /> Edit
          </>
        )}
      </Button>
      <Button variant="outline" size="sm" onClick={exportChecklist} disabled={exporting}>
        <FileSpreadsheet className="size-3.5" /> {exporting ? "Exporting…" : "Export checklist"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="size-3.5" /> Delete
      </Button>
      <DeleteLeaseDialog
        leaseId={lease.id}
        label={label}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/leases")}
      />
    </>
  );
}
