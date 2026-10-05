import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const otpType = z.enum(["invite", "recovery", "email", "signup", "magiclink", "email_change"]);

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = otpType.safeParse(request.nextUrl.searchParams.get("type"));
  if (!tokenHash || !type.success) {
    return NextResponse.redirect(new URL("/login?error=Invalid%20password%20link.%20Request%20a%20new%20one.", request.url));
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type.data });
  if (error) {
    return NextResponse.redirect(new URL("/login?error=This%20link%20has%20expired%20or%20was%20already%20used.%20Request%20a%20new%20password%20link.", request.url));
  }
  const destination = type.data === "invite" || type.data === "recovery"
    ? "/auth/update-password" : "/";
  return NextResponse.redirect(new URL(destination, request.url));
}
