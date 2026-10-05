"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSubmission } from "@/hooks/use-submission";

import { Plus } from "lucide-react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
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
import type { Party } from "@/core/types";
import { createPartyAction } from "@/server/actions";

const schema = z.object({
  kind: z.enum(["individual", "company"]),
  displayName: z.string().min(2, "Required"),
  legalName: z.string().optional(),
  nicOrPassport: z.string().optional(),
  companyRegNo: z.string().optional(),
  emails: z.string().optional(),
  phones: z.string().optional(),
  notes: z.string().optional(),
});

type Values = z.infer<typeof schema>;

function splitList(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function NewPartyButton({
  open: openProp,
  onOpenChange,
  trigger,
  hideTrigger = false,
  onCreated,
  defaultKind = "individual",
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  hideTrigger?: boolean;
  onCreated?: (party: Party) => void;
  defaultKind?: "individual" | "company";
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
    defaultValues: {
      kind: defaultKind,
      displayName: "",
      legalName: "",
      nicOrPassport: "",
      companyRegNo: "",
      emails: "",
      phones: "",
      notes: "",
    },
  });

  const kind = useWatch({ control: form.control, name: "kind" });

  function onSubmit(values: Values) {
    return run(async () => {
      const result = await createPartyAction({
        kind: values.kind,
        displayName: values.displayName,
        legalName: values.legalName || undefined,
        nicOrPassport: values.nicOrPassport || undefined,
        companyRegNo: values.companyRegNo || undefined,
        emails: splitList(values.emails),
        phones: splitList(values.phones),
        notes: values.notes || undefined,
      });
      if (!result.ok) {
        toast.error("Could not add party", { description: result.error });
        return;
      }
      toast.success("Party added", {
        description: `${result.data.displayName} is now in your directory.`,
      });
      form.reset({
        kind: defaultKind,
        displayName: "",
        legalName: "",
        nicOrPassport: "",
        companyRegNo: "",
        emails: "",
        phones: "",
        notes: "",
      });
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
              <Plus className="size-4" /> New party
            </Button>
          )}
        </SheetTrigger>
      )}
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add a party</SheetTitle>
          <SheetDescription>
            Landlords, tenants, lessees, introducers, lawyers, handlers — same
            directory, different roles per lease.
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
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kind</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        kind === "company" ? "Capital Trust Holdings" : "Y.S.H. Sunil Malcom Silva"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {kind === "company" ? (
              <>
                <FormField
                  control={form.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal name (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="… Limited" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="companyRegNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company reg no.</FormLabel>
                      <FormControl>
                        <Input placeholder="PV 75497PB" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <FormField
                control={form.control}
                name="nicOrPassport"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NIC / passport</FormLabel>
                    <FormControl>
                      <Input placeholder="56188258V" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="emails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emails</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="comma- or semicolon-separated"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phones</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+94 ... · comma-separated"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SheetFooter className="px-0 pt-4">
              <Button type="submit" disabled={pending || form.formState.isSubmitting}>
                {pending ? "Adding…" : "Add party"}
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
