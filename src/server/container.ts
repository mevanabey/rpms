import "server-only";

import type { Backend } from "@/core/services";

import { mockBackend } from "./adapters/mock";

type BackendKind = "mock" | "vercel" | "agentfabriq";

const KIND = (process.env.BACKEND ?? "mock") as BackendKind;

let backend: Backend;

switch (KIND) {
  case "mock":
    backend = mockBackend;
    break;
  case "vercel":
    throw new Error(
      "BACKEND=vercel adapter is Phase 02 — see src/server/adapters/vercel/README.md",
    );
  case "agentfabriq":
    throw new Error(
      "BACKEND=agentfabriq adapter is Phase 03 — see src/server/adapters/agent-fabriq/README.md",
    );
  default: {
    const _exhaustive: never = KIND;
    throw new Error(`Unknown BACKEND=${_exhaustive as string}`);
  }
}

/**
 * Resolves the active backend. Server Components and server actions call this;
 * UI components never do (CLAUDE.md §3 — UI/data separation). The contract is
 * the same across all phases.
 */
export function getBackend(): Backend {
  return backend;
}
