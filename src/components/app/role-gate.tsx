"use client";

import Link from "next/link";

import { ArrowLeft, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type Resource } from "@/lib/demo/identity";
import { useCanAnyCheck, useCurrentUser, useRoleDef } from "@/lib/demo/use-store";

/**
 * Page-level guard. Wrap the body of a sensitive route. If the current
 * user's role doesn't grant any of the required resources, render an
 * "Access denied" view instead.
 */
export function RoleGate({
  required,
  children,
}: {
  required: Resource[];
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  const canAny = useCanAnyCheck();
  const roleDef = useRoleDef(user?.role);

  if (!user) return null; // AuthGate will redirect; nothing to render here.
  if (canAny(required)) return <>{children}</>;

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/">
          <ArrowLeft className="size-3.5" /> Dashboard
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
              <ShieldOff className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Access denied</CardTitle>
              <CardDescription className="mt-0.5 text-sm">
                Your role —{" "}
                <span className="font-medium text-foreground">
                  {roleDef?.label ?? user.role}
                </span>{" "}
                — doesn’t grant access to this page.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Required permissions:{" "}
            <code className="font-mono text-xs">{required.join(", ")}</code>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/">Go to dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Switch user</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
