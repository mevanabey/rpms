import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client backed by the server-only **secret** key. Bypasses
 * RLS — only used for trusted server actions (bucket setup, file uploads,
 * signed URL generation). Never expose to the browser.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment.",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const LEASE_DOCUMENTS_BUCKET = "lease-documents";
