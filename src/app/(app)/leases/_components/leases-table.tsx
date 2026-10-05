"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSubmission } from "@/hooks/use-submission";

import {
  CalendarDays,
  Check,
  CheckCircle2,
  Columns3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Mail,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { LeaseStatusBadge } from "@/components/app/status-badge";
import { MoneyDisplay } from "@/components/app/money-display";
import { SortableHeader, type SortDir } from "@/components/data-table/sortable-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  LedgerEntry,
  Lease,
  LeaseKind,
  LeasePurpose,
  LeaseStatus,
  Party,
  PaymentCadence,
  Property,
} from "@/core/types";
import { useDemoStore } from "@/lib/demo/store";
import { scopeByLease } from "@/lib/demo/scope";
import {
  useCurrentUser,
  useRentReminders,
} from "@/lib/demo/use-store";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  downloadBase64File,
  XLSX_MIME_TYPE,
} from "@/lib/file-download.client";
import { exportLeaseChecklistAction, markRentPaidAction } from "@/server/actions";

import { DeleteLeaseDialog } from "./delete-lease-dialog";

export type LeaseRow = {
  lease: Lease;
  property?: Property;
  lessor?: Party;
  lessee?: Party;
  advisor?: Party;
  nextRentEntry?: LedgerEntry;
  /** Display label for the master lease — set only when lease.parentLeaseId
   *  exists. Drives the "Sub of: ..." badge in the Property cell. */
  parentLabel?: string;
};

type ColumnKey =
  | "property"
  | "units"
  | "lessor"
  | "lessee"
  | "advisor"
  | "rent"
  | "cadence"
  | "start"
  | "end"
  | "status";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  className?: string;
  cellClassName?: string;
  align?: "left" | "right";
}

const COLUMNS: ColumnDef[] = [
  { key: "property", label: "Property" },
  { key: "units", label: "Units" },
  { key: "lessor", label: "Landlord" },
  { key: "lessee", label: "Tenant" },
  { key: "advisor", label: "Advisor" },
  {
    key: "rent",
    label: "Monthly rental",
    className: "text-right",
    cellClassName: "text-right tabular-nums",
    align: "right",
  },
  { key: "cadence", label: "Payment frequency" },
  { key: "start", label: "Start" },
  { key: "end", label: "End" },
  { key: "status", label: "Status" },
];

function compareLeaseRows(key: ColumnKey, a: LeaseRow, b: LeaseRow): number {
  switch (key) {
    case "property":
      return (a.property?.name ?? "").localeCompare(b.property?.name ?? "");
    case "units":
      return a.lease.unitIds.length - b.lease.unitIds.length;
    case "lessor":
      return (a.lessor?.displayName ?? "").localeCompare(b.lessor?.displayName ?? "");
    case "lessee":
      return (a.lessee?.displayName ?? "").localeCompare(b.lessee?.displayName ?? "");
    case "advisor":
      return (a.advisor?.displayName ?? "").localeCompare(b.advisor?.displayName ?? "");
    case "rent": {
      const av = a.lease.tranches[0]?.monthlyRent.amount ?? 0;
      const bv = b.lease.tranches[0]?.monthlyRent.amount ?? 0;
      return av - bv;
    }
    case "cadence":
      return a.lease.paymentCadence.localeCompare(b.lease.paymentCadence);
    case "start":
      return a.lease.startDate.localeCompare(b.lease.startDate);
    case "end":
      return a.lease.endDate.localeCompare(b.lease.endDate);
    case "status":
      return a.lease.status.localeCompare(b.lease.status);
  }
}

const STATUSES: LeaseStatus[] = [
  "draft",
  "signed",
  "active",
  "grace",
  "terminated",
  "expired",
  "renewed",
];
const KINDS: LeaseKind[] = ["head", "sub"];
const PURPOSES: LeasePurpose[] = ["commercial", "residential", "bpo"];
const CADENCES: PaymentCadence[] = ["monthly", "quarterly", "biannual"];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

interface Filters {
  statuses: Set<LeaseStatus>;
  kinds: Set<LeaseKind>;
  purposes: Set<LeasePurpose>;
  cadences: Set<PaymentCadence>;
  propertyId: string; // "all" | propertyId
}

const EMPTY_FILTERS: Filters = {
  statuses: new Set(),
  kinds: new Set(),
  purposes: new Set(),
  cadences: new Set(),
  propertyId: "all",
};

