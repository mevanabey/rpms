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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Property } from "@/core/types";
import { createPropertyAction } from "@/server/actions";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  addressLine: z.string().min(2, "Address is required"),
  city: z.string().min(2, "City is required"),
  lotNo: z.string().optional(),
  planNo: z.string().optional(),
  perches: z.coerce.number().nonnegative().optional(),
  asstNo: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function NewPropertyButton({
  open: openProp,
  onOpenChange,
  trigger,
  hideTrigger = false,
  onCreated,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  hideTrigger?: boolean;
  onCreated?: (property: Property) => void;
} = {}) {
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
    defaultValues: { name: "", addressLine: "", city: "Colombo" },
  });

  function onSubmit(values: Values) {
    return run(async () => {
      const result = await createPropertyAction({
        name: values.name,
        addressLine: values.addressLine,
        city: values.city,
        lotNo: values.lotNo || undefined,
        planNo: values.planNo || undefined,
        perches: values.perches,
        asstNo: values.asstNo || undefined,
      });
      if (!result.ok) {
        toast.error("Could not add property", { description: result.error });
        return;
      }
      toast.success("Property added", {
        description: `${result.data.name} is now in your directory.`,
      });
      form.reset({ name: "", addressLine: "", city: "Colombo" });
      onCreated?.(result.data);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
      {!hideTrigger && (
        <SheetTrigger asChild>
          {trigger ?? (
            <Button size="sm">
              <Plus className="size-4" /> New property
            </Button>
          )}
        </SheetTrigger>
      )}
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add a property</SheetTitle>
          <SheetDescription>
            A property is one building. Units are added separately.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            aria-busy={pending || form.formState.isSubmitting}
            className="flex flex-col gap-4 px-4 pb-4"
          >
            <fieldset disabled={pending || form.formState.isSubmitting} className="contents">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Building name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Lucky Seven" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="addressLine"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="No. 314, R.A. De Mel Mawatha, Kollupitiya"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="lotNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lot no.</FormLabel>
                    <FormControl>
                      <Input placeholder="Lot R" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="planNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan no.</FormLabel>
                    <FormControl>
                      <Input placeholder="6434" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="perches"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perches</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="asstNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asst no.</FormLabel>
                    <FormControl>
                      <Input placeholder="314" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <SheetFooter className="px-0 pt-4">
              <Button type="submit" disabled={pending || form.formState.isSubmitting}>
                {pending ? "Adding…" : "Add property"}
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
