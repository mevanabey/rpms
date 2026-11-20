"use client";

import type { ChecklistUploadProblem } from "@/lib/checklist/upload-errors";
import { Button } from "@/components/ui/button";

export function ChecklistUploadErrorPanel({ problem, onReplace, onRetry, disabled }: {
  problem: ChecklistUploadProblem;
  onReplace?: () => void;
  onRetry?: () => void;
  disabled?: boolean;
}) {
  return <div className="mt-2 min-w-64 max-w-xl whitespace-normal rounded-md border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-900 dark:bg-rose-950/30">
    <div role="alert">
      <p className="font-medium">{problem.title}</p>
      <p className="mt-1 text-muted-foreground">{problem.explanation}</p>
      <p className="mt-3 font-medium">What to do</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
        {problem.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      {problem.reference && <p className="mt-2 text-xs text-muted-foreground">Help reference: {problem.reference}</p>}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {problem.recovery === "replace" && onReplace && <Button variant="outline" size="sm" disabled={disabled} onClick={onReplace}>Choose corrected file</Button>}
      {["retry", "sign_in", "contact_admin"].includes(problem.recovery) && onRetry && <Button variant="outline" size="sm" disabled={disabled} onClick={onRetry}>Try again</Button>}
      {problem.recovery === "sign_in" && <Button variant="outline" size="sm" asChild><a href="/login" target="_blank" rel="noopener noreferrer">Sign in in a new tab</a></Button>}
      {problem.recovery === "check_leases" && <Button variant="outline" size="sm" asChild><a href="/leases" target="_blank" rel="noopener noreferrer">Check Leases in a new tab</a></Button>}
    </div>
  </div>;
}
