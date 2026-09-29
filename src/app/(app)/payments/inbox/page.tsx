import { requireResource } from "@/lib/auth/authorization";
import { Inbox } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBackend } from "@/server/container";

export default async function ReconciliationInboxPage() {
  await requireResource("payments:reconcile");
  const backend = getBackend();
  const queue = await backend.payments.inboxQueue();

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Reconciliation inbox</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Inbound bank credit advices parsed into match candidates. Phase 02 wires the LLM
          extractor — see
        </p>
      </div>

      {queue.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
          <Inbox className="size-10 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Inbox empty</CardTitle>
            <CardDescription className="mt-1">
              No bank advices waiting for reconciliation. The Phase 02 inbound-email
              parser writes here.
            </CardDescription>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Queue</CardTitle>
          </CardHeader>
          <CardContent>{/* row renderer wires up in Phase 02 */}</CardContent>
        </Card>
      )}
    </div>
  );
}
