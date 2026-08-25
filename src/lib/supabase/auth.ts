import "server-only";
import { cache } from "react";
import { createClient } from "./server";

/** Supabase tags transient network failures with this name. They're the
 *  kind of failure that's expected to succeed on retry — a dropped TCP
 *  connection, an HMR-interrupted fetch, a DNS blip — and aren't an auth
 *  problem. */
function isRetryableFetchError(e: unknown): boolean {
  return (
    !!e &&
    typeof e === "object" &&
    "name" in e &&
    (e as { name?: string }).name === "AuthRetryableFetchError"
  );
}

/**
 * Returns the authenticated Supabase user, or `null` if no session is present.
 *
 * Always calls `supabase.auth.getUser()` (which re-verifies the JWT with the
 * Supabase Auth server) rather than `getSession()` — the latter reads from
 * cookies and is spoofable on the server. See
 * https://supabase.com/docs/guides/auth/server-side/nextjs.
 *
 * One transparent retry on `AuthRetryableFetchError` so a single dropped
 * socket doesn't blow up the AppLayout server render. Real auth failures
 * (401, expired token, etc.) come back as `{ user: null }`, not exceptions,
 * so they propagate normally without the retry firing.
 *
 * Wrapped in `React.cache` so multiple server components in the same request
 * share one fetch.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    } catch (e) {
      if (attempt === 0 && isRetryableFetchError(e)) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      throw e;
    }
  }
  return null;
});
