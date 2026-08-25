"use client";

/**
 * Opens the lease in edit mode when it was reached via `?edit=1` (the Edit
 * action on the leases list). The query param is dropped once consumed so a
 * later refresh doesn't force edit mode back on.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useLeaseEditStore } from "./use-lease-edit";

export function LeaseEditBootstrap({
  leaseId,
  edit,
}: {
  leaseId: string;
  edit: boolean;
}) {
  const router = useRouter();
  const setEditing = useLeaseEditStore((s) => s.setEditing);
  const consumed = useRef(false);

  useEffect(() => {
    if (!edit || consumed.current) return;
    consumed.current = true;
    setEditing(leaseId, true);
    router.replace(`/leases/${leaseId}`, { scroll: false });
  }, [edit, leaseId, router, setEditing]);

  return null;
}
