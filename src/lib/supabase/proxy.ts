import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getClaims — any
  // logic here will see a stale session and is liable to cause silent
  // sign-outs. See https://supabase.com/docs/guides/auth/server-side/nextjs.
  // Refresh and verify the token here. With asymmetric signing keys this
  // uses cached public keys instead of an Auth-server round trip on every
  // navigation. getAuthUser still calls getUser in the server data layer to
  // check the current account before any protected data is returned.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
