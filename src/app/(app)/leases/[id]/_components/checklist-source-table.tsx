"use client";

import { useState } from "react";
import { Info, Waypoints } from "lucide-react";
import type { ChecklistMapping, SavedChecklist } from "@/core/checklists";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function columnLabel(index: number): string {
  let label = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
  return label;
}

const STATUS: Record<ChecklistMapping["status"], string> = {
  mapped: "Mapped", partial: "Partly mapped", unmapped: "Not mapped", blank: "Blank", heading: "Header", duplicate: "Duplicate",
};

export function ChecklistSourceTable({ checklist }: { checklist: SavedChecklist }) {
  const [sheetIndex, setSheetIndex] = useState(checklist.source.importSheetIndex);
  const [showMapping, setShowMapping] = useState(false);
  const sheet = checklist.source.sheets[sheetIndex];
  const columns = Math.max(1, ...sheet.rows.map((row) => row.length));
  const mappingByRow = new Map(checklist.mappings.filter((item) => item.sheet === sheetIndex).map((item) => [item.row, item]));
  // Merge coordinates refer to source columns; the row-number and mapping
  // gutters are outside that grid and never change the source cell positions.
  const covered = new Set<string>();
  const anchors = new Map<string, (typeof sheet.merges)[number]>();
  for (const merge of sheet.merges) {
    anchors.set(`${merge.startRow}:${merge.startColumn}`, merge);
    for (let r = merge.startRow; r <= merge.endRow; r++) for (let c = merge.startColumn; c <= merge.endColumn; c++) {
      if (r !== merge.startRow || c !== merge.startColumn) covered.add(`${r}:${c}`);
    }
  }

  return <Card>
    <CardHeader className="gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CardTitle>Original checklist</CardTitle>
          <CardDescription className="break-words">{checklist.source.fileName}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground" aria-pressed={showMapping} onClick={() => setShowMapping((value) => !value)}>
          <Waypoints className="size-3.5" />{showMapping ? "Hide mapping" : "Show mapping"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Original cell values and order. Editing the agreement does not change this checklist.</p>
      {showMapping && <p className="text-xs text-muted-foreground">
        {checklist.mode === "attached"
          ? "Mapping preview only: this original was attached later. These are the current parser’s proposed mappings; attaching it did not update any agreement fields."
          : "Mapping captured at import. Open a row’s details to see parsed destinations and values; these do not reflect later edits."}
      </p>}
      {checklist.source.sheets.length > 1 && <div className="flex flex-wrap gap-1" role="group" aria-label="Checklist worksheets">
        {checklist.source.sheets.map((item, index) => <Button key={index} size="sm" variant={index === sheetIndex ? "secondary" : "ghost"} aria-pressed={index === sheetIndex} onClick={() => setSheetIndex(index)}>{item.name}</Button>)}
      </div>}
    </CardHeader>
    <CardContent className="px-0">
      <Table className="w-max min-w-full border-collapse" aria-label={`${sheet.name} original checklist`}>
        <TableHeader><TableRow className="bg-muted/40">
          <TableHead className="w-10 text-center text-xs text-muted-foreground"><span className="sr-only">Row</span></TableHead>
          {showMapping && <TableHead scope="col" className="border-l text-xs">{checklist.mode === "attached" ? "Mapping preview" : "Import mapping"}</TableHead>}
          {Array.from({ length: columns }, (_, column) => <TableHead key={column} scope="col" className="border-l text-center font-mono text-xs text-muted-foreground">{columnLabel(column)}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>
          {sheet.rows.map((row, rowIndex) => {
            const mapping = mappingByRow.get(rowIndex);
            return <TableRow key={rowIndex} className="align-top">
              <TableHead scope="row" className="h-8 px-2 text-center align-top font-mono text-xs text-muted-foreground">{rowIndex + 1}</TableHead>
              {showMapping && <TableCell className="border-l align-top">
                {mapping && <Popover><PopoverTrigger asChild>
                  <Button variant="ghost" size="xs" className="text-muted-foreground" aria-label={`Mapping for row ${rowIndex + 1}: ${STATUS[mapping.status]}`}>
                    <Info className="size-3" />{STATUS[mapping.status]}
                  </Button>
                </PopoverTrigger><PopoverContent className="w-96 max-w-[90vw] space-y-3" align="end">
                  <p className="text-sm font-medium">Row {rowIndex + 1} · {STATUS[mapping.status]}</p>
                  <p className="text-xs text-muted-foreground">{mapping.explanation}</p>
                  {mapping.targets.map((target, index) => <div key={index} className="space-y-1 border-t pt-2">
                    <code className="break-all text-xs">{target.field}</code>
                    <p className="whitespace-pre-wrap break-words text-xs">{target.value}</p>
                  </div>)}
                </PopoverContent></Popover>}
              </TableCell>}
              {Array.from({ length: columns }, (_, column) => {
                if (covered.has(`${rowIndex}:${column}`)) return null;
                const merge = anchors.get(`${rowIndex}:${column}`);
                return <TableCell key={column}
                  colSpan={merge ? merge.endColumn - merge.startColumn + 1 : undefined}
                  rowSpan={merge ? merge.endRow - merge.startRow + 1 : undefined}
                  className="min-w-20 max-w-xl border-l align-top whitespace-pre-wrap break-words"
                  data-source-cell={`${columnLabel(column)}${rowIndex + 1}`}>
                  {row[column] ?? ""}
                </TableCell>;
              })}

            </TableRow>;
          })}
        </TableBody>
      </Table>
      {sheet.rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">This worksheet is empty.</p>}
    </CardContent>
  </Card>;
}
