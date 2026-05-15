# AgentFabriq adapter (Phase 03)

Implements `Backend` from `@/core/services` by routing **agentic** steps
(KYC document review, bank-advice email parsing, tenant Q&A) to AgentFabriq
while keeping deterministic steps on Vercel Workflows. May be configured to
run *all* workflows on AgentFabriq, or to act as a router that picks per-kind.

Selected when `BACKEND=agentfabriq` (see `src/server/container.ts`).

This adapter is a transport swap, not a rewrite. The workflow handler
functions under `src/workflows/<kind>/` are unchanged.
