import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

if (!process.env.DIRECT_URL) {
  throw new Error("DIRECT_URL is not set in .env.local");
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL,
    // Supabase certs are valid but signed by a CA chain `pg` doesn't bundle.
    // We're already on `sslmode=require` in the URL — disable strict verify
    // so drizzle-kit can complete its handshake.
    ssl: { rejectUnauthorized: false },
  },
  // Avoid touching Supabase internals.
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
});
