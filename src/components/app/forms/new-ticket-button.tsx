"use client";

import { useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import type { Property, Unit } from "@/core/types";
import { useDemoStore } from "@/lib/demo/store";

const schema = z.object({
  propertyId: z.string().min(1, "Pick a property"),
  unitId: z.string().optional(),
  title: z.string().min(2, "Required"),
  description: z.string().min(2, "Required"),
  category: z.enum([
    "plumbing",
    "electrical",
    "structural",
    "appliance",
    "lift",
    "generator",
    "fire",
    "cleaning",
    "other",
  ]),
  severity: z.enum(["low", "medium", "high", "urgent"]),
  reportedBy: z.string().optional(),
  costEstimateAmount: z.coerce.number().nonnegative().optional(),
  costEstimateCurrency: z.enum(["LKR", "USD"]).optional(),
});

type Values = z.infer<typeof schema>;

export function NewTicketButton({
  properties,
  units,
}: {
  properties: Property[];
  units: Unit[];
}) {
  const [open, setOpen] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      propertyId: properties[0]?.id ?? "",
      unitId: "",
      title: "",
      description: "",
      category: "plumbing",
      severity: "medium",
      reportedBy: "Capital Trust handler",
      costEstimateCurrency: "LKR",
    },
  });

  const propertyId = form.watch("propertyId");
  const propertyUnits = units.filter((u) => u.propertyId === propertyId);

  function onSubmit(values: Values) {
    const store = useDemoStore.getState();
    const ticket = store.addTicket({
      propertyId: values.propertyId,
      unitId: values.unitId || undefined,
      title: values.title,
      description: values.description,
      category: values.category,
      severity: values.severity,
      status: "open",
      reportedBy: values.reportedBy || undefined,
      costEstimate: values.costEstimateAmount
        ? {
            amount: values.costEstimateAmount,
            currency: values.costEstimateCurrency ?? "LKR",
          }
        : undefined,
      costCapApplies: values.category !== "lift" && values.category !== "generator" && values.category !== "fire",
    });
    // Activity log disabled — app simplified.
    // const propertyName =
    //   properties.find((p) => p.id === values.propertyId)?.name ?? values.propertyId;
    // store.pushActivity({
    //   workflow: "system",
    //   severity: values.severity === "urgent" ? "warning" : "info",
    //   title: `Ticket opened · ${propertyName}`,
    //   body: `${values.title} (${values.category}, ${values.severity}).`,
    // });
    toast.success("Ticket opened", {
      description: `Tracked at maintenance/${ticket.id.slice(-6)}.`,
    });
    form.reset();
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> New ticket
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New maintenance ticket</SheetTitle>
          <SheetDescription>
            One ticket per repair, request, or compliance item that needs vendor work.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4 px-4 pb-4"
          >
            <FormField
              control={form.control}
              name="propertyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {properties.map((p) => (
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
            <FormField
              control={form.control}
              name="unitId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit (optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Whole property" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Whole property</SelectItem>
                      {propertyUnits.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Kitchen sink leaking" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="What's wrong? What did the tenant say? Any photos?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="plumbing">Plumbing</SelectItem>
                        <SelectItem value="electrical">Electrical</SelectItem>
                        <SelectItem value="structural">Structural</SelectItem>
                        <SelectItem value="appliance">Appliance</SelectItem>
                        <SelectItem value="lift">Lift</SelectItem>
                        <SelectItem value="generator">Generator</SelectItem>
                        <SelectItem value="fire">Fire / safety</SelectItem>
                        <SelectItem value="cleaning">Cleaning</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="reportedBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reported by</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="costEstimateAmount"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Cost estimate (optional)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="costEstimateCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? "LKR"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="LKR">LKR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <SheetFooter className="px-0 pt-4">
              <Button type="submit">Open ticket</Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
