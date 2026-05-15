"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/lib/demo/store";

export function ResetDemoButton() {
  const reset = useDemoStore((s) => s.resetDemo);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        reset();
        toast.success("Demo state reset", {
          description:
            "Activity feed, approvals, and autonomy progress are back to factory.",
        });
      }}
    >
      <RotateCcw className="size-3.5" />
      Reset demo state
    </Button>
  );
}
