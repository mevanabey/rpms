"use client";

import { useState } from "react";

import { motion } from "framer-motion";
import { Clock, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FLOWS } from "@/lib/flows/defs";
import { useFlowRunner } from "@/lib/flows/runner";

interface Props {
  trigger: React.ReactNode;
}

/**
 * Renders the gallery of demo flows. Picking one starts the runner.
 */
export function FlowPickerDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const { start, status } = useFlowRunner();
  const isBusy = status === "running" || status === "paused";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> Pick a flow
          </DialogTitle>
          <DialogDescription>
            Each flow drives the demo automatically — opening pages, filling
            forms, narrating along the way. Pick what you want to show.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FLOWS.map((f, i) => (
            <motion.button
              key={f.id}
              type="button"
              onClick={() => {
                setOpen(false);
                start(f);
              }}
              disabled={isBusy}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: i * 0.04 }}
              className="group flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-2xl">{f.emoji}</div>
                <Badge
                  variant="outline"
                  className="inline-flex items-center gap-1 font-mono text-[10px]"
                >
                  <Clock className="size-3" />
                  ~{Math.ceil(f.estimatedSeconds / 5) * 5}s
                </Badge>
              </div>
              <div className="font-semibold text-sm">{f.title}</div>
              <p className="text-muted-foreground text-xs">{f.description}</p>
              {f.tags && f.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {f.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-muted-foreground text-[11px]">
                <span>{f.steps.length} steps</span>
                <span className="text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  Run flow →
                </span>
              </div>
            </motion.button>
          ))}
        </div>

        <p className="mt-3 text-muted-foreground text-xs">
          Flows manipulate the demo state. Reset everything from{" "}
          <span className="font-mono">/admin/workflows</span> at any time.
        </p>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
