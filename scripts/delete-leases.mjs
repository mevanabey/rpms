#!/usr/bin/env node
/**
 * Hard-delete leases by id (or all of them when `--all` is passed).
 *
 *   pnpm exec node scripts/delete-leases.mjs --list
 *     → prints every lease in the DB (including soft-deleted) with id,
 *       tenant and property, then exits.
 *
 *   pnpm exec node scripts/delete-leases.mjs <id1> <id2> ...
 *     → for each id: removes every object under `<id>/` in the
 *       `lease-documents` bucket, then DELETEs the lease row. Cascading
 *       FKs clean up lease_unit / lease_party_role / rent_schedule_tranche
 *       / ledger_entry / etc.
 *
 *   pnpm exec node scripts/delete-leases.mjs --all
 *     → same as above but for every lease row currently in the DB.
 *
 * Reads DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY
 * from .env.local. Bypasses RLS via the secret key — server-only.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

// Load .env.local into process.env (same loader as promote-admin.mjs).
try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // .env.local missing — rely on process env.
}

const argv = process.argv.slice(2).filter((a) => a !== "--");
const list = argv.includes("--list");
const all = argv.includes("--all");
const idArgs = argv.filter((a) => !a.startsWith("--"));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example → .env.local first.");
  process.exit(1);
}
if (!list && !all && idArgs.length === 0) {
  console.error(
    "Usage:\n" +
      "  node scripts/delete-leases.mjs --list\n" +
      "  node scripts/delete-leases.mjs <id1> [id2] ...\n" +
      "  node scripts/delete-leases.mjs --all",
  );
  process.exit(2);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

async function buildLeaseSummary(rows) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const partyIds = new Set();
  const propIds = new Set();
  for (const r of rows) {
    partyIds.add(r.lessee_party_id);
    partyIds.add(r.lessor_party_id);
    propIds.add(r.property_id);
  }
  const parties = partyIds.size
    ? await sql`select id, display_name from party where id in ${sql(Array.from(partyIds))}`
    : [];
  const props = propIds.size
    ? await sql`select id, name from property where id in ${sql(Array.from(propIds))}`
    : [];
  const partyById = new Map(parties.map((p) => [p.id, p.display_name]));
  const propById = new Map(props.map((p) => [p.id, p.name]));
  return rows.map((r) => ({
    id: r.id,
    deletedAt: r.deleted_at,
    tenant: partyById.get(r.lessee_party_id) ?? "—",
    landlord: partyById.get(r.lessor_party_id) ?? "—",
    property: propById.get(r.property_id) ?? "—",
  }));
}

async function listAllLeases() {
  return sql`select id, lessor_party_id, lessee_party_id, property_id, deleted_at
             from lease order by created_at desc`;
}

async function deleteLease(id, supabase) {
  // 1. Storage cleanup.
  const { data: objects, error: listErr } = await supabase.storage
    .from("lease-documents")
    .list(id, { limit: 1000 });
  if (listErr) {
    console.warn(`  (storage list failed: ${listErr.message})`);
  } else if (objects && objects.length > 0) {
    const paths = objects.map((o) => `${id}/${o.name}`);
    const { error: rmErr } = await supabase.storage
      .from("lease-documents")
      .remove(paths);
    if (rmErr) console.warn(`  (storage remove failed: ${rmErr.message})`);
    else console.log(`  · removed ${paths.length} storage object(s).`);
  } else {
    console.log("  · no storage objects.");
  }
  // 2. DB row — CASCADE handles dependents.
  const rows = await sql`delete from lease where id = ${id} returning id`;
  if (rows.length === 0) {
    console.warn(`  (lease ${id} not found in DB.)`);
    return false;
  }
  console.log(`  · DB row deleted (cascade).`);
  return true;
}

try {
  if (list) {
    const rows = await listAllLeases();
    const summary = await buildLeaseSummary(rows);
    if (summary.length === 0) {
      console.log("(no leases)");
    } else {
      console.log(`Found ${summary.length} lease(s):`);
      for (const l of summary) {
        const tag = l.deletedAt ? " [soft-deleted]" : "";
        console.log(
          ` - ${l.id}${tag}\n    tenant : ${l.tenant}\n    landlord: ${l.landlord}\n    property: ${l.property}`,
        );
      }
    }
    process.exit(0);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set for storage cleanup.",
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let targets;
  if (all) {
    const rows = await listAllLeases();
    targets = rows.map((r) => r.id);
  } else {
    targets = idArgs;
  }
  console.log(`Deleting ${targets.length} lease(s):`);
  let okCount = 0;
  for (const id of targets) {
    console.log(`→ ${id}`);
    if (await deleteLease(id, supabase)) okCount++;
  }
  console.log(`\nDone. ${okCount}/${targets.length} succeeded.`);
} catch (e) {
  console.error("Delete failed:", e?.message ?? e);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
