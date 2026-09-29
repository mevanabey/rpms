import type { ReactNode } from "react";
import { requireResource } from "@/lib/auth/authorization";

export default async function MaintenanceLayout({ children }: { children: ReactNode }) {
  await requireResource("maintenance:read");
  return children;
}
