"use client";

import { useSubmission } from "@/hooks/use-submission";

/**
 * One value cell of the lease details list.
 *
 * Outside edit mode it renders its children — the formatted display value —
 * untouched. Inside edit mode (see `use-lease-edit.ts`) it becomes the right
 * control for the field and **saves on change, per field**:
 *
 *   select / currency / unit toggle → saved the moment the value changes
 *   date / number / text / textarea → saved on blur or Enter (Esc restores)
 *
 * There is no draft buffer and no Save button. A cell declares two things:
 *
 *   `control` — what to render and the value it starts from
 *   `save`    — where the value goes (the lease, its clause bag, one rent
 *               tranche, the lease's unit set or role assignments, or the
 *               shared party / property record)
 *
 * Both halves are plain data so the server component that builds the details
 * list can construct them and pass them across the RSC boundary. Every patch
 * is re-validated by a `.strict()` zod schema in the server action.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type {
  LeaseClausesPatch,
  LeaseUpdateInput,
  PartyUpdateInput,
  PropertyUpdateInput,
  TrancheUpdateInput,
} from "@/core/services";
import type {
  Currency,
  LeaseClauses,
  LeasePartyRole,
  Money,
  PartyRole,
} from "@/core/types";
import { cn } from "@/lib/utils";
import {
  updateLeaseAction,
  updateLeaseTrancheAction,
  updatePartyAction,
  updatePropertyAction,
} from "@/server/actions";

import type { EditableOption } from "./lease-field-options";
import { useLeaseEditing } from "./use-lease-edit";

const NONE = "__none__" as const;

/** Lease columns a cell may patch — the relations have their own save targets. */
type LeaseScalarField = Exclude<
  keyof LeaseUpdateInput,
  "clauses" | "unitIds" | "additionalRoles"
>;
type PartyField =
  | "displayName"
  | "legalName"
  | "nicOrPassport"
  | "companyRegNo"
  | "address";
type PropertyField = "name" | "addressLine" | "city" | "district";

/** What the cell renders, and the value it starts from. */
export type LeaseFieldControl =
  | { kind: "money"; value: Money | null }
  | { kind: "date"; value: string | null; required?: boolean }
  | { kind: "int"; value: number | null; unit?: string; min?: number }
  | { kind: "decimal"; value: number | null; unit?: string }
  | { kind: "text"; value: string | null; required?: boolean; wide?: boolean }
  | { kind: "textarea"; value: string | null }
  | {
      kind: "select";
      value: string | null;
      options: EditableOption[];
      /** Adds a "—" entry that clears the field. */
      clearable?: boolean;
    }
  | { kind: "multi"; value: string[]; options: EditableOption[] };

/** Where the value goes. */
export type LeaseFieldSave =
  | { on: "lease"; field: LeaseScalarField }
  | { on: "clause"; field: keyof LeaseClauses }
  | { on: "party"; partyId: string; field: PartyField }
  | { on: "property"; propertyId: string; field: PropertyField }
  | { on: "tranche"; trancheId: string }
  | { on: "units" }
  | { on: "role"; role: PartyRole; currentRoles: LeasePartyRole[] };

export type LeaseFieldSpec = {
  control: LeaseFieldControl;
  save: LeaseFieldSave;
};

// ─── draft state ───

type Draft = {
  text: string;
  currency: Currency;
  select: string;
  values: string[];
};

function draftFor(control: LeaseFieldControl): Draft {
  const base: Draft = { text: "", currency: "LKR", select: "", values: [] };
  switch (control.kind) {
    case "money":
      return {
        ...base,
        text: control.value ? String(control.value.amount) : "",
        currency: control.value?.currency ?? "LKR",
      };
    case "date":
    case "text":
    case "textarea":
      return { ...base, text: control.value ?? "" };
    case "int":
    case "decimal":
      return { ...base, text: control.value != null ? String(control.value) : "" };
    case "select":
      return { ...base, select: control.value ?? NONE };
    case "multi":
      return { ...base, values: [...control.value] };
  }
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.text.trim() === b.text.trim() &&
    a.currency === b.currency &&
    a.select === b.select &&
    a.values.length === b.values.length &&
    a.values.every((v, i) => v === b.values[i])
  );
}

