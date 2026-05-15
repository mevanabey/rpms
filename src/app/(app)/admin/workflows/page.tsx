import { ResetDemoButton } from "@/components/app/reset-demo-button";
import { RoleGate } from "@/components/app/role-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const WORKFLOWS = [
  { kind: "onboard-tenant", trigger: "Manual / API", idem: "lease_id", phase: "P3" },
  { kind: "rent-collection-cycle", trigger: "Cron daily 06:00 LKT", idem: "obligation_id", phase: "P2" },
  { kind: "lease-lifecycle-tick", trigger: "Cron daily 07:00 LKT", idem: "lease_id+date", phase: "P2" },
  { kind: "compliance-scheduler", trigger: "Cron weekly Mon 08:00", idem: "obligation_id", phase: "P5" },
  { kind: "bank-reconcile", trigger: "Inbound email", idem: "email_id", phase: "P4" },
  { kind: "commission-accrual", trigger: "Cron monthly 1st", idem: "commission_id+month", phase: "P5" },
  { kind: "commission-payout", trigger: "Manual batch", idem: "batch_id", phase: "P5" },
  { kind: "esign-resume", trigger: "Webhook", idem: "envelope_id", phase: "P3" },
  { kind: "breach-detect", trigger: "After rent-collection", idem: "lease_id", phase: "P2" },
  { kind: "renewal-open", trigger: "Lifecycle event", idem: "lease_id", phase: "P2" },
  { kind: "move-out", trigger: "Lifecycle event", idem: "lease_id", phase: "P3" },
];

export default function WorkflowsPage() {
  return (
    <RoleGate required={["admin:workflows"]}>
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Workflows</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Vercel Workflows registry. Manual trigger, run history, retry. AgentFabriq port (Phase 03)
            is a transport swap — handlers stay the same.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            BACKEND=mock
          </Badge>
          <ResetDemoButton />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered handlers</CardTitle>
          <CardDescription>
            Each handler is <code className="font-mono">(input: ZodType) =&gt; Promise&lt;Output&gt;</code> — pure, idempotent, framework-agnostic.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Idempotency key</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead className="text-right">Run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {WORKFLOWS.map((w) => (
                <TableRow key={w.kind}>
                  <TableCell className="font-mono text-xs">{w.kind}</TableCell>
                  <TableCell className="text-xs">{w.trigger}</TableCell>
                  <TableCell className="font-mono text-muted-foreground text-xs">{w.idem}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {w.phase}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" disabled>
                      Manual run
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
          <CardDescription>
            <code className="font-mono">workflow_run</code> rows. Empty until Phase 02.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed py-10 text-center text-muted-foreground text-sm">
            No runs yet.
          </div>
        </CardContent>
      </Card>
    </div>
    </RoleGate>
  );
}
