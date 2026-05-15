"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useOnborda, type CardComponentProps } from "onborda";

import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/lib/demo/store";

/**
 * Branded popover used by the Onborda tour. Replaces the default card so the
 * walkthrough feels like a native part of the product.
 */
export function TourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const { closeOnborda } = useOnborda();
  const setSimEnabled = useDemoStore((s) => s.setSimEnabled);
  const markTourCompleted = useDemoStore((s) => s.markTourCompleted);

  const onClose = () => {
    closeOnborda();
    setSimEnabled(true);
    markTourCompleted();
  };

  const onFinish = () => {
    closeOnborda();
    setSimEnabled(true);
    markTourCompleted();
  };

  const isLast = currentStep === totalSteps - 1;
  const progressPct = ((currentStep + 1) / totalSteps) * 100;

  // Onborda can briefly call us with `step` undefined while transitioning
  // between routes / steps. Render nothing in that gap.
  if (!step) return null;

  return (
    <div className="w-[400px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl">
      <div className="flex items-start gap-3 border-b px-5 pt-4 pb-3">
        {step.icon && <div className="mt-0.5 text-2xl">{step.icon as React.ReactNode}</div>}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{step.title}</h3>
          <div className="mt-0.5 text-muted-foreground text-xs">
            Step {currentStep + 1} of {totalSteps}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close tour"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-2 px-5 py-4 text-sm">
        {typeof step.content === "string" ? <p>{step.content}</p> : step.content}
      </div>

      <div className="border-t">
        <div className="h-1 w-full overflow-hidden bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="size-3.5" /> Back
          </Button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: dot list
                key={i}
                className={`block size-1.5 rounded-full ${
                  i === currentStep ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          {isLast ? (
            <Button size="sm" onClick={onFinish}>
              Finish
            </Button>
          ) : (
            <Button size="sm" onClick={nextStep}>
              Next <ChevronRight className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {arrow}
    </div>
  );
}