function filtersAreEmpty(f: Filters): boolean {
  return (
    f.statuses.size === 0 &&
    f.kinds.size === 0 &&
    f.purposes.size === 0 &&
    f.cadences.size === 0 &&
    f.propertyId === "all"
  );
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function LeasesTable({ rows }: { rows: LeaseRow[] }) {
  const router = useRouter();
  const { pending: submitting, run } = useSubmission();
  const [refreshing, startRefresh] = useTransition();
  const pending = submitting || refreshing;
  const [busyLeaseId, setBusyLeaseId] = useState<string | null>(null);
  const user = useCurrentUser();
  const rentReminders = useRentReminders();
  const sendRentReminder = useDemoStore((s) => s.sendRentReminder);

  // Persistent state -----------------------------------------------------
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LeaseRow | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<ColumnKey>>(new Set());
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(20);

  const toggleSort = (key: ColumnKey) => {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: "asc" };
      if (cur.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const properties = useMemo(() => {
    const map = new Map<string, Property>();
    for (const r of rows) if (r.property) map.set(r.property.id, r.property);
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Derive ---------------------------------------------------------------
  const scoped = useMemo(
    () => scopeByLease(user, rows, (r) => r.lease.id),
    [user, rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter((r) => {
      if (filters.statuses.size > 0 && !filters.statuses.has(r.lease.status)) return false;
      if (filters.kinds.size > 0 && !filters.kinds.has(r.lease.kind)) return false;
      if (filters.purposes.size > 0 && !filters.purposes.has(r.lease.purpose)) return false;
      if (filters.cadences.size > 0 && !filters.cadences.has(r.lease.paymentCadence)) return false;
      if (filters.propertyId !== "all" && r.lease.propertyId !== filters.propertyId) return false;
      if (!q) return true;
      return (
        r.lease.id.toLowerCase().includes(q) ||
        (r.property?.name.toLowerCase().includes(q) ?? false) ||
        (r.lessor?.displayName.toLowerCase().includes(q) ?? false) ||
        (r.lessee?.displayName.toLowerCase().includes(q) ?? false) ||
        r.lease.status.includes(q)
      );
    });
  }, [scoped, filters, search]);

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => !hidden.has(c.key)),
    [hidden],
  );

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => compareLeaseRows(sort.key, a, b));
    if (sort.dir === "desc") arr.reverse();
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const pageIds = pageRows.map((r) => r.lease.id);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPageSelected = !allOnPageSelected && pageIds.some((id) => selected.has(id));

  const togglePageSelection = (checked: boolean) => {
    const next = new Set(selected);
    if (checked) for (const id of pageIds) next.add(id);
    else for (const id of pageIds) next.delete(id);
    setSelected(next);
  };

  const toggleRow = (leaseId: string) => {
    const next = new Set(selected);
    if (next.has(leaseId)) next.delete(leaseId);
    else next.add(leaseId);
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  const activeFilterCount =
    filters.statuses.size +
    filters.kinds.size +
    filters.purposes.size +
    filters.cadences.size +
    (filters.propertyId !== "all" ? 1 : 0);

  // Actions --------------------------------------------------------------
  const handleBulkReminder = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    toast.success(`Queued reminders for ${ids.length} leases`);
    clearSelection();
  };

  const handleBulkExport = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    toast.success(`Export queued (${ids.length} leases)`, {
      description: "CSV will be available in your downloads.",
    });
    clearSelection();
  };

  /** Download one lease as an .xlsx intake checklist. */
  const exportChecklist = (leaseId: string) => {
    void run(async () => {
      setBusyLeaseId(leaseId);
      const res = await exportLeaseChecklistAction(leaseId);
      if (!res.ok) {
        toast.error("Could not export checklist", {
          description: res.error,
        });
        return;
      }
      downloadBase64File(res.data.base64, res.data.fileName, XLSX_MIME_TYPE);
      toast.success("Checklist exported", {
        description: res.data.fileName,
      });
    });
  };

  const handleMarkPaid = (row: LeaseRow) => {
    if (!user) return;
    const entry = row.nextRentEntry;
    if (!entry) return;
    const today = new Date().toISOString().slice(0, 10);
    const method =
      entry.amount.currency === "USD" ? "usd_transfer" : "lkr_transfer";
    if (pending) return;
    void run(async () => {
    setBusyLeaseId(row.lease.id);
    const result = await markRentPaidAction(entry.id, {
      paidDate: today,
      paymentMethod: method,
      reference: `manual-${entry.id}`,
    });
      if (!result.ok) {
        toast.error("Could not mark paid", { description: result.error });
        return;
      }
      toast.success("Rent marked as paid", {
        description: `${row.lessee?.displayName ?? row.lease.id} · ${formatCurrency(
          entry.amount.amount,
          { currency: entry.amount.currency, noDecimals: true },
        )}`,
      });
      startRefresh(() => router.refresh());
    });
  };

  const handleSendReminder = (row: LeaseRow) => {
    if (!user) return;
    const entry = row.nextRentEntry;
    if (!entry) {
      toast.error("No rent line to remind on", {
        description: "This lease has no upcoming or overdue rent entry.",
      });
      return;
    }
    const recipients = [
      ...(row.lessee?.emails ?? []),
      ...(row.lessor?.emails ?? []),
    ].filter(Boolean);
    if (recipients.length === 0) {
      toast.error("No email on file", {
        description: "Add an email to the tenant or landlord party first.",
      });
      return;
    }
    sendRentReminder(
      {
        ledgerEntryId: entry.id,
        leaseId: entry.leaseId,
        to: recipients,
        by: user.name,
      },
      {
        dueDate: entry.dueDate,
        amount: entry.amount,
        tenantName: row.lessee?.displayName,
      },
    );
    toast.success("Reminder email queued", {
      description: `To ${recipients.join(", ")}`,
    });
  };

  const resetAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setHidden(new Set());
    setSort(null);
    clearSelection();
  };

  // Render ---------------------------------------------------------------
  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search lease id, property, party, status…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="max-w-xs"
        />
        <div className="text-muted-foreground text-xs">
          {filtered.length} of {scoped.length}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="size-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 font-mono text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="size-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMNS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={!hidden.has(c.key)}
                  onCheckedChange={(checked) => {
                    const next = new Set(hidden);
                    if (checked) next.delete(c.key);
                    else next.add(c.key);
                    setHidden(next);
                  }}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Advanced filters */}
      <Collapsible open={filtersOpen}>
        <CollapsibleContent>
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FilterGroup
                label="Status"
                values={STATUSES}
                active={filters.statuses}
                onToggle={(v) =>
                  setFilters({ ...filters, statuses: toggle(filters.statuses, v) })
                }
              />
              <FilterGroup
                label="Kind"
                values={KINDS}
                active={filters.kinds}
                onToggle={(v) =>
                  setFilters({ ...filters, kinds: toggle(filters.kinds, v) })
                }
              />
              <FilterGroup
                label="Purpose"
                values={PURPOSES}
                active={filters.purposes}
                onToggle={(v) =>
                  setFilters({ ...filters, purposes: toggle(filters.purposes, v) })
                }
              />
              <FilterGroup
                label="Payment frequency"
                values={CADENCES}
                active={filters.cadences}
                onToggle={(v) =>
                  setFilters({ ...filters, cadences: toggle(filters.cadences, v) })
                }
              />
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Property</Label>
                <Select
                  value={filters.propertyId}
                  onValueChange={(v) => setFilters({ ...filters, propertyId: v })}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All properties</SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator className="my-3" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-muted-foreground text-xs">
                {filtersAreEmpty(filters)
                  ? "No filters applied."
                  : `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied.`}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  disabled={filtersAreEmpty(filters)}
                >
                  <RotateCcw className="size-3.5" /> Reset
                </Button>
                <Button variant="outline" size="sm" onClick={() => setFiltersOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-primary/5 px-3 py-2">
          <div className="text-sm">
            <span className="font-medium">{selected.size}</span>{" "}
            <span className="text-muted-foreground">selected</span>
          </div>
          <Separator orientation="vertical" className="!h-4" />
          <Button size="sm" variant="outline" onClick={handleBulkReminder}>
            <Send className="size-3.5" /> Send reminder
          </Button>
          <Button size="sm" variant="outline" onClick={handleBulkExport}>
            <ExternalLink className="size-3.5" /> Export CSV
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={clearSelection}
          >
            <X className="size-3.5" /> Clear
          </Button>
        </div>
      )}

      {/* Table — scrolls horizontally; checkbox + Actions stay pinned. */}
      <Card>
        <CardContent className="px-0">
          <div className="relative overflow-x-auto">
            <Table className="min-w-[1100px]">
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead
                  className="sticky left-0 z-20 w-10 bg-muted text-center"
                >
                  <Checkbox
                    checked={
                      allOnPageSelected
                        ? true
                        : someOnPageSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(v) => togglePageSelection(v === true)}
                    aria-label="Select all on page"
                  />
                </TableHead>
                {visibleColumns.map((c) => (
                  <TableHead key={c.key} className={c.className}>
                    <SortableHeader
                      label={c.label}
                      align={c.align}
                      active={sort?.key === c.key}
                      direction={sort?.key === c.key ? sort.dir : "asc"}
                      onToggle={() => toggleSort(c.key)}
                    />
                  </TableHead>
                ))}
                <TableHead
                  className="sticky right-0 z-20 w-[260px] bg-muted text-right shadow-[-4px_0_8px_-4px_rgb(0_0_0_/_0.08)]"
                >
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length + 2}
                    className="h-32 text-center text-muted-foreground text-sm"
                  >
                    No leases match your filters.
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((r) => {
                const isSelected = selected.has(r.lease.id);
                const entry = r.nextRentEntry;
                const alreadyPaid = entry ? !!entry.paidDate : false;
                const lastReminder = entry
                  ? rentReminders.find((rem) => rem.ledgerEntryId === entry.id)
                  : undefined;
                return (
                  <TableRow
                    key={r.lease.id}
                    data-state={isSelected ? "selected" : undefined}
                    className="group cursor-pointer"
                    onClick={() => router.push(`/leases/${r.lease.id}`)}
                  >
                    <TableCell
                      className={cn(
                        "sticky left-0 z-10 w-10 text-center transition-colors",
                        isSelected ? "bg-muted" : "bg-card group-hover:bg-muted/50",
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(r.lease.id)}
                        aria-label={`Select ${r.lease.id}`}
                      />
                    </TableCell>
                    {visibleColumns.map((c) => (
                      <TableCell key={c.key} className={c.cellClassName}>
                        {renderCell(c.key, r)}
                      </TableCell>
                    ))}
                    <TableCell
                      className={cn(
                        "sticky right-0 z-10 w-[260px] text-right transition-colors shadow-[-4px_0_8px_-4px_rgb(0_0_0_/_0.08)]",
                        isSelected ? "bg-muted" : "bg-card group-hover:bg-muted/50",
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendReminder(r)}
                          disabled={pending || !entry || alreadyPaid}
                          title={
                            !entry
                              ? "No upcoming rent line"
                              : alreadyPaid
                                ? "Rent already paid"
                                : lastReminder
                                  ? `Last reminder: ${formatDate(new Date(lastReminder.ts))}`
                                  : "Send rent reminder"
                          }
                        >
                          <Mail className="size-3.5" /> Send reminder
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleMarkPaid(r)}
                          disabled={!entry || alreadyPaid}
                          title={
                            !entry
                              ? "No rent line to mark"
                              : alreadyPaid
                                ? "Rent already paid"
                                : `Mark ${formatCurrency(entry.amount.amount, { currency: entry.amount.currency, noDecimals: true })} as paid`
                          }
                        >
                          <CheckCircle2 className="size-3.5" /> {pending && busyLeaseId === r.lease.id ? "Recording…" : "Mark paid"}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="More actions">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>
                              {r.lessee?.displayName ?? r.property?.name ?? "Lease"}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => router.push(`/leases/${r.lease.id}`)}
                            >
                              <Eye className="size-3.5" /> Open lease
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                router.push(`/leases/${r.lease.id}?edit=1`)
                              }
                            >
                              <Pencil className="size-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={pending}
                              onSelect={() => exportChecklist(r.lease.id)}
                            >
                              <FileSpreadsheet className="size-3.5" /> Export checklist
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="size-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <CalendarDays className="size-3.5" />
          Page {safePage + 1} of {totalPages} · {filtered.length} leases
          {(activeFilterCount > 0 || search || hidden.size > 0 || sort) && (
            <Button variant="ghost" size="sm" className="h-6" onClick={resetAll}>
              <RotateCcw className="size-3" /> Reset view
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(0);
            }}
          >
            <SelectTrigger size="sm" className="w-[88px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      {deleteTarget && (
        <DeleteLeaseDialog
          leaseId={deleteTarget.lease.id}
          label={deleteTarget.lessee?.displayName ?? deleteTarget.property?.name}
          open
          onOpenChange={(o) => !o && setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function renderCell(key: ColumnKey, r: LeaseRow): React.ReactNode {
  const l = r.lease;
  switch (key) {
    case "property":
      return (
        <div className="flex flex-col gap-0.5">
          <span>{r.property?.name ?? "—"}</span>
          {r.parentLabel && (
            <span className="inline-flex items-center gap-1 text-[11px] text-violet-700 dark:text-violet-300">
              Sub of: <span className="font-medium">{r.parentLabel}</span>
            </span>
          )}
        </div>
      );
    case "units":
      return (
        <Badge variant="outline" className="font-mono text-xs">
          {l.unitIds.length}
        </Badge>
      );
    case "lessor":
      return r.lessor?.displayName ?? "—";
    case "lessee":
      return r.lessee?.displayName ?? "—";
    case "advisor":
      return r.advisor?.displayName ?? "—";
    case "rent":
      return <MoneyDisplay amount={l.tranches[0]?.monthlyRent} />;
    case "cadence":
      return l.paymentCadence;
    case "start":
      return formatDate(l.startDate);
    case "end":
      return formatDate(l.endDate);
    case "status":
      return <LeaseStatusBadge status={l.status} />;
  }
}

function FilterGroup<T extends string>({
  label,
  values,
  active,
  onToggle,
}: {
  label: string;
  values: readonly T[];
  active: Set<T>;
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => {
          const on = active.has(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => onToggle(v)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs capitalize transition-colors",
                on
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-3 shrink-0 items-center justify-center rounded-[3px] border transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input",
                )}
              >
                {on && <Check className="size-2.5" />}
              </span>
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
