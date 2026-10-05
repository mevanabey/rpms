import { redirect } from "next/navigation";

import { Building2 } from "lucide-react";

import { getAccountAccess } from "@/lib/auth/identity";

import { AuthCard } from "./_components/auth-card";

/**
 * Staff-only sign-in, first-password setup, and password recovery.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await getAccountAccess();
  if (access?.row.isActive && !access.row.passwordSetupRequired) {
    redirect("/");
  }
  const { error } = await searchParams;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Soft background wash — anchors the page without competing with the form */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="-translate-x-1/2 absolute top-[-30%] left-1/3 size-[55vmax] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute right-[-10%] bottom-[-20%] size-[40vmax] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* ─────────────────────── Brand panel (desktop only) */}
        <aside className="hidden flex-col justify-between border-r bg-muted/30 p-12 lg:flex">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Building2 className="size-4.5" />
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight">CT RPMS</div>
              {/* <div className="text-muted-foreground text-xs">
                Capital Trust · Rental Management
              </div> */}
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="font-bold text-3xl tracking-tight">
                Rental Management System
                <br />
              </h2>
              <p className="mt-4 max-w-md text-muted-foreground text-sm leading-relaxed">
                Log in to your Capital Trust Rental Management System workspace.
              </p>
            </div>
          </div>

          <div className="text-muted-foreground text-xs">
            © {new Date().getFullYear()} Capital Trust Holdings
          </div>
        </aside>

        {/* ─────────────────────── Form panel */}
        <main className="flex items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-sm">
            {/* Mobile-only brand mark */}
            <div className="mb-10 flex items-center gap-2.5 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Building2 className="size-4.5" />
              </div>
              <div>
                <div className="font-semibold text-sm tracking-tight">RPMS</div>
                <div className="text-muted-foreground text-xs">
                  Capital Trust · Rental Management
                </div>
              </div>
            </div>

            <div className="mb-7">
              <h1 className="font-bold text-2xl tracking-tight">
                Sign in to your workspace
              </h1>
              <p className="mt-2 text-muted-foreground text-sm">
                Access is limited to accounts created by your administrator.
                Enter your email to sign in or set your first password.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                {error}
              </div>
            )}

            <AuthCard initialEmail={access?.row.isActive ? access.authUser.email : undefined}
              initialStep={access?.row.isActive ? "new-password" : "email"} />

            <p className="mt-6 text-muted-foreground text-xs">
              Trouble signing in? Ask your administrator to confirm your role
              in <span className="font-mono">/admin/users</span>.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
