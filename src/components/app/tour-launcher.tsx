"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import { FlowPickerDialog } from "./flow-picker-dialog";

/**
 * Header sparkle. Opens the demo-flow picker so the user can choose which
 * scripted walkthrough to run.
 */
export function TourLauncher() {
  return (
    <FlowPickerDialog
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Open demo flows"
          data-onborda="tour-launcher"
        >
          <Sparkles className="size-4" />
        </Button>
      }
    />
  );
}
