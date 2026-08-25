import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Build output is written to `.next.nosync` rather than `.next`. This machine
  // has iCloud "Desktop & Documents" sync enabled, so everything under
  // ~/Documents is synced; iCloud evicts build artifacts and every re-read
  // blocks while they download, which stalls dev and build. iCloud ignores any
  // path ending in `.nosync`. `distDir` must stay inside the project directory,
  // so this is a rename rather than a relocation. See also `.npmrc`, which does
  // the same for pnpm's virtual store.
  distDir: ".next.nosync",
  turbopack: {
    root: dirname,
  },
  outputFileTracingRoot: dirname,
};

export default nextConfig;
