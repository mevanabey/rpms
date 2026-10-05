"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useSubmission } from "@/hooks/use-submission";
import { PasswordForm } from "@/app/auth/update-password/password-form";
import { beginSignInAction, requestPasswordCodeAction } from "../actions";

type Step = "email" | "password" | "code" | "new-password";

export function AuthCard({ initialEmail = "", initialStep = "email" }: {
  initialEmail?: string; initialStep?: "email" | "new-password";
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const { pending, run, retain } = useSubmission();

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const requestCode = () => run(async () => {
    setSendingCode(true);
    setError("");
    const result = await requestPasswordCodeAction(email);
    setSendingCode(false);
    if (!result.ok) { setError(result.error); return; }
    if (step === "password") setResetting(true);
    setCode("");
    setResendSeconds(60);
    setStep("code");
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      setSendingCode(false);
      setError("");
      if (step === "email") {
        const result = await beginSignInAction(email.trim().toLowerCase());
        if (!result.ok) { setError(result.error); return; }
        setEmail(result.email);
        setStep(result.step);
        if (result.step === "code") setResendSeconds(60);
      } else if (step === "password") {
        const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
        if (signInError) { setError("Email or password is incorrect. Try again or reset your password."); return; }
        retain();
        window.location.assign("/");
      } else if (step === "code") {
        const { error: codeError } = await createClient().auth.verifyOtp({ email, token: code.trim(), type: "recovery" });
        if (codeError) { setError("That code is invalid or expired. Use the newest email, or request another code."); return; }
        setCode("");
        setStep("new-password");
      }
    });
  };

  const changeEmail = () => run(async () => {
    if (step === "new-password") await createClient().auth.signOut({ scope: "local" });
    setStep("email"); setPassword(""); setCode(""); setError(""); setResetting(false); setResendSeconds(0);
  });

  const busyLabel = sendingCode ? "Sending code…" : step === "email" ? "Continuing…" : step === "password" ? "Logging in…" : "Verifying code…";
  return <div className="space-y-4">
    {step !== "email" && <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
      <span className="truncate text-sm">{email}</span>
      {step !== "new-password" && <Button type="button" variant="link" size="sm" disabled={pending} onClick={() => void changeEmail()}>Change email</Button>}
    </div>}
    {step === "new-password" ? <>
      <p className="text-sm font-medium">{resetting ? "Choose your new password" : "Set your first password"}</p>
      <PasswordForm />
    </> : <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-4">
        {step === "email" && <div className="space-y-2">
          <Label htmlFor="auth-email">Email</Label>
          <Input id="auth-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </div>}
        {step === "password" && <div className="space-y-2">
          <Label htmlFor="auth-password">Password</Label>
          <Input id="auth-password" type="password" required autoFocus autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>}
        {step === "code" && <>
          <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to your email. It is valid for one hour. Delivery can take a few minutes; check your spam folder too.</p>
          <div className="space-y-2">
            <Label htmlFor="auth-code">Email code</Label>
            <Input id="auth-code" type="text" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="6-digit code" className="font-mono tracking-widest" />
          </div>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {pending ? busyLabel : step === "email" ? "Continue" : step === "password" ? "Sign in" : "Verify code"}
        </Button>
      </fieldset>
      {step === "password" && <Button type="button" variant="link" size="sm" disabled={pending} onClick={() => void requestCode()}>Forgot password?</Button>}
      {step === "code" && <div className="space-y-1">
        <Button type="button" variant="link" size="sm" disabled={pending || resendSeconds > 0} onClick={() => void requestCode()}>{resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}</Button>
        <p className="text-xs text-muted-foreground">Requesting another code replaces the previous one. Use the most recent email.</p>
      </div>}
    </form>}
  </div>;
}
