"use client";

import { useMemo } from "react";

import { NewUnitButton } from "@/components/app/forms/new-unit-button";
import { SectionHeader } from "@/components/app/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Property, Unit } from "@/core/types";
import { useDraftUnits } from "@/lib/demo/use-store";

export function PropertyUnitsSection({
  property,
  units,
  properties,
}: {
  property: Property;
  units: Unit[];
  properties: Property[];
}) {
  const draftUnits = useDraftUnits();
  const merged = useMemo<Unit[]>(() => {
    const scopedDrafts = (draftUnits as unknown as Unit[]).filter(
      (u) => u.propertyId === property.id,
    );
    return [...units, ...scopedDrafts];
  }, [units, draftUnits, property.id]);

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title="Units"
        description={`${merged.length} unit(s) on this property.`}
        actions={
          <NewUnitButton
            properties={properties}
            defaultPropertyId={property.id}
            lockProperty
          />
        }
      />
      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead className="text-right">Area (sqft)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {merged.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground text-sm"
                  >
                    No units yet. Click “New unit” to add one.
                  </TableCell>
                </TableRow>
              )}
              {merged.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.label}</TableCell>
                  <TableCell>{u.type}</TableCell>
                  <TableCell>{u.floor ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {u.areaSqft ? u.areaSqft.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{u.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
