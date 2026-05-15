"use client";

import { useMemo, useState } from "react";

import { Building2, ChevronsUpDown, Plus } from "lucide-react";

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
import type { Property } from "@/core/types";
import type { DraftProperty } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

import { NewPropertyButton } from "./new-property-button";

export function PropertyPicker({
  value,
  onChange,
  properties,
  draftProperties,
  placeholder = "Search and pick a property",
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  properties: Property[];
  draftProperties: DraftProperty[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const selected = useMemo(() => {
    return (
      properties.find((p) => p.id === value) ??
      draftProperties.find((p) => p.id === value)
    );
  }, [properties, draftProperties, value]);

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
              <Building2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{selected ? selected.name : placeholder}</span>
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command>
            <CommandInput placeholder="Search properties…" />
            <CommandList>
              <CommandEmpty>
                No matching property. Try “Add a new property” below.
              </CommandEmpty>
              {properties.length > 0 && (
                <CommandGroup heading="Properties">
                  {properties.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.name} ${p.addressLine}`}
                      onSelect={() => {
                        onChange(p.id);
                        setOpen(false);
                      }}
                      data-checked={value === p.id}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{p.name}</span>
                        <span className="truncate text-muted-foreground text-xs">
                          {p.addressLine}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {draftProperties.length > 0 && (
                <CommandGroup heading="Added this session">
                  {draftProperties.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.name} ${p.addressLine}`}
                      onSelect={() => {
                        onChange(p.id);
                        setOpen(false);
                      }}
                      data-checked={value === p.id}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{p.name}</span>
                        <span className="truncate text-muted-foreground text-xs">
                          {p.addressLine} · {p.city}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="__add-new-property__"
                  onSelect={() => {
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                  className="text-primary data-selected:text-primary"
                >
                  <Plus className="size-4" />
                  <span>Add a new property…</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <NewPropertyButton
        open={createOpen}
        onOpenChange={setCreateOpen}
        hideTrigger
        onCreated={(draft) => onChange(draft.id)}
      />
    </>
  );
}
