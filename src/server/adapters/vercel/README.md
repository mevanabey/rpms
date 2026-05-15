# Vercel Workflows adapter (Phase 02)

Implements `Backend` from `@/core/services` by:

- Reading from Drizzle/Neon for `list*` / `get*` calls.
- Triggering Vercel Workflows for orchestration calls (onboarding, reminders, bank-reconcile, …).
- Writing back through Drizzle on workflow step completion.

Selected when `BACKEND=vercel` (see `src/server/container.ts`).

The handlers under `src/workflows/<kind>/` are pure typed functions. This
adapter is the *transport* — it does not own business logic. AgentFabriq
(Phase 03) implements the same `Backend` interface with a different
transport, and the workflows underneath stay unchanged.
