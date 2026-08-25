import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Relocated build output and pnpm virtual store. Both are renamed to
    // `.nosync` so iCloud skips them (see next.config.ts and .npmrc); ESLint
    // only ignores `node_modules` by default, so the store must be listed
    // explicitly or `eslint .` walks every installed package.
    ".next.nosync/**",
    ".pnpm.nosync/**",
  ]),
  // Ports-and-adapters guard. The `core/` ring is the inner domain layer —
  // it must never depend on Next.js, IO libraries, framework SDKs, or the
  // outer rings. See CLAUDE.md §6.
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*"], message: "core/ must not depend on Next.js" },
            { group: ["react", "react-dom"], message: "core/ must not depend on React" },
            { group: ["drizzle-orm", "drizzle-orm/*"], message: "core/ must not depend on Drizzle" },
            { group: ["@clerk/*"], message: "core/ must not depend on Clerk" },
            { group: ["@vercel/*"], message: "core/ must not depend on Vercel SDKs" },
            { group: ["@supabase/*"], message: "core/ must not depend on Supabase" },
            { group: ["@/server/*", "@/app/*", "@/components/*"], message: "core/ is the inner ring; only @/core/* and pure helpers" },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
