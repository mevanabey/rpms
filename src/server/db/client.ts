import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Drizzle client backed by Supabase's pooled connection (port 6543, Transaction
 * mode). The pool is memoised on `globalThis` so Turbopack / HMR don't open a
 * new pool on every reload in dev.
 *
 * Connection settings tuned for Supabase + Vercel:
 *   - `prepare: false` — pgbouncer Transaction mode forbids session-scoped
 *     prepared statements.
 *   - `max: 10` — multiple Drizzle queries from a single render run in
 *     parallel (e.g. Dashboard fires leases + parties + properties +
 *     ledger). With `max: 1` they queue on one socket and stack network
 *     round-trips, which on a high-latency link reads as a statement
 *     timeout. 10 connections fit comfortably under the pgbouncer default
 *     pool size and stay polite to the shared pool.
 *   - `idle_timeout: 30` seconds — close idle sockets fast so we don't
 *     hold a connection slot across Next.js dev rebuilds.
 *   - `connect_timeout: 10` seconds — fail loud on cold-start, don't hang.
 *   - `connection.statement_timeout` — explicit ceiling so a runaway
 *     query can't burn the whole request budget. 30s is generous for any
 *     legitimate read; long imports happen out-of-request anyway.
 */

declare global {
  // eslint-disable-next-line no-var
  var __rpms_pg: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __rpms_drizzle: PostgresJsDatabase<typeof schema> | undefined;
}

function buildClient(): PostgresJsDatabase<typeof schema> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example → .env.local and fill in the Supabase pooled connection string.",
    );
  }
  if (!globalThis.__rpms_pg) {
    globalThis.__rpms_pg = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: () => {},
      connection: {
        // statement_timeout takes milliseconds when set via connection params.
        // 30s — generous for any legitimate read; runaway queries get killed.
        statement_timeout: 30_000,
      },
    });
  }
  if (!globalThis.__rpms_drizzle) {
    globalThis.__rpms_drizzle = drizzle(globalThis.__rpms_pg, { schema });
  }
  return globalThis.__rpms_drizzle;
}

export const db: PostgresJsDatabase<typeof schema> = buildClient();

export { schema };
