"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

/** Lock before React renders; keep navigation locked until the page changes. */
export function useSubmission() {
  const locked = useRef(false);
  const retained = useRef(false);
  const [pending, setPending] = useState(false);
  const retain = useCallback(() => { retained.current = true; }, []);
  const run = useCallback(async (operation: () => void | Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    retained.current = false;
    setPending(true);
    try {
      await operation();
    } catch (error) {
      retained.current = false;
      toast.error("Could not complete the request", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      if (!retained.current) {
        locked.current = false;
        setPending(false);
      }
    }
  }, []);
  return { pending, run, retain };
}
