import type { ReactNode } from "react";
import { requireResource } from "@/lib/auth/authorization";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireResource("admin:templates");
  return children;
}
