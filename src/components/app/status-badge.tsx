/**
 * Domain-specific status badges for RPMS. They forward to the shared
 * `StatusPill` primitive so colour + icon stay consistent everywhere.
 *
 * Adding a new lease/obligation status? Map it here once and every list view
 * picks it up.
 */
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import type { LeaseStatus, ObligationStatus } from "@/core/types";

const LEASE_TONE: Record<LeaseStatus, StatusTone> = {
  draft: "draft",
  signed: "info",
  active: "active",
  grace: "warning",
  terminated: "danger",
  expired: "muted",
  renewed: "info",
};

export function LeaseStatusBadge({ status }: { status: LeaseStatus }) {
  return <StatusPill tone={LEASE_TONE[status]} label={status} />;
}

const OB_TONE: Record<ObligationStatus, StatusTone> = {
  pending: "pending",
  done: "active",
  overdue: "danger",
  waived: "muted",
};

export function ObligationStatusBadge({ status }: { status: ObligationStatus }) {
  return <StatusPill tone={OB_TONE[status]} label={status} />;
}
