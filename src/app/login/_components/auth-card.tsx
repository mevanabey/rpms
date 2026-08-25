"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export function AuthCard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);

    const supabase = createClient();

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Signed in", { description: email });
        router.replace("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
          },
        });
        if (error) throw error;
        toast.success("Check your inbox", {
          description: `We sent a confirmation link to ${email}.`,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed.";
      toast.error(mode === "signin" ? "Sign in failed" : "Sign up failed", {
        description: message,
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Mode toggle — segmented control instead of full Tabs chrome */}
      <div className="inline-flex w-full rounded-md border bg-muted/40 p-0.5 text-sm">
        <ModeTab active={mode === "signin"} onClick={() => setMode("signin")}>
          Sign in
        </ModeTab>
        <ModeTab active={mode === "signup"} onClick={() => setMode("signup")}>
          Create account
        </ModeTab>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="auth-email" className="text-xs font-medium">
            Email
          </Label>
          <Input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@capitaltrust.lk"
            className="h-10"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="auth-password" className="text-xs font-medium">
            Password
          </Label>
          <Input
            id="auth-password"
            type="password"
            required
            minLength={8}
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
            className="h-10"
          />
          {mode === "signup" && (
            <p className="text-muted-foreground text-[11px]">
              At least 8 characters. We&apos;ll email you a confirmation link.
            </p>
          )}
        </div>

        <Button type="submit" disabled={pending} className="mt-1 h-10">
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              {mode === "signin" ? "Signing in…" : "Sending email…"}
            </>
          ) : (
            <>{mode === "signin" ? "Sign in" : "Create account"}</>
          )}
        </Button>
      </form>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-[5px] px-3 py-1.5 font-medium text-sm transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
