"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Users } from "lucide-react";

import { LiveDot } from "@/components/ui/live-dot";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDraftParties } from "@/lib/demo/use-store";

export function DraftPartiesCard() {
  const drafts = useDraftParties();
  if (drafts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" />
          Newly added parties <LiveDot tone="live" size="xs" />
        </CardTitle>
        <CardDescription>
          Added during this session. Live in the demo store.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y">
          <AnimatePresence initial={false}>
            {drafts.map((p) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between gap-3 px-6 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{p.displayName}</span>
                    <StatusPill tone="info" label={p.kind} iconless />
                  </div>
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    {p.legalName && p.legalName !== p.displayName
                      ? `${p.legalName} · `
                      : ""}
                    {p.nicOrPassport ?? p.companyRegNo ?? ""}
                    {p.emails.length ? ` · ${p.emails[0]}` : ""}
                    {p.phones.length ? ` · ${p.phones[0]}` : ""}
                  </p>
                </div>
                <StatusPill tone="draft" label="draft" />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </CardContent>
    </Card>
  );
}
