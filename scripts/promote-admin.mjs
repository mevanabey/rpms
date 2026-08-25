#!/usr/bin/env node
/**
 * Promote a Supabase user to a given app role in the `user_role` table.
 *
 * Usage:
 *   pnpm db:promote -- <email> [role] [entity-code,entity-code,...]
 *
 * Examples:
 *   pnpm db:promote -- mevan@tsurudistilleries.com admin CTH,CTP-1,CTR,TCL,CBPO,ColBPO
 *   pnpm db:promote -- accountant@capitaltrust.lk account_manager CTH,CTR
 *
 * Defaults role to "admin" and entities to ALL legal_entity codes in the
 * database when not specified.
 *
 * Requirements:
 *   - DATABASE_URL set (loaded from .env.local)
 *   - SUPABASE_SECRET_KEY set (server-only — used to look up the auth user)
 *   - The user has already signed up via /login at least once (so the
 *     Supabase auth.users row + auto-provisioned user_role row exist).
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

const envFile = ".env.local";
try {
  const env = readFileSync(envFile, "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // .env.local missing — fall back to existing process env.
}

// Strip a leading `--` separator that `pnpm run -- foo` passes through.
const argv = process.argv.slice(2).filter((a) => a !== "--");
const [email, roleArg, entitiesArg] = argv;
if (!email) {
  console.error("Usage: pnpm db:promote -- <email> [role] [entity1,entity2,...]");
  process.exit(2);
}
const role = roleArg ?? "admin";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example → .env.local first.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

try {
  const [authUser] = await sql`
    select id, email from auth.users where email = ${email} limit 1
  `;
  if (!authUser) {
    console.error(
      `No Supabase auth user with email "${email}". Have them sign up at /login first.`,
    );
    process.exit(3);
  }

  let entities;
  if (entitiesArg) {
    entities = entitiesArg.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    const rows = await sql`select code from legal_entity order by code`;
    entities = rows.map((r) => r.code);
  }

  await sql`
    insert into user_role (user_id, role, entities, assigned_lease_ids, is_active)
    values (${authUser.id}, ${role}, ${sql.array(entities)}::text[], ${sql.array([])}::uuid[], true)
    on conflict (user_id) do update set
      role = excluded.role,
      entities = excluded.entities,
      is_active = true,
      updated_at = now()
  `;

  console.log(
    `✓ Promoted ${email} → role="${role}", entities=[${entities.join(", ")}]`,
  );
} catch (e) {
  console.error("Promote failed:", e?.message ?? e);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
