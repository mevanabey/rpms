import type { ReactNode } from "react";
import { requireAnyResource } from "@/lib/auth/authorization";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAnyResource(["admin:templates", "checklists:manage"]);
  return children;
}
