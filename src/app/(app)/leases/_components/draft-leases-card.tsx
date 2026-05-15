"use client";

import { useEffect, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, FileSignature } from "lucide-react";

import { LiveDot } from "@/components/ui/live-dot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDraftLeases } from "@/lib/demo/use-store";

function ago(ts: number, now: number): string {
  if (now === 0) return "";
  const sec = Math.floor((now - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export function DraftLeasesCard() {
  const drafts = useDraftLeases();
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (drafts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="size-4" />
          Draft leases <LiveDot tone="live" size="xs" />
        </CardTitle>
        <CardDescription>
          Submitted from the wizard · awaiting onboarding workflow steps.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y">
          <AnimatePresence initial={false}>
            {drafts.slice(0, 8).map((d) => {
              const intent = d.intent as Record<string, unknown> & {
                propertyId?: string;
                lesseePartyId?: string;
              };
              return (
                <motion.li
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-between gap-3 px-6 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm">
                      Draft <span className="font-mono text-xs">{d.id.slice(-6)}</span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      Property: {intent.propertyId ?? "—"} · Lessee:{" "}
                      {intent.lesseePartyId ?? "—"} · {ago(d.ts, now)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 text-xs dark:bg-amber-950/60 dark:text-amber-200">
                    <ArrowUpRight className="size-3" />
                    {d.status}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </CardContent>
    </Card>
  );
}
