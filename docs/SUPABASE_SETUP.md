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

Use email/password authentication for the provisioned staff accounts. Keep **Allow new users to sign up** disabled. Creating an Auth account alone does not grant RPMS access: it also needs an active `public.user_role` row. The app does not auto-provision unknown accounts.

For a new staff account, create it through the Auth Admin API without a password (`email_confirm: true`), then insert an active `user_role` with `password_setup_required=true`, a primary `role`, and its full `roles` array. `/login` starts with email only. The server checks the provisioned account: existing password users enter their password; first-time users automatically receive a six-digit email OTP. After verification, they choose their password on the same screen. **Forgot password?** uses the same OTP and password steps. Unknown and inactive accounts receive no app access or OTP. Do not distribute shared or temporary passwords.

Configure custom SMTP and the recovery email template to include:

```html
<p>Your RPMS verification code: <strong>{{ .Token }}</strong></p>
<p>Enter this code on the RPMS login screen. It is valid for one hour.</p>
```

Use `resetPasswordForEmail` to request the code, and `verifyOtp({email, token, type: "recovery"})` to verify it. Recovery works while public signup remains disabled. Keep `mailer_otp_exp=3600` (one hour), `mailer_otp_length=6`, and the resend interval at 60 seconds. The email rate limit currently allows 60/hour. Delivery may take a few minutes; users stay on the code screen and use the most recent email. Previously issued `/auth/confirm` links remain supported, and `/auth/update-password` remains available for those callbacks. Passwords require at least 8 characters including uppercase, lowercase, number, and symbol.

Forms use `useSubmission` to lock before React renders, await the full mutation, unlock on failure, and retain the pending state through authentication navigation. React Hook Form submissions also remain disabled during validation. Payment dialogs close only after confirmed success; rent tables await bulk writes and keep controls disabled through their refresh.

In Dashboard → Authentication → URL Configuration:
- **Site URL**: `http://localhost:3000` for dev (and the deployed URL for prod).
- **Redirect URLs**: add `http://localhost:3000/**` plus the deployed origins.

## 3. Session handling

Session refresh runs in `proxy.ts` at the project root (Next.js 16 renamed `middleware.ts` → `proxy.ts`). It refreshes the Supabase auth cookies on every non-static request via `src/lib/supabase/proxy.ts`.

**Important** (per Next.js 16 docs): proxy is *not* a substitute for per-route authz. Server components and server actions must call `getAuthUser()` from `@/lib/supabase/auth` themselves and gate on the result.

## 4. Database

The Drizzle schema and Supabase backend adapter are implemented. Set `DIRECT_URL`, then run `pnpm db:migrate` to apply the checked-in migrations. Set `BACKEND=supabase` for the real adapter.

## 5. RLS

Migration `0001` enables RLS on application tables without browser-facing policies; `0002` adds the same protection to the audit log. All business data uses server-only Drizzle. Only admins see all leases. Other staff see leases explicitly assigned to their account via `lease_party_role.user_id`, plus leases where `lease.created_by` matches their account. Role assignment alone grants no portfolio access. Advisors and accountants can create leases, including new contact/property/unit records needed for intake, and manage their visible leases. Lawyers are read-only unless they hold another role.

Staff accounts may have multiple roles. Store all roles in `user_role.roles` and the primary role in `user_role.role`; when changing roles, update both. The permission union never grants portfolio access unless it includes `admin`. Assign active staff from **Team & contacts**. A contact without a system-user link grants no login or lease access.

## 6. Manual email progression and audit history

The lease progress panel supports both SMTP sends and **email sent manually** confirmations. A manual confirmation requires recipient addresses and a note. Lawyer/advisor confirmations advance to Advisor Approval only after both are recorded. The accounts confirmation also records advisor approval and advances to Accounts. Invalid stage skips are rejected; concurrent confirmations are serialised.

`lease_audit` records the actor ID, name/email snapshot, timestamp, action, record type, before/after values, and event details. Database triggers cover leases, staff assignments, units, rent terms, ledger payments/reversals, obligations, documents, and edits to related contacts/properties. Server mutations run in one transaction with a verified actor via `withAudit`; actor context is transaction-local and isolated with AsyncLocalStorage. Direct database changes are recorded as `System/database`. Auth/dashboard operations outside RPMS cannot attribute their external operator to an app session.

The audit log rejects UPDATE, DELETE, and TRUNCATE, and survives lease/account deletion. It appears on each lease, the dashboard, header activity menu, and `/activity`, with server-side lease scoping and pagination. New server mutations must use the secured backend or `withAudit`; never take an actor ID from client input.

## 7. Verification

Build the app, run it against a development Supabase project, then run:

```sh
node scripts/verify-staff-workflow.mjs http://localhost:3000
```

The checks create temporary Auth accounts and leases, exercise real server actions, and remove their business records afterward. They never send emails. Their audit history remains permanently, as required by the append-only policy. Use a development instance for these checks.
