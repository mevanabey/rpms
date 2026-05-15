"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LiveDot } from "@/components/ui/live-dot";
import { useDemoStore } from "@/lib/demo/store";
import { useDemoHydrated, useCurrentUser } from "@/lib/demo/use-store";

/**
 * Client-side auth gate. Until the demo store has rehydrated, we show a
 * lightweight splash. After hydration:
 *  - Logged in  → render children (the dashboard)
 *  - Logged out → redirect to /login
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useDemoHydrated();
  const currentUser = useCurrentUser();
  const currentUserId = useDemoStore((s) => s.currentUserId);

  useEffect(() => {
    if (!hydrated) return;
    if (!currentUserId) router.replace("/login");
  }, [hydrated, currentUserId, router]);

  if (!hydrated || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <LiveDot tone="live" /> Resuming session…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
