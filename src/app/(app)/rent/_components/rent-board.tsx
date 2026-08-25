"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  CalendarDays,
  Check,
  CheckCircle2,
  Columns3,
  ExternalLink,
  Mail,
  Receipt,
  RotateCcw,
  Send,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { MoneyDisplay } from "@/components/app/money-display";
import { SectionHeader } from "@/components/app/section-header";
import { SortableHeader, type SortDir } from "@/components/data-table/sortable-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type {
  Currency,
  LedgerEntry,
  Lease,
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
import { markRentPaidAction, unmarkRentPaidAction } from "@/server/actions";

export interface RentRow {
  entry: LedgerEntry;
  lease?: Lease;
  property?: Property;
  tenant?: Party;
  landlord?: Party;
  advisor?: Party;
}

const TODAY = "2026-05-13";

/** Window (days) used by the "Ending soon" tab to flag rent on expiring leases. */
const ENDING_SOON_DAYS = 90;

type Bucket = "overdue" | "due_soon" | "upcoming" | "paid";
type TabKey = Bucket | "ending_soon" | "all";

function isEndingSoon(row: RentRow): boolean {
  const end = row.lease?.endDate;
  if (!end) return false;
  if (end < TODAY) return false;
  const days = (new Date(end).getTime() - new Date(TODAY).getTime()) / 86400000;
  return days <= ENDING_SOON_DAYS;
}

function bucketize(row: RentRow, paidLocally: boolean): Bucket {
  if (paidLocally || row.entry.paidDate) return "paid";
  if (row.entry.dueDate < TODAY) return "overdue";
  const days =
    (new Date(row.entry.dueDate).getTime() - new Date(TODAY).getTime()) / 86400000;
  if (days <= 14) return "due_soon";
  return "upcoming";
}

const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "Overdue",
  due_soon: "Due in 14 days",
  upcoming: "Upcoming",
  paid: "Paid",
};

const BUCKET_TONE: Record<Bucket, string> = {
  overdue:
    "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-900",
  due_soon:
    "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900",
  upcoming:
    "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-900",
  paid:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900",
};

type ColumnKey =
  | "due"
  | "tenant"
  | "property"
  | "amount"
  | "status"
  | "type"
  | "units"
  | "lessor"
  | "advisor"
  | "cadence"
  | "leaseStart"
  | "leaseEnd";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  className?: string;
  cellClassName?: string;
  align?: "left" | "right";
  /** Hidden by default — user can toggle via the Columns menu. */
  defaultHidden?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: "due", label: "Due", cellClassName: "tabular-nums" },
  { key: "tenant", label: "Tenant" },
  { key: "property", label: "Property" },
  {
    key: "amount",
    label: "Amount",
    className: "text-right",
    cellClassName: "text-right tabular-nums",
    align: "right",
  },
  { key: "status", label: "Status" },
  { key: "type", label: "Type", defaultHidden: true },
  { key: "units", label: "Units", defaultHidden: true },
  { key: "lessor", label: "Landlord", defaultHidden: true },
  { key: "advisor", label: "Advisor", defaultHidden: true },
  { key: "cadence", label: "Payment frequency", defaultHidden: true },
  { key: "leaseStart", label: "Lease start", defaultHidden: true, cellClassName: "tabular-nums" },
  { key: "leaseEnd", label: "Lease end", defaultHidden: true, cellClassName: "tabular-nums" },
];

const DEFAULT_HIDDEN: ReadonlySet<ColumnKey> = new Set(
  COLUMNS.filter((c) => c.defaultHidden).map((c) => c.key),
);

const BUCKET_ORDER: Record<Bucket, number> = {
  overdue: 0,
  due_soon: 1,
  upcoming: 2,
  paid: 3,
};

