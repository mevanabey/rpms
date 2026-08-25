import "server-only";

import type { Backend } from "@/core/services";

import { mockBackend } from "./adapters/mock";
import { supabaseBackend } from "./adapters/supabase";

const VALID_KINDS = ["mock", "supabase", "vercel", "agentfabriq"] as const;
type BackendKind = (typeof VALID_KINDS)[number];

function resolveKind(): BackendKind {
  const raw = (process.env.BACKEND ?? "mock").toLowerCase();
  if ((VALID_KINDS as readonly string[]).includes(raw)) {
    return raw as BackendKind;
  }
  throw new Error(
    `Unknown BACKEND=${raw}. Expected one of: ${VALID_KINDS.join(", ")}.`,
  );
}

function resolveBackend(): Backend {
  const kind = resolveKind();
  switch (kind) {
    case "mock":
      return mockBackend;
    case "supabase":
      return supabaseBackend;
    case "vercel":
      throw new Error(
        "BACKEND=vercel adapter is Phase 02 — see src/server/adapters/vercel/README.md",
      );
    case "agentfabriq":
      throw new Error(
        "BACKEND=agentfabriq adapter is Phase 03 — see src/server/adapters/agent-fabriq/README.md",
      );
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unknown BACKEND=${_exhaustive as string}`);
    }
  }
}

let cached: Backend | null = null;

/**
 * Resolves the active backend. Server Components and server actions call this;
 * UI components never do (CLAUDE.md §3 — UI/data separation). The contract is
 * the same across all phases.
 */
export function getBackend(): Backend {
  if (!cached) cached = resolveBackend();
  return cached;
}
