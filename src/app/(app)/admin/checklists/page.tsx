"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { RoleGate } from "@/components/app/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ChecklistImportResult } from "@/lib/checklist/result";
import {
  type ExtractedChecklist,
  extractChecklist,
  parseCsv,
  parseXlsx,
} from "@/lib/checklist/parse";
import { useDemoStore } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/use-store";
import { cn } from "@/lib/utils";

import { importChecklist } from "./actions";

type RowStatus =
  | { kind: "queued" }
  | { kind: "parsing" }
  | { kind: "parsed"; extracted: ExtractedChecklist }
  | { kind: "importing"; extracted: ExtractedChecklist }
  | { kind: "done"; extracted: ExtractedChecklist; result: ChecklistImportResult }
  | { kind: "error"; error: string; extracted?: ExtractedChecklist };

interface FileRow {
  id: string;
  file: File;
  status: RowStatus;
}

const ACCEPT =
  ".csv,.xlsx,.xls,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.oasis.opendocument.spreadsheet";

const CONCURRENCY = 3;

export default function ChecklistUploadPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const pushActivity = useDemoStore((s) => s.pushActivity);

  const [files, setFiles] = useState<FileRow[]>([]);
  const [isRunning, startRun] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    if (arr.length === 0) return;
    setFiles((prev) => {
      const next: FileRow[] = [...prev];
      for (const file of arr) {
        const ext = file.name.toLowerCase().split(".").pop() ?? "";
        if (!["csv", "xlsx", "xls", "ods"].includes(ext)) {
          next.push({
            id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 6)}`,
            file,
            status: { kind: "error", error: `Unsupported file type .${ext}` },
          });
          continue;
        }
        next.push({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 6)}`,
          file,
          status: { kind: "queued" },
        });
      }
      return next;
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const updateRow = (id: string, patch: (row: FileRow) => FileRow) =>
    setFiles((rows) => rows.map((r) => (r.id === id ? patch(r) : r)));

  const removeRow = (id: string) =>
    setFiles((rows) => rows.filter((r) => r.id !== id));

  const clearAll = () => setFiles([]);

  const parseRow = async (row: FileRow): Promise<ExtractedChecklist> => {
    const ext = row.file.name.toLowerCase().split(".").pop() ?? "";
    const grid =
      ext === "csv"
        ? parseCsv(await row.file.text())
        : parseXlsx(await row.file.arrayBuffer());
    return extractChecklist(grid);
  };

  const importRow = async (row: FileRow): Promise<void> => {
    updateRow(row.id, (r) => ({ ...r, status: { kind: "parsing" } }));
    let extracted: ExtractedChecklist;
    try {
      extracted = await parseRow(row);
    } catch (err) {
      updateRow(row.id, () => ({
        ...row,
        status: { kind: "error", error: err instanceof Error ? err.message : "Parse failed" },
      }));
      return;
    }
    if (Object.keys(extracted.fields).length === 0) {
      updateRow(row.id, () => ({
        ...row,
        status: { kind: "error", extracted, error: "No recognised fields" },
      }));
      return;
    }
    updateRow(row.id, () => ({ ...row, status: { kind: "importing", extracted } }));
    try {
      const result = await importChecklist({
        fields: extracted.fields,
        schedules: extracted.schedules,
        unknown: extracted.unknown,
      });
      updateRow(row.id, () => ({ ...row, status: { kind: "done", extracted, result } }));
      pushActivity({
        workflow: "onboard-tenant",
        severity: "info",
        title: "Checklist imported",
        body: `${row.file.name} → draft ${result.leaseId.slice(-6)} for ${result.lesseeName} · ${result.tranches} tranche${result.tranches === 1 ? "" : "s"}${
          result.hasSubLease ? " · paired sub-lease created" : ""
        }${user?.name ? ` (by ${user.name})` : ""}.`,
      });
    } catch (err) {
      updateRow(row.id, () => ({
        ...row,
        status: {
          kind: "error",
          extracted,
          error: err instanceof Error ? err.message : "Import failed",
        },
      }));
    }
  };

  const runAll = () => {
    startRun(async () => {
      const queue = files.filter((r) => r.status.kind === "queued" || r.status.kind === "parsed");
      if (queue.length === 0) {
        toast.info("Nothing to import");
        return;
      }
      // Concurrency-limited worker pool.
      const pool: Promise<void>[] = [];
      const iter = queue[Symbol.iterator]();
      const next = async () => {
        const item = iter.next();
        if (item.done) return;
        await importRow(item.value);
        await next();
      };
      for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
        pool.push(next());
      }
      await Promise.all(pool);
      router.refresh();
      toast.success(`Processed ${queue.length} file${queue.length === 1 ? "" : "s"}`);
    });
  };

  const summary = useMemo(() => {
    const tally = { queued: 0, parsing: 0, parsed: 0, importing: 0, done: 0, error: 0 };
    let tranches = 0;
    let subLeases = 0;
    let createdEntities = 0;
    let reusedEntities = 0;
    for (const r of files) {
      tally[r.status.kind]++;
      if (r.status.kind === "done") {
        tranches += r.status.result.tranches;
        if (r.status.result.hasSubLease) subLeases++;
        createdEntities += r.status.result.createdEntities;
        reusedEntities += r.status.result.reusedEntities;
      }
    }
    return { tally, tranches, subLeases, createdEntities, reusedEntities };
  }, [files]);

  const pendingCount = summary.tally.queued + summary.tally.parsed;
  const inFlightCount =
    summary.tally.parsing + summary.tally.importing + summary.tally.queued + summary.tally.parsed;
  // Once a run has finished, every row should be in a terminal state.
  // `hasResults` flips the page into the post-upload view (no drop area;
  // shows stats + table + "Upload more").
  const hasResults =
    !isRunning &&
    files.length > 0 &&
    files.every((r) => r.status.kind === "done" || r.status.kind === "error");

  return (
    <RoleGate required={["admin:import"]}>
      <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Checklist upload</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Each file becomes
            a draft lease (auto-created or matched by name). 
            Multi-tranche rent schedules are read directly
            from the schedule table; checklists with a sub-tenancy block create
            a paired sub-lease. Anything we can&apos;t parse is logged per row.
            Accepts <code className="font-mono text-xs">.xlsx</code>,{" "}
            <code className="font-mono text-xs">.xls</code>,{" "}
            <code className="font-mono text-xs">.ods</code> and{" "}
            <code className="font-mono text-xs">.csv</code>.
          </p>
        </div>

        {!hasResults && (
          <Card
            className="border-dashed"
            onDragOver={(e) => {
              if (isRunning) return;
              e.preventDefault();
            }}
            onDrop={(e) => {
              if (isRunning) return;
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
          >
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              {isRunning ? (
                <>
                  <Spinner className="size-10 text-primary" />
                  <div className="max-w-md">
                    <CardTitle className="text-base">Uploading…</CardTitle>
                    <CardDescription className="mt-1">
                      Parsing and importing {inFlightCount}{" "}
                      {inFlightCount === 1 ? "file" : "files"}. Keep this tab
                      open until the table below settles.
                    </CardDescription>
                  </div>
                </>
              ) : (
                <>
                  <UploadCloud className="size-10 text-muted-foreground" />
                  <div className="max-w-md">
                    <CardTitle className="text-base">
                      Drop one or many checklists here
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Files are parsed in your browser. Imports run in batches
                      of {CONCURRENCY} against the backend.
                    </CardDescription>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT}
                    multiple
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => inputRef.current?.click()}
                    >
                      <FileSpreadsheet className="size-3.5" />
                      Choose files
                    </Button>
                    <Button
                      size="sm"
                      onClick={runAll}
                      disabled={pendingCount === 0}
                    >
                      {`Import ${pendingCount || ""} file${pendingCount === 1 ? "" : "s"}`.trim()}
                    </Button>
                    {files.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearAll}>
                        <RotateCcw className="size-3.5" />
                        Clear list
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {files.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryTile label="Files" value={files.length} />
              <SummaryTile
                label="Imported"
                value={summary.tally.done}
                tone="emerald"
              />
              <SummaryTile
                label="Errors"
                value={summary.tally.error}
                tone={summary.tally.error > 0 ? "rose" : undefined}
              />
              <SummaryTile
                label="Rental periods"
                value={summary.tranches}
                sub={`${summary.subLeases} sub-lease${summary.subLeases === 1 ? "" : "s"}`}
              />
            </div>

            <Card>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Detected</TableHead>
                      <TableHead>Lease</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((row) => (
                      <FileStatusRow
                        key={row.id}
                        row={row}
                        onRemove={() => removeRow(row.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {hasResults && (
                <Button variant="outline" size="sm" onClick={clearAll}>
                  <Plus className="size-3.5" />
                  Upload more
                </Button>
              )}
              {summary.tally.done > 0 && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/leases">
                    <ExternalLink className="size-3.5" />
                    View leases
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </RoleGate>
  );
}

function FileStatusRow({ row, onRemove }: { row: FileRow; onRemove: () => void }) {
  const extracted =
    row.status.kind === "parsed" ||
    row.status.kind === "importing" ||
    row.status.kind === "done" ||
    (row.status.kind === "error" && row.status.extracted)
      ? (row.status as Extract<RowStatus, { extracted: ExtractedChecklist }>).extracted
      : undefined;

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-sm">{row.file.name}</div>
        <div className="text-muted-foreground text-xs">
          {(row.file.size / 1024).toFixed(1)} KB
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={row.status} />
        {row.status.kind === "done" && row.status.result.warnings.length > 0 && (
          <div className="mt-1 flex items-start gap-1 text-amber-700 text-xs dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            <span className="text-[11px]">
              {row.status.result.warnings.join(" · ")}
            </span>
          </div>
        )}
        {row.status.kind === "error" && (
          <div className="mt-1 text-rose-700 text-xs dark:text-rose-300">
            {row.status.error}
          </div>
        )}
      </TableCell>
      <TableCell className="text-xs">
        {extracted ? (
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">
              {Object.keys(extracted.fields).length} field
              {Object.keys(extracted.fields).length === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline">
              {extracted.schedules.length} schedule
              {extracted.schedules.length === 1 ? "" : "s"}
            </Badge>
            {extracted.schedules.some((s) => s.kind === "sub") && (
              <Badge variant="outline" className="border-violet-300 text-violet-700 dark:text-violet-300">
                sub-tenancy
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs">
        {row.status.kind === "done" ? (
          <div className="flex flex-col gap-1.5">
            <Link
              href={`/leases/${row.status.result.leaseId}`}
              className="hover:underline"
            >
              {row.status.result.lesseeName}
            </Link>
            <span className="text-muted-foreground">
              {row.status.result.propertyName} · {row.status.result.tranches} tranche
              {row.status.result.tranches === 1 ? "" : "s"}
            </span>
            {row.status.result.subLeaseId && (
              <Link
                href={`/leases/${row.status.result.subLeaseId}`}
                className="text-violet-700 hover:underline dark:text-violet-300"
              >
                + sub-lease
              </Link>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Remove ${row.file.name}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ status }: { status: RowStatus }) {
  switch (status.kind) {
    case "queued":
      return <Badge variant="outline">Queued</Badge>;
    case "parsing":
      return <Badge variant="outline">Parsing…</Badge>;
    case "parsed":
      return <Badge variant="outline">Parsed</Badge>;
    case "importing":
      return <Badge variant="outline">Importing…</Badge>;
    case "done":
      return (
        <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
          <CheckCircle2 className="size-3" /> Imported
        </Badge>
      );
    case "error":
      return (
        <Badge
          variant="outline"
          className="border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
        >
          <XCircle className="size-3" /> Error
        </Badge>
      );
  }
}

function SummaryTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "emerald" | "rose";
}) {
  return (
    <Card
      className={cn(
        tone === "emerald" && "border-emerald-200 dark:border-emerald-900",
        tone === "rose" && "border-rose-300 dark:border-rose-900",
      )}
    >
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {sub && (
        <CardContent>
          <p className="text-muted-foreground text-xs">{sub}</p>
        </CardContent>
      )}
    </Card>
  );
}
