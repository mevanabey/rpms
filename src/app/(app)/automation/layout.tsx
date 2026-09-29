import type { ReactNode } from "react";
import { requireResource } from "@/lib/auth/authorization";

export default async function AutomationLayout({ children }: { children: ReactNode }) {
  await requireResource("leases:write");
  return children;
}
