# Supabase setup

The backend uses **Supabase** (Postgres + Auth + Storage). This doc covers everything you need to configure in the Supabase dashboard so the app can talk to it.

## 1. Environment variables

Copy `.env.example` → `.env.local` (already done if you cloned with a populated `.env.local`) and fill in:

| Var | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Project Settings → API → "Project URL" | Safe in browser. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Dashboard → Project Settings → API → "Publishable" key (`sb_publishable_...`) | Replaces the legacy `anon` key. Safe in browser. |
| `SUPABASE_SECRET_KEY` | Dashboard → Project Settings → API → "Secret" key (`sb_secret_...`) | **Server-only.** Replaces the legacy `service_role` key. Never expose to the browser. |
| `DATABASE_URL` | Dashboard → Project Settings → Database → Connection string → **Transaction** (pooled, port 6543) | Runtime queries. Serverless-friendly. |
| `DIRECT_URL` | Dashboard → Project Settings → Database → Connection string → **Session** (direct, port 5432) | Drizzle migrations only. |
| `BACKEND` | local choice | `mock` (default, in-memory) or `supabase` once the adapter is wired. |

## 2. Auth providers

Capital Trust users predominantly authenticate via Sri Lanka phone OTP. Configure in Dashboard → Authentication → Providers:

- **Phone** — enable. Supabase routes phone OTP through a Twilio account you supply:
  - Twilio Account SID
  - Twilio Auth Token
  - Twilio Messaging Service SID (or sender phone number)
- **Email** — enable as a fallback for staff who don't have a Sri Lanka mobile (handlers, accountants who use group email).
- Optionally enable **Google** for the Capital Trust group workspaces.

In Dashboard → Authentication → URL Configuration:
- **Site URL**: `http://localhost:3000` for dev (and the deployed URL for prod).
- **Redirect URLs**: add `http://localhost:3000/**` plus the deployed origins.

## 3. Session handling

Session refresh runs in `proxy.ts` at the project root (Next.js 16 renamed `middleware.ts` → `proxy.ts`). It refreshes the Supabase auth cookies on every non-static request via `src/lib/supabase/proxy.ts`.

**Important** (per Next.js 16 docs): proxy is *not* a substitute for per-route authz. Server components and server actions must call `getAuthUser()` from `@/lib/supabase/auth` themselves and gate on the result.

## 4. Database — next slice

The Drizzle schema (`src/server/db/schema.ts`) and the `supabase` backend adapter (`src/server/adapters/supabase/`) are not yet implemented. Once they land:

1. `pnpm db:generate` — emit SQL from the schema.
2. `pnpm db:migrate` — apply migrations via `DIRECT_URL`.
3. Flip `BACKEND=supabase` in `.env.local` to route `getBackend()` to the real adapter.

## 5. RLS

Row-level security is intentionally deferred until the schema stabilizes. App-layer enforcement (Drizzle `where` + `<RoleGate>` + `<LeaseScopeGate>`) is the first line for now; RLS will land as a follow-up, layered on top.
