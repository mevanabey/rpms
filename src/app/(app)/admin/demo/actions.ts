"use server";

import { revalidatePath } from "next/cache";

import { mockAdmin } from "@/server/adapters/mock";
import { requireResource } from "@/lib/auth/authorization";

/**
 * Mutates the in-memory mock backend on the server. Both actions revalidate
 * the major data-bearing routes so the next render reflects the change.
 */

async function revalidateBackendRoutes() {
  // Top-level data surfaces — anything that calls getBackend().
  for (const path of [
    "/",
    "/leases",
    "/rent",
    "/properties",
    "/parties",
  ]) {
    revalidatePath(path);
  }
  // Detail routes too.
  revalidatePath("/leases/[id]", "page");
  revalidatePath("/properties/[id]", "page");
  revalidatePath("/parties/[id]", "page");
}

export async function resetMockBackend(): Promise<{ ok: true; counts: Record<string, number> }> {
  await requireResource("admin:reset-demo");
  mockAdmin.resetAll();
  await revalidateBackendRoutes();
  return { ok: true, counts: mockAdmin.counts() };
}

export async function clearMockBackend(): Promise<{ ok: true; counts: Record<string, number> }> {
  await requireResource("admin:reset-demo");
  mockAdmin.clearAll();
  await revalidateBackendRoutes();
  return { ok: true, counts: mockAdmin.counts() };
}

export async function getMockBackendCounts(): Promise<Record<string, number>> {
  await requireResource("admin:reset-demo");
  return mockAdmin.counts();
}
