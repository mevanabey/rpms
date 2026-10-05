import type { ReactNode } from "react";
import { requireResource } from "@/lib/auth/authorization";

export default async function ActivityLayout({ children }: { children: ReactNode }) {
  await requireResource("leases:read");
  return children;
}
