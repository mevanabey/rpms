"use server";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

async function approvedAccount(email: string) {
  const [account] = await db.execute<{ password_setup_required: boolean; recent_code: boolean }>(sql`
    select r.password_setup_required,
      (coalesce(u.recovery_sent_at > now() - interval '60 seconds', false)
        and coalesce(u.recovery_token, '') <> '') as recent_code
    from public.user_role r
    join auth.users u on u.id = r.user_id
    where lower(u.email) = ${email} and r.is_active = true
    limit 1
  `);
  return account;
}

async function sendCode(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  // Recovery works with public signup disabled. The email contains .Token;
  // verifyOtp exchanges it using type "recovery".
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (!error) return { ok: true };
  if (error.status === 429) return { ok: false, error: "A code was requested recently. Wait a minute before requesting another." };
  return { ok: false, error: "Could not send the code. Please try again." };
}

export async function beginSignInAction(input: string): Promise<
  { ok: true; email: string; step: "password" | "code" } | { ok: false; error: string }
> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const account = await approvedAccount(parsed.data);
  if (!account) return { ok: false, error: "This email does not have active RPMS access. Contact your administrator." };
  if (!account.password_setup_required) return { ok: true, email: parsed.data, step: "password" };
  if (account.recent_code) return { ok: true, email: parsed.data, step: "code" };
  const sent = await sendCode(parsed.data);
  return sent.ok ? { ok: true, email: parsed.data, step: "code" } : sent;
}

export async function requestPasswordCodeAction(input: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const account = await approvedAccount(parsed.data);
  if (!account) return { ok: false, error: "This email does not have active RPMS access. Contact your administrator." };
  if (account.recent_code) return { ok: true };
  return sendCode(parsed.data);
}
