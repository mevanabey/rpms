import Link from "next/link";

import { ExternalLink } from "lucide-react";

import { VaultOverview } from "./_components/vault-overview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SOURCE_DOCS = [
  { name: "CamScanner-04-09-2026 11.47.pdf", purpose: "Signed Lucky Seven head lease (anchor)", path: "docs/" },
  { name: "latest-draft-lease.VI  6.04.2026-S.docx", purpose: "Editable draft of the same lease", path: "docs/" },
  { name: "check-list-lucky-seven.xlsx", purpose: "Lawyer/handler intake checklist", path: "docs/" },
  { name: "rentals-sheet.xlsx", purpose: "Legacy operational workbook (~300 rows)", path: "docs/" },
];

export default function DocumentsPage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Documents</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Versioned vault for drafts, signed leases, KYC, invoices, receipts, notices.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled>
          Upload
        </Button>
      </div>

      <VaultOverview />

      <Card>
        <CardHeader>
          <CardTitle>Source documents</CardTitle>
          <CardDescription>
            Files in <code className="font-mono">docs/</code> drive the spec and the importer.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {SOURCE_DOCS.map((d) => (
            <div key={d.name} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {d.path}
                  </Badge>
                  <span className="font-medium text-sm">{d.name}</span>
                </div>
                <div className="mt-1 text-muted-foreground text-xs">{d.purpose}</div>
              </div>
              <Link
                href="/admin/import"
                className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
              >
                <ExternalLink className="size-3" />
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
