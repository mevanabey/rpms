"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSubmission } from "@/hooks/use-submission";

import { Plus } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Property, Unit } from "@/core/types";
import { createUnitAction } from "@/server/actions";

const schema = z.object({
  propertyId: z.string().min(1, "Pick a property"),
  label: z.string().min(1, "Label is required"),
  type: z.enum(["office", "apartment", "storage", "penthouse", "floor"]),
  floor: z.string().optional(),
  areaSqft: z.coerce.number().nonnegative().optional(),
  bedrooms: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(["vacant", "occupied", "reserved"]),
});

type Values = z.infer<typeof schema>;

export function NewUnitButton({
  properties,
  defaultPropertyId,
  lockProperty = false,
  open: openProp,
  onOpenChange,
  trigger,
  hideTrigger = false,
  onCreated,
}: {
  properties: Property[];
  defaultPropertyId?: string;
  /** When true, the property select is hidden — the form locks to defaultPropertyId. */
  lockProperty?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  hideTrigger?: boolean;
  onCreated?: (unit: Unit) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { pending, run } = useSubmission();
  const router = useRouter();
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp! : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      propertyId: defaultPropertyId ?? properties[0]?.id ?? "",
      label: "",
      type: "apartment",
      status: "vacant",
    },
  });

  function onSubmit(values: Values) {
    return run(async () => {
      const result = await createUnitAction({
        propertyId: values.propertyId,
        label: values.label,
        type: values.type,
        floor: values.floor || undefined,
        areaSqft: values.areaSqft,
        bedrooms: values.bedrooms,
        status: values.status,
      });
      if (!result.ok) {
        toast.error("Could not add unit", { description: result.error });
        return;
      }
      const propertyName =
        properties.find((p) => p.id === values.propertyId)?.name ?? values.propertyId;
      toast.success("Unit added", {
        description: `${propertyName} now has a new unit "${result.data.label}".`,
      });
      form.reset({ ...form.getValues(), label: "" });
      onCreated?.(result.data);
      setOpen(false);
      router.refresh();
    });
  }

  const allProperties = properties;

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
      {!hideTrigger && (
        <SheetTrigger asChild>
          {trigger ?? (
            <Button size="sm">
              <Plus className="size-4" /> New unit
            </Button>
          )}
        </SheetTrigger>
      )}
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add a unit</SheetTitle>
          <SheetDescription>
            Floors, apartments, storage rooms, penthouses — anything leasable.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            aria-busy={pending || form.formState.isSubmitting}
            className="flex flex-col gap-4 px-4 pb-4"
          >
            <fieldset disabled={pending || form.formState.isSubmitting} className="contents">
            {lockProperty ? (
              <input type="hidden" {...form.register("propertyId")} />
            ) : (
              <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a property" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allProperties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit label</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. T2 30 B4A or Penthouse" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="apartment">Apartment</SelectItem>
                        <SelectItem value="storage">Storage</SelectItem>
                        <SelectItem value="penthouse">Penthouse</SelectItem>
                        <SelectItem value="floor">Floor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="vacant">Vacant</SelectItem>
                        <SelectItem value="occupied">Occupied</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="floor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Floor</FormLabel>
                    <FormControl>
                      <Input placeholder="3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="areaSqft"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area (sqft)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bedrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bedrooms</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <SheetFooter className="px-0 pt-4">
              <Button type="submit" disabled={pending || form.formState.isSubmitting}>
                {pending ? "Adding…" : "Add unit"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
            </SheetFooter>
            </fieldset>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