function compareRentRows(
  key: ColumnKey,
  a: { row: RentRow; bucket: Bucket },
  b: { row: RentRow; bucket: Bucket },
): number {
  switch (key) {
    case "due":
      return a.row.entry.dueDate.localeCompare(b.row.entry.dueDate);
    case "tenant":
      return (a.row.tenant?.displayName ?? "").localeCompare(b.row.tenant?.displayName ?? "");
    case "property":
      return (a.row.property?.name ?? "").localeCompare(b.row.property?.name ?? "");
    case "amount":
      return a.row.entry.amount.amount - b.row.entry.amount.amount;
    case "status":
      return BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
    case "type": {
      const av = `${a.row.lease?.kind ?? ""}·${a.row.lease?.purpose ?? ""}`;
      const bv = `${b.row.lease?.kind ?? ""}·${b.row.lease?.purpose ?? ""}`;
      return av.localeCompare(bv);
    }
    case "units":
      return (a.row.lease?.unitIds.length ?? 0) - (b.row.lease?.unitIds.length ?? 0);
    case "lessor":
      return (a.row.landlord?.displayName ?? "").localeCompare(b.row.landlord?.displayName ?? "");
    case "advisor":
      return (a.row.advisor?.displayName ?? "").localeCompare(b.row.advisor?.displayName ?? "");
    case "cadence":
      return (a.row.lease?.paymentCadence ?? "").localeCompare(b.row.lease?.paymentCadence ?? "");
    case "leaseStart":
      return (a.row.lease?.startDate ?? "").localeCompare(b.row.lease?.startDate ?? "");
    case "leaseEnd":
      return (a.row.lease?.endDate ?? "").localeCompare(b.row.lease?.endDate ?? "");
  }
}

const CURRENCIES: Currency[] = ["LKR", "USD"];
const CADENCES: PaymentCadence[] = ["monthly", "quarterly", "biannual"];
type RemindedState = "any" | "yes" | "no";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

interface Filters {
  currencies: Set<Currency>;
  cadences: Set<PaymentCadence>;
  propertyId: string; // "all" | propertyId
  reminded: RemindedState;
}

const EMPTY_FILTERS: Filters = {
  currencies: new Set(),
  cadences: new Set(),
  propertyId: "all",
  reminded: "any",
};

