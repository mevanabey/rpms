"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getAccountAccess } from "@/lib/auth/identity";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { userRole } from "@/server/db/schema";

export async function setPasswordAction(password: string, confirmation: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = z.string().min(8, "Use at least 8 characters.").max(128)
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number.")
    .regex(/[^A-Za-z0-9]/, "Include a symbol.").safeParse(password);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (password !== confirmation) return { ok: false, error: "The passwords don’t match." };
  const access = await getAccountAccess();
  if (!access?.row.isActive) return { ok: false, error: "Your session expired or your account is inactive. Return to sign in and request a new email code." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, error: error.message };
  await db.update(userRole).set({ passwordSetupRequired: false, updatedAt: new Date() })
    .where(eq(userRole.userId, access.authUser.id));
  return { ok: true };
}
