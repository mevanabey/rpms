import type { ReactNode } from "react";

import { AuthGate } from "@/components/app/auth-gate";
import { DashboardShell } from "@/components/app/dashboard-shell";

/**
 * Authenticated app layout. Everything routed under `(app)/` runs through
 * the DashboardShell + AuthGate (redirects unauthed users to /login).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <DashboardShell>{children}</DashboardShell>
    </AuthGate>
  );
}
