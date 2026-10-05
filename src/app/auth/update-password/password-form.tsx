"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useSubmission } from "@/hooks/use-submission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPasswordAction } from "./actions";

export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const { pending, run, retain } = useSubmission();
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      setError("");
      const result = await setPasswordAction(password, confirmation);
      if (!result.ok) { setError(result.error ?? "Could not update your password."); return; }
      retain();
      window.location.assign("/");
    });
  }
  return <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
    <fieldset disabled={pending} className="space-y-4">
    <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} /><p className="text-xs text-muted-foreground">Use at least 8 characters, including an uppercase letter, a lowercase letter, a number, and a symbol.</p></div>
    <div className="space-y-2"><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button className="w-full" disabled={pending} type="submit">{pending && <Loader2 className="size-4 animate-spin" aria-hidden />}{pending ? "Saving password…" : "Save password and continue"}</Button>
    </fieldset>
  </form>;
}
