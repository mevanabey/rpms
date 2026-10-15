import type { ReactNode } from "react";
import { requireResource } from "@/lib/auth/authorization";

export default async function TasksLayout({ children }: { children: ReactNode }) {
  await requireResource("tasks:read");
  return children;
}
