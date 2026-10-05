"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function AuthCard() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "setup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    const supabase = createClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
        router.replace("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/auth/update-password`,
        });
        if (error) throw error;
        setMessage("If this email belongs to an RPMS account, a password link is on its way. Check your inbox and spam folder.");
      }
    } catch (error) {
      toast.error(mode === "signin" ? "Sign in failed" : "Could not request password link", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally { setPending(false); }
  };
  const changeMode = (next: typeof mode) => { setMode(next); setMessage(""); };
  return <div className="space-y-4">
    {mode !== "signin" && <p className="text-sm text-muted-foreground">
      {mode === "setup" ? "Set your first password using a secure link sent to your email." : "We’ll email you a secure link to reset your password."}
    </p>}
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="auth-email">Email</Label>
        <Input id="auth-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@capitaltrust.lk" />
      </div>
      {mode === "signin" && <div className="space-y-2">
        <Label htmlFor="auth-password">Password</Label>
        <Input id="auth-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Email password link"}
      </Button>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </form>
    <div className="flex flex-wrap gap-2">
      {mode === "signin" ? <>
        <Button variant="link" size="sm" onClick={() => changeMode("setup")}>Set your password</Button>
        <Button variant="link" size="sm" onClick={() => changeMode("reset")}>Forgot password?</Button>
      </> : <Button variant="link" size="sm" onClick={() => changeMode("signin")}>Back to sign in</Button>}
    </div>
  </div>;
}