/** The normalised value a control produces, ready to be written. */
type FieldValue =
  | { of: "money"; value: Money | null }
  | { of: "text"; value: string | null }
  | { of: "number"; value: number | null }
  | { of: "list"; value: string[] };

function readDraft(
  control: LeaseFieldControl,
  draft: Draft,
): { value: FieldValue } | { error: string } {
  switch (control.kind) {
    case "money": {
      const raw = draft.text.replace(/,/g, "").trim();
      if (!raw) return { value: { of: "money", value: null } };
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return { error: "Enter a valid amount." };
      return {
        value: { of: "money", value: { amount: Math.round(n), currency: draft.currency } },
      };
    }
    case "date": {
      if (!draft.text) {
        if (control.required) return { error: "This date is required." };
        return { value: { of: "text", value: null } };
      }
      return { value: { of: "text", value: draft.text } };
    }
    case "text":
    case "textarea": {
      const trimmed = draft.text.trim();
      if (!trimmed) {
        if (control.kind === "text" && control.required) {
          return { error: "This field can't be empty." };
        }
        return { value: { of: "text", value: null } };
      }
      return { value: { of: "text", value: trimmed } };
    }
    case "int": {
      const raw = draft.text.trim();
      if (!raw) return { value: { of: "number", value: null } };
      const n = Number(raw);
      const min = control.min ?? 0;
      if (!Number.isInteger(n) || n < min) {
        return { error: `Enter a whole number of ${min} or more.` };
      }
      return { value: { of: "number", value: n } };
    }
    case "decimal": {
      const raw = draft.text.replace(/,/g, "").trim();
      if (!raw) return { value: { of: "number", value: null } };
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return { error: "Enter a valid number." };
      return { value: { of: "number", value: n } };
    }
    case "select": {
      if (draft.select === NONE || draft.select === "") {
        if (!control.clearable) return { error: "Pick a value." };
        return { value: { of: "text", value: null } };
      }
      return { value: { of: "text", value: draft.select } };
    }
    case "multi":
      return { value: { of: "list", value: draft.values } };
  }
}

// ─── writing ───

type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * The value of a patch key. Server actions re-parse every patch with a
 * `.strict()` zod schema, so an unknown key or a wrong value shape is
 * rejected at the boundary.
 */
function patchValue(value: FieldValue): Money | string | number | string[] | null {
  return value.value;
}

async function persist(
  leaseId: string,
  save: LeaseFieldSave,
  value: FieldValue,
): Promise<SaveResult> {
  switch (save.on) {
    case "lease": {
      const patch: LeaseUpdateInput = {};
      Object.assign(patch, { [save.field]: patchValue(value) });
      return updateLeaseAction(leaseId, patch);
    }
    case "clause": {
      const clauses: LeaseClausesPatch = {};
      Object.assign(clauses, { [save.field]: patchValue(value) });
      return updateLeaseAction(leaseId, { clauses });
    }
    case "party": {
      const patch: PartyUpdateInput = {};
      Object.assign(patch, { [save.field]: patchValue(value) });
      return updatePartyAction(save.partyId, patch);
    }
    case "property": {
      const patch: PropertyUpdateInput = {};
      Object.assign(patch, { [save.field]: patchValue(value) });
      return updatePropertyAction(save.propertyId, patch);
    }
    case "tranche": {
      if (value.of !== "money" || value.value === null) {
        return { ok: false, error: "Monthly rent is required." };
      }
      const patch: TrancheUpdateInput = { monthlyRent: value.value };
      return updateLeaseTrancheAction(leaseId, save.trancheId, patch);
    }
    case "units": {
      if (value.of !== "list") return { ok: false, error: "Pick at least one unit." };
      return updateLeaseAction(leaseId, { unitIds: value.value });
    }
    case "role": {
      const partyId = value.of === "text" ? value.value : null;
      const rest = save.currentRoles.filter((r) => r.role !== save.role);
      const next: LeasePartyRole[] = partyId
        ? [...rest, { partyId, role: save.role }]
        : rest;
      return updateLeaseAction(leaseId, { additionalRoles: next });
    }
  }
}

