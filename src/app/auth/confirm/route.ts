import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Handles email confirmation / magic-link redirects.
 *
 * Supabase sends users to `/auth/confirm?token_hash=...&type=...&next=/`.
 * We verify the OTP token, then redirect to `next` on success or `/login?error=...`
 * on failure.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL("/login?error=missing-confirmation-params", request.url),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        request.url,
      ),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
