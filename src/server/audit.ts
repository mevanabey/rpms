import "server-only";

import { and, count, desc, eq, getTableColumns, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { requireResource } from "@/lib/auth/authorization";
import { requireAppUser } from "@/lib/auth/identity";
import { can, DEFAULT_PERMISSIONS, hasRole, type AppUser } from "@/lib/demo/identity";
import { db } from "@/server/db/client";
import { leaseAudit } from "@/server/db/schema";

export type LeaseAuditEntry = Omit<typeof leaseAudit.$inferSelect, "createdAt"> & { createdAt: string };

// Audit triggers snapshot the lease row. Original source cells have a stricter
// read path (a paired workbook requires both leases), so never send them via
// history or header activity. Strip in SQL to keep these frequent reads small.
const auditColumns = {
  ...getTableColumns(leaseAudit),
  before: sql<LeaseAuditEntry["before"]>`${leaseAudit.before} #- '{import_meta,checklist}'`,
  after: sql<LeaseAuditEntry["after"]>`${leaseAudit.after} #- '{import_meta,checklist}'`,
};

function visibleHistory(user: AppUser): SQL | undefined {
  if (hasRole(user, "admin")) return undefined;
  const ids = [...new Set([...(user.assignedLeaseIds ?? []), ...(user.createdLeaseIds ?? [])])];
  return ids.length ? inArray(leaseAudit.leaseId, ids) : sql`false`;
}

export async function listLeaseAudit({ leaseId, page = 1, search = "", pageSize = 50 }: {
  leaseId?: string; page?: number; search?: string; pageSize?: number;
} = {}) {
  const user = await requireResource("leases:read");
  const size = Math.max(1, Math.min(100, pageSize));
  const currentPage = Math.max(1, Math.floor(page) || 1);
  const needle = `%${search.slice(0, 200).replace(/[\\%_]/g, "\\$&")}%`;
  const condition = and(visibleHistory(user), leaseId ? eq(leaseAudit.leaseId, leaseId) : undefined,
    search ? or(ilike(leaseAudit.action, needle), ilike(leaseAudit.actorName, needle), ilike(leaseAudit.actorEmail, needle), ilike(leaseAudit.tableName, needle)) : undefined);
  const [rows, [total]] = await Promise.all([
    db.select(auditColumns).from(leaseAudit).where(condition).orderBy(desc(leaseAudit.createdAt), desc(leaseAudit.id))
      .limit(size).offset((currentPage - 1) * size),
    db.select({ count: count() }).from(leaseAudit).where(condition),
  ]);
  return { entries: rows.map((row): LeaseAuditEntry => ({ ...row, createdAt: row.createdAt.toISOString() })), total: total.count, page: currentPage, pageSize: size };
}

export async function getLeaseAuditEntry(id: string): Promise<LeaseAuditEntry | null> {
  const user = await requireResource("leases:read");
  const [row] = await db.select(auditColumns).from(leaseAudit).where(and(eq(leaseAudit.id, id), visibleHistory(user))).limit(1);
  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

export async function recentLeaseAudit(limit = 10): Promise<LeaseAuditEntry[]> {
  const user = await requireAppUser();
  if (!can(user, DEFAULT_PERMISSIONS, "leases:read")) return [];
  // Header/dashboard previews have no pagination, so don't count the entire
  // visible audit history just to display a handful of recent entries.
  const size = Math.max(1, Math.min(100, limit));
  const rows = await db.select(auditColumns).from(leaseAudit).where(visibleHistory(user))
    .orderBy(desc(leaseAudit.createdAt), desc(leaseAudit.id)).limit(size);
  return rows.map((row): LeaseAuditEntry => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
