"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  AlertTriangle,
  Database,
  Eraser,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { RoleGate } from "@/components/app/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useDemoStore } from "@/lib/demo/store";

import {
  clearMockBackend,
  getMockBackendCounts,
  resetMockBackend,
} from "./actions";

type Mode = "reset" | "clear";

const BACKEND_LABEL: Record<string, string> = {
  leases: "Leases",
  parties: "Parties",
  properties: "Properties",
  units: "Units",
  obligations: "Obligations",
  ledger: "Ledger entries",
  notifications: "Notifications",
};

export default function DemoDataPage() {
  const router = useRouter();
  const resetDemo = useDemoStore((s) => s.resetDemo);
  const clearDemo = useDemoStore((s) => s.clearDemo);
  const [pending, setPending] = useState<Mode | null>(null);
  const [backendCounts, setBackendCounts] = useState<Record<string, number> | null>(null);
  const [isApplying, startTransition] = useTransition();

  useEffect(() => {
    void getMockBackendCounts().then(setBackendCounts);
  }, []);

  const counts = useDemoStore(
    useShallow((s) => ({
      activities: s.activities.length,
      approvals: s.approvals.length,
      draftLeases: s.draftLeases.length,
      draftProperties: s.draftProperties.length,
      draftUnits: s.draftUnits.length,
      draftParties: s.draftParties.length,
      tickets: s.tickets.length,
      rentPayments: Object.keys(s.rentPayments).length,
      rentReminders: s.rentReminders.length,
      templateOverrides: Object.keys(s.templateOverrides).length,
    })),
  );

  const totalOverlay = useMemo(
    () => Object.values(counts).reduce((sum, n) => sum + n, 0),
    [counts],
  );

  const handleConfirm = () => {
    const mode = pending;
    if (!mode) return;
    startTransition(async () => {
      try {
        if (mode === "reset") {
          resetDemo();
          const res = await resetMockBackend();
          setBackendCounts(res.counts);
          toast.success("Demo data reset to seed", {
            description:
              "Leases, parties, properties and the ledger are back to seed.",
          });
        } else {
          clearDemo();
          const res = await clearMockBackend();
          setBackendCounts(res.counts);
          toast.success("Everything cleared", {
            description:
              "Overlay + backend leases, parties, properties and ledger emptied.",
          });
        }
        router.refresh();
      } catch (err) {
        toast.error("Couldn't apply", {
          description: err instanceof Error ? err.message : "Server action failed",
        });
      } finally {
        setPending(null);
      }
    });
  };

  return (
    <RoleGate required={["admin:reset-demo"]}>
      <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Demo data</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Reset both the in-browser overlay (activities, approvals, drafts)
            <em> and</em> the server-rendered mock backend (leases, parties,
            properties, ledger) to the seeded scenario — or clear everything to
            start from a blank slate.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4" />
              Browser overlay
            </CardTitle>
            <CardDescription>
              Persisted in this browser&apos;s local storage — activities,
              approvals, drafts, tickets, manual rent paids and reminders.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            <CountTile label="Activities" value={counts.activities} />
            <CountTile label="Approvals" value={counts.approvals} />
            <CountTile label="Draft leases" value={counts.draftLeases} />
            <CountTile label="Draft properties" value={counts.draftProperties} />
            <CountTile label="Draft units" value={counts.draftUnits} />
            <CountTile label="Draft parties" value={counts.draftParties} />
            <CountTile label="Tickets" value={counts.tickets} />
            <CountTile label="Manual rent paids" value={counts.rentPayments} />
            <CountTile label="Rent reminders" value={counts.rentReminders} />
            <CountTile label="Template overrides" value={counts.templateOverrides} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4" />
              Backend (mock adapter)
            </CardTitle>
            <CardDescription>
              Server-rendered domain data — leases, parties, properties, units,
              obligations, ledger entries and reminder notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {backendCounts
              ? Object.entries(backendCounts).map(([key, value]) => (
                  <CountTile
                    key={key}
                    label={BACKEND_LABEL[key] ?? key}
                    value={value}
                  />
                ))
              : Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-9 animate-pulse rounded-md border bg-muted/30"
                  />
                ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4" />
                Reset to seed
              </CardTitle>
              <CardDescription>
                Restores the overlay AND the backend to their seeded state.
                Drafts created from the wizard or checklist upload are
                discarded.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setPending("reset")}
                className="w-full sm:w-auto"
                disabled={isApplying}
              >
                <RefreshCw className="size-3.5" />
                Reset to seed
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eraser className="size-4" />
                Clear everything
              </CardTitle>
              <CardDescription>
                Empties overlay <em>and</em> backend — no leases, parties,
                properties, ledger or activity. Useful for starting a client
                demo from a completely blank slate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => setPending("clear")}
                className="w-full sm:w-auto"
                disabled={isApplying}
              >
                <Eraser className="size-3.5" />
                Clear everything
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-muted-foreground text-sm">
              Backend mutations are in-memory on the dev server and shared by
              every browser tab connected to it — and discarded on restart.
              A full restore from <code className="font-mono text-xs">pnpm dev</code>{" "}
              still works at any point.
            </p>
          </CardContent>
        </Card>

        <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {pending === "reset" ? "Reset everything to seed?" : "Clear everything?"}
              </DialogTitle>
              <DialogDescription>
                {pending === "reset"
                  ? "Local overlay and the backend (leases, parties, properties, ledger) will be restored to the seeded scenario."
                  : "Every overlay collection AND every backend collection will be emptied. Leases, parties, properties and the ledger will all be gone until you reset or restart the dev server."}
              </DialogDescription>
            </DialogHeader>
            <Separator />
            <div className="text-muted-foreground text-xs">
              Overlay holds {totalOverlay} item{totalOverlay === 1 ? "" : "s"}.
              {backendCounts && (
                <>
                  {" "}
                  Backend holds{" "}
                  {Object.values(backendCounts).reduce((a, b) => a + b, 0)} record
                  {Object.values(backendCounts).reduce((a, b) => a + b, 0) === 1
                    ? ""
                    : "s"}
                  .
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button
                variant={pending === "clear" ? "destructive" : "default"}
                onClick={handleConfirm}
                disabled={isApplying}
              >
                {isApplying
                  ? "Working…"
                  : pending === "reset"
                    ? "Reset to seed"
                    : "Clear everything"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant="outline" className="font-mono tabular-nums">
        {value}
      </Badge>
    </div>
  );
}
