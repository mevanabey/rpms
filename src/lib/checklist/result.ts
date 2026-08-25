/**
 * Result of materialising one checklist into backend records. Lives in its own
 * runtime-free module so the Client Component upload page can import the type
 * without pulling in `@/lib/checklist/import` (which is `server-only`).
 */
export interface ChecklistImportResult {
  ok: true;
  leaseId: string;
  subLeaseId?: string;
  propertyName: string;
  lesseeName: string;
  lessorName: string;
  tranches: number;
  hasSubLease: boolean;
  createdEntities: number;
  reusedEntities: number;
  warnings: string[];
}
