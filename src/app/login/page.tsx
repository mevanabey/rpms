"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { motion } from "framer-motion";
import { Building2, ChevronRight, LogIn, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LiveDot } from "@/components/ui/live-dot";
import { useDemoStore } from "@/lib/demo/store";
import { PRESET_USERS, type AppUser } from "@/lib/demo/identity";
import { useCurrentUser, useDemoHydrated, useRoleDef } from "@/lib/demo/use-store";
import { getInitials } from "@/lib/utils";

import { RolePill } from "@/components/app/role-pill";

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useDemoHydrated();
  const currentUser = useCurrentUser();
  const loginAs = useDemoStore((s) => s.loginAs);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // If already logged in, bounce home.
  useEffect(() => {
    if (hydrated && currentUser) router.replace("/");
  }, [hydrated, currentUser, router]);

  const handleLogin = async (user: AppUser) => {
    setPendingId(user.id);
    // Tiny simulated delay so it feels real.
    await new Promise((r) => setTimeout(r, 350));
    const label =
      useDemoStore.getState().roleDefs.find((r) => r.id === user.role)?.label ?? user.role;
    loginAs(user.id);
    // Activity log disabled — app simplified.
    // pushActivity({
    //   workflow: "human",
    //   severity: "info",
    //   title: `${user.name} signed in`,
    //   body: `Role · ${label}. Entities · ${user.entities.join(", ")}.`,
    // });
    toast.success(`Welcome, ${user.name}`, {
      description: `Signed in as ${label}.`,
    });
    router.replace("/");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/40">
      {/* Decorative orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="-translate-x-1/2 absolute top-[-20%] left-1/2 size-[60vmax] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="-translate-x-1/2 absolute bottom-[-30%] left-[20%] size-[50vmax] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10 sm:py-16">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-4" />
            </div>
            <div>
              <div className="font-semibold text-sm">RPMS</div>
              <div className="text-muted-foreground text-xs">
                Capital Trust · Rental Management
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <LiveDot tone="live" /> Demo environment
          </div>
        </header>

        <div className="mb-6">
          <h1 className="font-bold text-3xl tracking-tight">
            Sign in to continue
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground text-sm">
            Pick any user below to simulate signing in as that role. The
            sidebar, action buttons, and admin pages all adapt to the
            permissions of whoever's logged in.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRESET_USERS.map((user, i) => {
            const pending = pendingId === user.id;
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
              >
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => !pending && handleLogin(user)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!pending) handleLogin(user);
                    }
                  }}
                  className="group h-full cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-busy={pending}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {user.initials ?? getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">{user.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {user.email}
                          </CardDescription>
                        </div>
                      </div>
                      {pending && <LiveDot tone="live" />}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-sm">
                    <RolePill role={user.role} className="w-fit" />
                    <UserCardDescription role={user.role} />
                    <div className="flex flex-wrap gap-1">
                      {user.entities.map((e) => (
                        <span
                          key={e}
                          className="rounded-md border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1 self-end"
                      disabled={pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLogin(user);
                      }}
                    >
                      {pending ? (
                        <>Signing in…</>
                      ) : (
                        <>
                          <LogIn className="size-3.5" /> Sign in
                          <ChevronRight className="size-3.5" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-xs">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3" />
            Click any card · the sidebar redraws based on the role's permissions.
          </div>
          <div>
            Phase 01 simulation · Phase 02 wires Clerk + per-entity RLS.
          </div>
        </footer>
      </div>
    </div>
  );
}

function UserCardDescription({ role }: { role: string }) {
  const def = useRoleDef(role);
  return (
    <p className="text-muted-foreground text-xs">
      {def?.description ?? "Custom role."}
    </p>
  );
}