/**
 * Renders `children` (the formatted display value) until the lease is in edit
 * mode, then swaps in the field's control.
 */
export function LeaseFieldCell({
  leaseId,
  label,
  field,
  children,
  className,
}: {
  leaseId: string;
  /** Human name of the field — used for the control's accessible name. */
  label: string;
  field: LeaseFieldSpec;
  children: ReactNode;
  className?: string;
}) {
  const editing = useLeaseEditing(leaseId);
  if (!editing) return <>{children}</>;
  return (
    <LeaseFieldControlView
      leaseId={leaseId}
      label={label}
      field={field}
      className={className}
    />
  );
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function LeaseFieldControlView({
  leaseId,
  label,
  field,
  className,
}: {
  leaseId: string;
  label: string;
  field: LeaseFieldSpec;
  className?: string;
}) {
  const { control, save } = field;
  const router = useRouter();
  const { run } = useSubmission();
  const server = draftFor(control);
  const [draft, setDraft] = useState<Draft>(server);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // Value last accepted by the server — commits that match it are no-ops, so
  // a blur straight after a change-commit doesn't fire a second write.
  const baseline = useRef<Draft>(server);
  const focused = useRef(false);

  // Re-sync when the server value changes underneath us (any field's save
  // triggers router.refresh, which re-renders every cell) — but never while
  // the operator is mid-edit in this one.
  const serverKey = JSON.stringify(server);
  useEffect(() => {
    if (focused.current) return;
    const next: Draft = JSON.parse(serverKey);
    baseline.current = next;
    setDraft(next);
  }, [serverKey]);

  // "Saved" is a transient acknowledgement, not a state.
  useEffect(() => {
    if (status !== "saved") return;
    const t = window.setTimeout(() => setStatus("idle"), 2000);
    return () => window.clearTimeout(t);
  }, [status]);

  const commit = (next: Draft) => {
    if (sameDraft(next, baseline.current)) {
      setError(null);
      return;
    }
    const read = readDraft(control, next);
    if ("error" in read) {
      setStatus("error");
      setError(read.error);
      return;
    }
    void run(async () => {
      baseline.current = next;
      setStatus("saving");
      setError(null);
      let res;
      try { res = await persist(leaseId, save, read.value); }
      catch (error) { res = { ok: false as const, error: error instanceof Error ? error.message : "Please try again." }; }
      if (!res.ok) {
        baseline.current = draftFor(control);
        setDraft(draftFor(control));
        setStatus("error");
        setError(res.error);
        toast.error(`Couldn't update ${label}`, { description: res.error });
        return;
      }
      setStatus("saved");
      router.refresh();
    });
  };

  const revert = () => {
    setDraft(baseline.current);
    setStatus("idle");
    setError(null);
  };

  const disabled = status === "saving";

  const typedProps = {
    value: draft.text,
    disabled,
    "aria-label": label,
    "aria-invalid": status === "error" || undefined,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      commit(draft);
    },
  };

  const keyHandler = (e: React.KeyboardEvent, multiline = false) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      commit(draft);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      revert();
    }
  };

  return (
    <span className={cn("flex flex-col gap-1", className)}>
      <span className="flex flex-wrap items-center gap-1.5">
        {control.kind === "money" && (
          <>
            <Input
              {...typedProps}
              type="number"
              min={0}
              step={1}
              placeholder="Blank to clear"
              className="w-36 tabular-nums"
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              onKeyDown={(e) => keyHandler(e)}
            />
            <Select
              value={draft.currency}
              disabled={disabled}
              onValueChange={(v) => {
                const next = { ...draft, currency: v === "USD" ? "USD" : "LKR" } as Draft;
                setDraft(next);
                commit(next);
              }}
            >
              <SelectTrigger size="sm" className="w-20" aria-label={`${label} currency`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LKR">LKR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}

        {control.kind === "date" && (
          <Input
            {...typedProps}
            type="date"
            className="w-40 tabular-nums"
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            onKeyDown={(e) => keyHandler(e)}
          />
        )}

        {(control.kind === "int" || control.kind === "decimal") && (
          <>
            <Input
              {...typedProps}
              type="number"
              min={control.kind === "int" ? (control.min ?? 0) : 0}
              step={control.kind === "int" ? 1 : "any"}
              placeholder="—"
              className="w-28 tabular-nums"
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              onKeyDown={(e) => keyHandler(e)}
            />
            {control.unit && (
              <span className="text-muted-foreground text-xs">{control.unit}</span>
            )}
          </>
        )}

        {control.kind === "text" && (
          <Input
            {...typedProps}
            type="text"
            placeholder="—"
            className={control.wide ? "w-full min-w-64" : "w-64"}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            onKeyDown={(e) => keyHandler(e)}
          />
        )}

        {control.kind === "textarea" && (
          <Textarea
            {...typedProps}
            rows={4}
            placeholder="—"
            className="w-full min-w-64"
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            onKeyDown={(e) => keyHandler(e, true)}
          />
        )}

        {control.kind === "select" && (
          <Select
            value={draft.select}
            disabled={disabled}
            onValueChange={(v) => {
              const next = { ...draft, select: v };
              setDraft(next);
              commit(next);
            }}
          >
            <SelectTrigger size="sm" className="min-w-48 capitalize" aria-label={label}>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {(control.clearable
                ? [{ value: NONE, label: "—" }, ...control.options]
                : control.options
              ).map((o) => (
                <SelectItem key={o.value} value={o.value} className="capitalize">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {control.kind === "multi" && (
          <MultiPicker
            label={label}
            options={control.options}
            selected={draft.values}
            disabled={disabled}
            onToggle={(value, on) => {
              const values = on
                ? [...draft.values, value]
                : draft.values.filter((v) => v !== value);
              const next = { ...draft, values };
              setDraft(next);
              commit(next);
            }}
          />
        )}

        <SaveIndicator status={status} />
      </span>
      {error && <span className="text-destructive text-xs">{error}</span>}
      {control.kind === "textarea" && !error && (
        <span className="text-muted-foreground text-[11px]">
          Saves when you click away.
        </span>
      )}
    </span>
  );
}

function MultiPicker({
  label,
  options,
  selected,
  disabled,
  onToggle,
}: {
  label: string;
  options: EditableOption[];
  selected: string[];
  disabled: boolean;
  onToggle: (value: string, on: boolean) => void;
}) {
  const chosen = options.filter((o) => selected.includes(o.value));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={label}
          className="min-w-48 justify-between font-normal"
        >
          <span className="truncate">
            {chosen.length ? chosen.map((o) => o.label).join(", ") : "—"}
          </span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {options.length === 0 && (
            <span className="px-2 py-1.5 text-muted-foreground text-sm">
              No units on this property.
            </span>
          )}
          {options.map((o) => {
            const id = `${label}-${o.value}`;
            const on = selected.includes(o.value);
            return (
              <div key={o.value} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                <Checkbox
                  id={id}
                  checked={on}
                  onCheckedChange={(v) => onToggle(o.value, v === true)}
                />
                <Label htmlFor={id} className="font-normal text-sm">
                  {o.label}
                </Label>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-muted-foreground text-xs">
        <Spinner className="size-3.5" /> Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-primary text-xs">
        <Check className="size-3.5" /> Saved
      </span>
    );
  }
  return null;
}
