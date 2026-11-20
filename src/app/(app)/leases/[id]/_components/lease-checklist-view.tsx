"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import type { SavedChecklist } from "@/core/checklists";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useSubmission } from "@/hooks/use-submission";
import { attachChecklistAction, loadChecklistAction } from "@/server/actions/checklist";
import { ChecklistSourceTable } from "./checklist-source-table";
import { ChecklistUploadErrorPanel } from "@/components/checklist/upload-error-panel";
import { checklistUploadProblem, type ChecklistUploadProblem } from "@/lib/checklist/upload-errors";

export default function LeaseChecklistView({ leaseId, canEdit }: { leaseId: string; canEdit: boolean }) {
  const [checklist, setChecklist] = useState<SavedChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [uploadProblem, setUploadProblem] = useState<ChecklistUploadProblem | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { pending, run } = useSubmission();

  useEffect(() => {
    let active = true;
    loadChecklistAction(leaseId).then((result) => {
      if (!active) return;
      if (result.ok) setChecklist(result.data);
      else setError(result.error);
      setLoading(false);
    }).catch(() => {
      if (active) { setError("Could not load the checklist. Please retry."); setLoading(false); }
    });
    return () => { active = false; };
  }, [leaseId, attempt]);

  if (loading) return <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status"><Spinner />Loading original checklist…</CardContent></Card>;
  if (error) return <Card><CardContent className="space-y-3 p-6"><p role="alert" className="text-sm">{error}</p><Button variant="outline" onClick={() => { setError(null); setLoading(true); setAttempt((value) => value + 1); }}>Retry</Button></CardContent></Card>;
  if (checklist) return <ChecklistSourceTable checklist={checklist} />;

  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="size-4" />Original checklist not saved</CardTitle>
      <CardDescription>This agreement was created manually or imported before original checklists were preserved. The original rows and ordering cannot be recovered from the mapped lease fields.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {canEdit ? <>
        <p className="text-sm text-muted-foreground">Attach its original file to enable Checklist View. This preserves the source without changing the agreement’s fields or creating another lease.</p>
        <input ref={input} type="file" className="hidden" accept=".xlsx,.xls,.ods,.csv" aria-label="Original checklist file" onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void run(async () => {
            setUploadProblem(null);
            let source;
            try {
              const { parseChecklistSource } = await import("@/lib/checklist/parse");
              source = parseChecklistSource(await file.arrayBuffer(), file.name);
            } catch (error) {
              setUploadProblem(checklistUploadProblem(error, "read"));
              return;
            }
            try {
              const result = await attachChecklistAction(leaseId, source);
              if (!result.ok) { setUploadProblem(result.problem ?? checklistUploadProblem(null, "prepare")); return; }
              setChecklist(result.data);
            } catch {
              setUploadProblem({ title: "We couldn’t confirm the checklist was attached", explanation: "The connection was interrupted while saving the checklist.", steps: ["Reload the page to check whether it was saved. If the original is still missing, attach it again."], recovery: "retry" });
            }
          });
        }} />
        <Button variant="outline" disabled={pending} onClick={() => input.current?.click()}>{pending ? <Spinner /> : <Upload className="size-4" />}{pending ? "Saving checklist…" : "Attach original checklist"}</Button>
        {uploadProblem && <ChecklistUploadErrorPanel problem={uploadProblem} disabled={pending} onReplace={() => input.current?.click()} />}
      </> : <p className="text-sm text-muted-foreground">An editor can attach the original checklist for this agreement.</p>}
    </CardContent>
  </Card>;
}
