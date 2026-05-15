import { CheckCircle2, FileSpreadsheet, UploadCloud } from "lucide-react";

import { RoleGate } from "@/components/app/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SHEETS = [
  { name: "Monthly", rows: 988, columns: ["Apartment", "Unit", "Landlord", "Client", "Tenant", "Introducer", "Handler", "Rent (LKR/USD)", "Status", "Start/End", "Deposit", "24× Payment N (date+0/1)", "Contacts"] },
  { name: "Quarterly", rows: 1000, columns: ["Apartment", "Unit", "Landlord", "Client", "Tenant", "Introducer", "Rent", "Status", "Start/End", "Deposit", "8× Payment N", "Contacts"] },
  { name: "Bi-Annual", rows: 999, columns: ["Apartment", "Unit", "Landlord", "Client", "Tenant", "Introducer", "Rent", "Status", "Start/End", "Deposit", "4× Payment N", "Contacts"] },
  { name: "Introducer", rows: 999, columns: ["Apartment", "Unit", "Landlord", "Client", "Tenant", "Introducer", "Rent", "Status", "Start/End", "Deposit", "8× Payment N", "Contacts"] },
  { name: "SD", rows: 1010, columns: ["Apartment", "Unit", "Landlord", "Client", "Tenant", "Introducer", "Rent", "Status", "Start/End", "8× Payment N", "Mode", "Contacts"] },
];

export default function ImportPage() {
  return (
    <RoleGate required={["admin:import"]}>
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Import (XLSX)</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          One-shot legacy migration from <code className="font-mono">rentals-sheet.xlsx</code>.
          Excel serial dates decoded, parties auto-merged, rows linked to head leases.
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <UploadCloud className="size-10 text-muted-foreground" />
          <div className="max-w-md">
            <CardTitle className="text-base">Drop the workbook (or its CSV exports) here</CardTitle>
            <CardDescription className="mt-1">
              Or run <code className="font-mono">python3 docs/extract.py</code> locally and
              upload the resulting CSVs. The importer is dry-run by default.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Choose file
            </Button>
            <Button size="sm" disabled>
              Run dry-run
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detected sheets</CardTitle>
          <CardDescription>
            From the legacy <code className="font-mono">rentals-sheet.xlsx</code>. Five tabs map to
            distinct payment cadences.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {SHEETS.map((s) => (
            <div key={s.name} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="size-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{s.name}</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {s.rows} rows
                  </Badge>
                </div>
              </div>
              <div className="mt-2 text-muted-foreground text-xs">{s.columns.join(" · ")}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pre-flight checks</CardTitle>
          <CardDescription>
            What the dry-run will validate before any rows land.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            "Decode every Excel serial date via excelSerialToDate()",
            "Detect cadence from sheet name (Monthly / Quarterly / Bi-Annual)",
            "Auto-merge parties on (display_name + email) — manual queue for ambiguous matches",
            "Link sub-leases to the Lucky Seven head lease where applicable",
            "Snapshot the raw row JSON into lease.import_meta for audit",
            "Skip rows with missing Apartment + Unit + Tenant (#REF! handling)",
            "Output import_report.csv with imports, skips, manual-merge queue",
          ].map((line) => (
            <div key={line} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{line}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
    </RoleGate>
  );
}
