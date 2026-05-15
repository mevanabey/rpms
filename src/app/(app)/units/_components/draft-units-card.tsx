"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Gauge } from "lucide-react";

import { LiveDot } from "@/components/ui/live-dot";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Property } from "@/core/types";
import type { DraftUnitStatus } from "@/lib/demo/types";
import { useDraftProperties, useDraftUnits } from "@/lib/demo/use-store";

const STATUS_TONE: Record<DraftUnitStatus, StatusTone> = {
  occupied: "active",
  vacant: "muted",
  reserved: "warning",
};

export function DraftUnitsCard({ properties }: { properties: Property[] }) {
  const drafts = useDraftUnits();
  const draftProperties = useDraftProperties();
  if (drafts.length === 0) return null;

  const propertyName = (id: string) =>
    properties.find((p) => p.id === id)?.name ??
    draftProperties.find((p) => p.id === id)?.name ??
    id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4" />
          Newly added units <LiveDot tone="live" size="xs" />
        </CardTitle>
        <CardDescription>
          Added during this session. Live in the demo store.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y">
          <AnimatePresence initial={false}>
            {drafts.map((u) => (
              <motion.li
                key={u.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between gap-3 px-6 py-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm">{u.label}</div>
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    {propertyName(u.propertyId)} · {u.type}
                    {u.areaSqft ? ` · ${u.areaSqft} sqft` : ""}
                    {u.bedrooms ? ` · ${u.bedrooms} bed` : ""}
                  </p>
                </div>
                <StatusPill tone={STATUS_TONE[u.status]} label={u.status} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </CardContent>
    </Card>
  );
}
