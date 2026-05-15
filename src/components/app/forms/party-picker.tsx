"use client";

import { useMemo, useState } from "react";

import { Building, ChevronsUpDown, Plus, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Party } from "@/core/types";
import type { DraftParty } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

import { NewPartyButton } from "./new-party-button";

export function PartyPicker({
  value,
  onChange,
  parties,
  draftParties,
  placeholder = "Search and pick a party",
  emptyHint = "No matching party. Try “Add a new party” below.",
  defaultKind,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  parties: Party[];
  draftParties: DraftParty[];
  placeholder?: string;
  emptyHint?: string;
  defaultKind?: "individual" | "company";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const selected = useMemo(() => {
    return (
      parties.find((p) => p.id === value) ??
      draftParties.find((p) => p.id === value)
    );
  }, [parties, draftParties, value]);

  const selectedLabel = selected
    ? "displayName" in selected
      ? selected.displayName
      : ""
    : "";
  const selectedKind = selected?.kind;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground",
              className,
            )}
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              {selectedKind === "company" ? (
                <Building className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <User className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{selected ? selectedLabel : placeholder}</span>
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command>
            <CommandInput placeholder="Search parties…" />
            <CommandList>
              <CommandEmpty>{emptyHint}</CommandEmpty>
              {parties.length > 0 && (
                <CommandGroup heading="Parties">
                  {parties.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.displayName} ${p.legalName ?? ""} ${(p.emails ?? []).join(" ")}`}
                      onSelect={() => {
                        onChange(p.id);
                        setOpen(false);
                      }}
                      data-checked={value === p.id}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {p.displayName}
                          <span className="ml-1 font-normal text-muted-foreground text-xs">
                            · {p.kind}
                          </span>
                        </span>
                        {(p.legalName || (p.emails && p.emails.length > 0)) && (
                          <span className="truncate text-muted-foreground text-xs">
                            {p.legalName ?? p.emails?.[0]}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {draftParties.length > 0 && (
                <CommandGroup heading="Added this session">
                  {draftParties.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.displayName} ${p.legalName ?? ""} ${p.emails.join(" ")}`}
                      onSelect={() => {
                        onChange(p.id);
                        setOpen(false);
                      }}
                      data-checked={value === p.id}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {p.displayName}
                          <span className="ml-1 font-normal text-muted-foreground text-xs">
                            · {p.kind}
                          </span>
                        </span>
                        {(p.legalName || p.emails[0]) && (
                          <span className="truncate text-muted-foreground text-xs">
                            {p.legalName ?? p.emails[0]}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="__add-new-party__"
                  onSelect={() => {
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                  className="text-primary data-selected:text-primary"
                >
                  <Plus className="size-4" />
                  <span>Add a new party…</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <NewPartyButton
        open={createOpen}
        onOpenChange={setCreateOpen}
        hideTrigger
        defaultKind={defaultKind}
        onCreated={(draft) => onChange(draft.id)}
      />
    </>
  );
}