function filtersAreEmpty(f: Filters): boolean {
  return (
    f.currencies.size === 0 &&
    f.cadences.size === 0 &&
    f.propertyId === "all" &&
    f.reminded === "any"
  );
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function RentBoard({
  rows,
  showHeader = true,
  showSummary = true,
}: {
  rows: RentRow[];
  showHeader?: boolean;
  showSummary?: boolean;
}) {
  const router = useRouter();
  const user = useCurrentUser();
  const rentReminders = useRentReminders();
  const sendRentReminder = useDemoStore((s) => s.sendRentReminder);
  const [, startTransition] = useTransition();

  const scoped = useMemo(
    () => scopeByLease(user, rows, (r) => r.entry.leaseId),
    [user, rows],
  );

  // Persistent state ----------------------------------------------------
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("overdue");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<ColumnKey>>(() => new Set(DEFAULT_HIDDEN));
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

  const hiddenIsDefault = useMemo(() => {
    if (hidden.size !== DEFAULT_HIDDEN.size) return false;
    for (const k of hidden) if (!DEFAULT_HIDDEN.has(k)) return false;
    return true;
  }, [hidden]);

  const properties = useMemo(() => {
    const map = new Map<string, Property>();
    for (const r of scoped) if (r.property) map.set(r.property.id, r.property);
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [scoped]);

  // Derive --------------------------------------------------------------
  const enriched = useMemo(() => {
    return scoped.map((row) => {
      const bucket = bucketize(row, false);
      const lastReminder = rentReminders.find((r) => r.ledgerEntryId === row.entry.id);
      // `overlay` retained as a stable shape for downstream UI that conditioned
      // on a local-only mark-paid; with Supabase writes we no longer use it.
      const overlay = undefined as undefined;
      return { row, bucket, overlay, lastReminder };
    });
  }, [scoped, rentReminders]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return enriched.filter(({ row, bucket, lastReminder }) => {
      if (tab === "ending_soon") {
        if (!isEndingSoon(row)) return false;
      } else if (tab !== "all" && bucket !== tab) {
        return false;
      }
      if (filters.currencies.size > 0 && !filters.currencies.has(row.entry.amount.currency)) return false;
      if (filters.cadences.size > 0) {
        const cadence = row.lease?.paymentCadence;
        if (!cadence || !filters.cadences.has(cadence)) return false;
      }
      if (filters.propertyId !== "all" && row.lease?.propertyId !== filters.propertyId) return false;
      if (filters.reminded === "yes" && !lastReminder) return false;
      if (filters.reminded === "no" && lastReminder) return false;
      if (!q) return true;
      return (
        row.entry.leaseId.toLowerCase().includes(q) ||
        (row.property?.name.toLowerCase().includes(q) ?? false) ||
        (row.tenant?.displayName.toLowerCase().includes(q) ?? false) ||
        (row.landlord?.displayName.toLowerCase().includes(q) ?? false)
      );
    });
  }, [enriched, tab, search, filters]);

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => !hidden.has(c.key)),
    [hidden],
  );

  const totals: Record<Bucket, Record<Currency, number>> = useMemo(() => {
    const init = (): Record<Currency, number> => ({ LKR: 0, USD: 0 });
    const acc: Record<Bucket, Record<Currency, number>> = {
      overdue: init(),
      due_soon: init(),
      upcoming: init(),
      paid: init(),
    };
    for (const { row, bucket } of enriched) {
      acc[bucket][row.entry.amount.currency] += row.entry.amount.amount;
    }
    return acc;
  }, [enriched]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => compareRentRows(sort.key, a, b));
    if (sort.dir === "desc") arr.reverse();
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const pageIds = pageRows.map((r) => r.row.entry.id);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPageSelected = !allOnPageSelected && pageIds.some((id) => selected.has(id));

  const togglePageSelection = (checked: boolean) => {
    const next = new Set(selected);
    if (checked) for (const id of pageIds) next.add(id);
    else for (const id of pageIds) next.delete(id);
    setSelected(next);
  };

  const toggleRow = (entryId: string) => {
    const next = new Set(selected);
    if (next.has(entryId)) next.delete(entryId);
    else next.add(entryId);
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  const activeFilterCount =
    filters.currencies.size +
    filters.cadences.size +
    (filters.propertyId !== "all" ? 1 : 0) +
    (filters.reminded !== "any" ? 1 : 0);

  // Actions -------------------------------------------------------------
  const handleMarkPaid = (row: RentRow) => {
    if (!user) return;
    const method =
      row.entry.amount.currency === "USD" ? "usd_transfer" : "lkr_transfer";
    startTransition(async () => {
      const result = await markRentPaidAction(row.entry.id, {
        paidDate: TODAY,
        paymentMethod: method,
        reference: `manual-${row.entry.id}`,
      });
      if (!result.ok) {
        toast.error("Could not mark paid", { description: result.error });
        return;
      }
      toast.success("Rent marked as paid", {
        description: `${row.tenant?.displayName ?? row.entry.leaseId} · ${formatCurrency(
          row.entry.amount.amount,
          { currency: row.entry.amount.currency, noDecimals: true },
        )}`,
      });
      router.refresh();
    });
  };

  const handleUnmarkPaid = (row: RentRow) => {
    startTransition(async () => {
      const result = await unmarkRentPaidAction(row.entry.id);
      if (!result.ok) {
        toast.error("Could not undo", { description: result.error });
        return;
      }
      toast.success("Undid mark-paid", {
        description: `${row.tenant?.displayName ?? row.entry.leaseId}`,
      });
      router.refresh();
    });
  };

  const handleSendReminder = (row: RentRow) => {
    if (!user) return;
    const recipients = [
      ...(row.tenant?.emails ?? []),
      ...(row.landlord?.emails ?? []),
    ].filter(Boolean);
    if (recipients.length === 0) {
      toast.error("No email on file", {
        description: "Add an email to the tenant or landlord party first.",
      });
      return;
    }
    sendRentReminder(
      {
        ledgerEntryId: row.entry.id,
        leaseId: row.entry.leaseId,
        to: recipients,
        by: user.name,
      },
      {
        dueDate: row.entry.dueDate,
        amount: row.entry.amount,
        tenantName: row.tenant?.displayName,
      },
    );
    toast.success("Reminder email queued", {
      description: `To ${recipients.join(", ")}`,
    });
  };

  const selectedEnriched = useMemo(
    () => filtered.filter((e) => selected.has(e.row.entry.id)),
    [filtered, selected],
  );

  const handleBulkMarkPaid = () => {
    if (!user) return;
    const targets = selectedEnriched.filter(
      (e) => e.bucket !== "paid" && !e.row.entry.paidDate,
    );
    if (targets.length === 0) {
      toast.error("Nothing to mark", {
        description: "All selected rows are already paid.",
      });
      return;
    }
    for (const { row } of targets) handleMarkPaid(row);
    toast.success(`Marked ${targets.length} rent line${targets.length === 1 ? "" : "s"} paid`);
    clearSelection();
  };

  const handleBulkSendReminder = () => {
    if (!user) return;
    const targets = selectedEnriched.filter((e) => e.bucket !== "paid");
    if (targets.length === 0) {
      toast.error("Nothing to remind", {
        description: "Selected rows are all paid.",
      });
      return;
    }
    let queued = 0;
    let skipped = 0;
    for (const { row } of targets) {
      const recipients = [
        ...(row.tenant?.emails ?? []),
        ...(row.landlord?.emails ?? []),
      ].filter(Boolean);
      if (recipients.length === 0) {
        skipped += 1;
        continue;
      }
      sendRentReminder(
        {
          ledgerEntryId: row.entry.id,
          leaseId: row.entry.leaseId,
          to: recipients,
          by: user.name,
        },
        {
          dueDate: row.entry.dueDate,
          amount: row.entry.amount,
          tenantName: row.tenant?.displayName,
        },
      );
      queued += 1;
    }
    toast.success(`Queued ${queued} reminder${queued === 1 ? "" : "s"}`, {
      description: skipped > 0 ? `${skipped} skipped (no email on file)` : undefined,
    });
    clearSelection();
  };

  const handleBulkExport = () => {
    if (selected.size === 0) return;
    toast.success(`Export queued (${selected.size} rows)`, {
      description: "CSV will be available in your downloads.",
    });
    clearSelection();
  };

  const resetAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setHidden(new Set(DEFAULT_HIDDEN));
    setSort(null);
    clearSelection();
  };

  // Render --------------------------------------------------------------
  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      {showHeader && (
        <div data-onborda="rent-title">
          <h1 className="font-bold text-2xl tracking-tight">Rent</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Every rent line across your leases. Check your bank, then mark each
            one paid. Behind on a tenant? Send them a reminder.
          </p>
        </div>
      )}

      {showSummary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <SummaryCard label="Overdue" totals={totals.overdue} tone={BUCKET_TONE.overdue} />
          <SummaryCard label="Due in 14 days" totals={totals.due_soon} tone={BUCKET_TONE.due_soon} />
          <SummaryCard label="Upcoming" totals={totals.upcoming} tone={BUCKET_TONE.upcoming} />
          <SummaryCard label="Paid" totals={totals.paid} tone={BUCKET_TONE.paid} />
        </div>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Rent ledger"
          description={
            <>
              Click <strong>Mark paid</strong> after you&apos;ve confirmed the credit
              on the bank statement. Click <strong>Send reminder</strong> to email
              the tenant and landlord.
            </>
          }
        />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search tenant, property, lease id…"
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
                  label="Currency"
                  values={CURRENCIES}
                  active={filters.currencies}
                  onToggle={(v) =>
                    setFilters({ ...filters, currencies: toggle(filters.currencies, v) })
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
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">Reminder sent</Label>
                  <Select
                    value={filters.reminded}
                    onValueChange={(v) =>
                      setFilters({ ...filters, reminded: v as RemindedState })
                    }
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="yes">Reminded</SelectItem>
                      <SelectItem value="no">Not reminded</SelectItem>
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
            <Button size="sm" variant="outline" onClick={handleBulkSendReminder}>
              <Send className="size-3.5" /> Send reminder
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkMarkPaid}>
              <CheckCircle2 className="size-3.5" /> Mark paid
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

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as TabKey);
            setPage(0);
          }}
        >
          <TabsList>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
            <TabsTrigger value="due_soon">Due soon</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="ending_soon">Lease Ending soon</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} />
        </Tabs>

        <Card>
          <CardContent className="px-0">
            <div className="relative overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 w-10 bg-muted text-center">
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
                    <TableHead className="sticky right-0 z-20 w-[210px] bg-muted text-right shadow-[-4px_0_8px_-4px_rgb(0_0_0_/_0.08)]">
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
                        Nothing in this bucket.
                      </TableCell>
                    </TableRow>
                  )}
                  {pageRows.map(({ row, bucket, overlay, lastReminder }) => {
                    const isSelected = selected.has(row.entry.id);
                    return (
                      <TableRow
                        key={row.entry.id}
                        data-state={isSelected ? "selected" : undefined}
                        className="group cursor-pointer"
                        onClick={() => router.push(`/leases/${row.entry.leaseId}`)}
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
                            onCheckedChange={() => toggleRow(row.entry.id)}
                            aria-label={`Select ${row.entry.id}`}
                          />
                        </TableCell>
                        {visibleColumns.map((c) => (
                          <TableCell key={c.key} className={c.cellClassName}>
                            {renderCell(c.key, row, bucket, overlay, lastReminder)}
                          </TableCell>
                        ))}
                        <TableCell
                          className={cn(
                            "sticky right-0 z-10 w-[210px] text-right transition-colors shadow-[-4px_0_8px_-4px_rgb(0_0_0_/_0.08)]",
                            isSelected ? "bg-muted" : "bg-card group-hover:bg-muted/50",
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendReminder(row)}
                              disabled={bucket === "paid"}
                            >
                              <Mail className="size-3.5" /> Send reminder
                            </Button>
                            {bucket === "paid" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUnmarkPaid(row)}
                                disabled={!row.entry.paidDate}
                                title="Undo mark-paid"
                              >
                                <Receipt className="size-3.5" /> Undo
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => handleMarkPaid(row)}>
                                <CheckCircle2 className="size-3.5" /> Mark paid
                              </Button>
                            )}
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
            Page {safePage + 1} of {totalPages} · {filtered.length} rows
            {(activeFilterCount > 0 || search || !hiddenIsDefault || sort) && (
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
      </section>
    </div>
  );
}

function renderCell(
  key: ColumnKey,
  row: RentRow,
  bucket: Bucket,
  _overlay: undefined,
  lastReminder: ReturnType<typeof useRentReminders>[number] | undefined,
): React.ReactNode {
  void _overlay;
  switch (key) {
    case "due":
      return (
        <>
          {formatDate(row.entry.dueDate)}
          {lastReminder && (
            <div className="mt-0.5 inline-flex items-center gap-1 text-muted-foreground text-[11px]">
              <Mail className="size-3" />
              Reminder {formatDate(new Date(lastReminder.ts))}
            </div>
          )}
        </>
      );
    case "tenant":
      return <div className="font-medium">{row.tenant?.displayName ?? "—"}</div>;
    case "property":
      return row.property?.name ?? "—";
    case "amount":
      return <MoneyDisplay amount={row.entry.amount} />;
    case "status":
      return (
        <>
          <Badge variant="outline" className={BUCKET_TONE[bucket]}>
            {BUCKET_LABEL[bucket]}
          </Badge>
          {row.entry.paidDate && (
            <div className="mt-0.5 text-muted-foreground text-[11px]">
              Paid {formatDate(row.entry.paidDate)}
            </div>
          )}
        </>
      );
    case "type":
      return row.lease ? (
        <span className="text-xs capitalize text-muted-foreground">
          {row.lease.kind} · {row.lease.purpose}
        </span>
      ) : (
        "—"
      );
    case "units":
      return row.lease ? (
        <Badge variant="outline" className="font-mono text-xs">
          {row.lease.unitIds.length}
        </Badge>
      ) : (
        "—"
      );
    case "lessor":
      return row.landlord?.displayName ?? "—";
    case "advisor":
      return row.advisor?.displayName ?? "—";
    case "cadence":
      return row.lease?.paymentCadence ?? "—";
    case "leaseStart":
      return row.lease ? formatDate(row.lease.startDate) : "—";
    case "leaseEnd":
      return row.lease ? formatDate(row.lease.endDate) : "—";
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

function SummaryCard({
  label,
  totals,
  tone,
}: {
  label: string;
  totals: Record<Currency, number>;
  tone: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>
          <Badge variant="outline" className={tone}>
            {label}
          </Badge>
        </CardDescription>
        <CardTitle className="text-xl tabular-nums">
          {formatCurrency(totals.LKR, { currency: "LKR", noDecimals: true })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-xs tabular-nums">
          + {formatCurrency(totals.USD, { currency: "USD", noDecimals: true })}
        </p>
      </CardContent>
    </Card>
  );
}
