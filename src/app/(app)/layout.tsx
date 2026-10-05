import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/app/dashboard-shell";
import { getAccountAccess, getCurrentAppUser } from "@/lib/auth/identity";
import { AuthIdentityProvider } from "@/lib/auth/identity-context";

/**
 * Authenticated routes depend on the Supabase session cookie, which doesn't
 * exist at build time. Mark the whole route group dynamic so Next.js doesn't
 * try to statically prerender (and fail by hitting Supabase without a
 * session).
 */
export const dynamic = "force-dynamic";

/**
 * Authenticated app layout. Runs server-side:
 *  - No Supabase session → redirect to /login
 *  - Session present but disabled `user_role` row → redirect to /login
 *  - Pending password setup → redirect to the password form
 *  - Otherwise resolve the explicitly provisioned AppUser and inject it
 *    into the client tree so `useCurrentUser()` reads
 *    a real identity instead of the demo Zustand flag.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const access = await getAccountAccess();
  if (access?.row.isActive && access.row.passwordSetupRequired) redirect("/auth/update-password");
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <AuthIdentityProvider user={user}>
      <DashboardShell>{children}</DashboardShell>
    </AuthIdentityProvider>
  );
}
