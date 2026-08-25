import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Vercel sets both CI and VERCEL; other CI providers set CI. Treat the usual
// falsey spellings as "not CI" so a stray `CI=false` in a local shell doesn't
// silently disable the iCloud workaround.
const truthy = (value: string | undefined) =>
  value !== undefined && !["", "0", "false"].includes(value.toLowerCase());

const isCI = truthy(process.env.VERCEL) || truthy(process.env.CI);

const nextConfig: NextConfig = {
  // Local builds write to `.next.nosync` rather than `.next`. The dev machine
  // has iCloud "Desktop & Documents" sync enabled, so everything under
  // ~/Documents is synced; iCloud evicts build artifacts and every re-read
  // blocks while they download, which stalls dev and build. iCloud ignores any
  // path ending in `.nosync`. `distDir` must stay inside the project directory,
  // so this is a rename rather than a relocation. See also `.npmrc`, which does
  // the same for pnpm's virtual store.
  //
  // CI has no iCloud and no reason to pay for the rename — and Vercel's Next.js
  // builder looks for `.next` specifically, so a custom distDir there fails the
  // deploy with "output directory .next was not found". Keep the workaround
  // local-only.
  distDir: isCI ? ".next" : ".next.nosync",
  turbopack: {
    root: dirname,
  },
  outputFileTracingRoot: dirname,
};

export default nextConfig;
