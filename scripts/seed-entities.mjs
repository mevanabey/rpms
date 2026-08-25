#!/usr/bin/env node
/**
 * Seed (only) the `legal_entity` table with the Capital Trust group.
 *
 * Idempotent: every row uses an `ON CONFLICT (code) DO NOTHING` so re-runs
 * never overwrite an existing entity (in particular, never change the id).
 * Designed for the case where you've cleared transactional data (leases,
 * properties, parties) but want to keep / restore the configuration
 * scaffold without running the full `pnpm db:seed` (which TRUNCATEs
 * everything).
 *
 *   node scripts/seed-entities.mjs
 *   node scripts/seed-entities.mjs --list   # print current rows, exit
 *
 * Reads DATABASE_URL from .env.local.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* .env.local missing — fall back to process env */
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example → .env.local first.");
  process.exit(1);
}

const argv = process.argv.slice(2).filter((a) => a !== "--");
const listOnly = argv.includes("--list");

const ENTITIES = [
  { code: "CTH",    name: "Capital Trust Holdings",                  reg: "PV 75497PB" },
  { code: "CTP-1",  name: "Capital Trust Properties One (Pvt) Ltd",  reg: null         },
  { code: "CTR",    name: "Capital Trust Residencies (Pvt) Ltd",     reg: null         },
  { code: "CTR-9",  name: "Capital Trust Residencies Nine (Pvt) Ltd",reg: "PV 109828"  },
  { code: "TCL",    name: "Tech City Lanka (Pvt) Ltd",               reg: null         },
  { code: "CBPO",   name: "Capital BPO (Pvt) Ltd",                   reg: null         },
  { code: "ColBPO", name: "Colombo BPO (Pvt) Ltd",                   reg: null         },
];

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

try {
  if (listOnly) {
    const rows = await sql`select code, name, registration_no from legal_entity order by code`;
    if (rows.length === 0) console.log("(no legal_entity rows)");
    else for (const r of rows) console.log(` - ${r.code.padEnd(8)} ${r.name}  ${r.registration_no ?? ""}`);
    process.exit(0);
  }

  const before = await sql`select count(*)::int as n from legal_entity`;
  console.log(`Existing legal_entity rows: ${before[0].n}`);

  let inserted = 0;
  for (const e of ENTITIES) {
    const res = await sql`
      insert into legal_entity (id, code, name, registration_no)
      values (${randomUUID()}, ${e.code}, ${e.name}, ${e.reg})
      on conflict (code) do nothing
      returning id
    `;
    if (res.length > 0) {
      inserted++;
      console.log(`  + ${e.code}  ${e.name}`);
    } else {
      console.log(`  · ${e.code}  (already exists, skipped)`);
    }
  }

  const after = await sql`select count(*)::int as n from legal_entity`;
  console.log(`\nDone. Inserted ${inserted}, table now holds ${after[0].n} row(s).`);
} catch (e) {
  console.error("Seed-entities failed:", e?.message ?? e);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
