import "server-only";

import type { AppUser, Resource } from "@/lib/demo/identity";
import { can, DEFAULT_PERMISSIONS } from "@/lib/demo/identity";
import { canSeeLease } from "@/lib/demo/scope";
import { requireAppUser } from "@/lib/auth/identity";

export async function requireResource(resource: Resource): Promise<AppUser> {
  const user = await requireAppUser();
  if (!can(user, DEFAULT_PERMISSIONS, resource)) {
    throw new Error(`Access denied: ${resource}.`);
  }
  return user;
}

export async function requireLeaseAccess(
  leaseId: string,
  resource: Resource = "leases:read",
): Promise<AppUser> {
  const user = await requireResource(resource);
  if (!canSeeLease(user, leaseId)) {
    throw new Error("Access denied: this lease is neither assigned to you nor created by you.");
  }
  return user;
}
