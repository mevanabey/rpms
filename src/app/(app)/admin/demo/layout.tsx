import type { ReactNode } from "react";
import { requireResource } from "@/lib/auth/authorization";

export default async function PageAccess({ children }: { children: ReactNode }) {
  await requireResource("admin:reset-demo");
  return children;
}
