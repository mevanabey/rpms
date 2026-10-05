"use client";

import { useSubmission } from "@/hooks/use-submission";

import { useState } from "react";

import { Plus, ShieldPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ROLE_TONE_PRESETS,
  type Resource,
  type RoleDefinition,
  RESOURCE_GROUPS,
  DEFAULT_PERMISSIONS,
} from "@/lib/demo/identity";
import { useDemoStore } from "@/lib/demo/store";
import { usePermissions } from "@/lib/demo/use-store";
import { cn } from "@/lib/utils";

interface Props {
  /** When provided, the dialog edits an existing role. Otherwise it adds. */
  editing?: RoleDefinition;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function RoleFormDialog(props: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = props.open ?? internalOpen;
  return <RoleFormSession key={`${props.editing?.id ?? "new"}:${open}`} {...props} open={open} onOpenChange={props.onOpenChange ?? setInternalOpen} />;
}

function RoleFormSession({ editing, trigger, open, onOpenChange }: Props & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const isEdit = !!editing;
  const addRoleDef = useDemoStore((s) => s.addRoleDef);
  const updateRoleDef = useDemoStore((s) => s.updateRoleDef);
  const setPermission = useDemoStore((s) => s.setPermission);
  const permissions = usePermissions();

  const { pending, run } = useSubmission();
  const realOpen = open;
  const setOpen = onOpenChange;

  const [label, setLabel] = useState(editing?.label ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [tone, setTone] = useState(editing?.tone ?? ROLE_TONE_PRESETS[5].cls);
  const [perms, setPerms] = useState<Set<Resource>>(
    () =>
      new Set(
        editing
          ? permissions[editing.id] ?? []
          : DEFAULT_PERMISSIONS.viewer,
      ),
  );

  const togglePerm = (r: Resource) => {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(() => {
    if (!label.trim()) {
      toast.error("Role label is required");
      return;
    }
    if (isEdit && editing) {
      updateRoleDef(editing.id, { label: label.trim(), description: description.trim(), tone });
      // Replace permissions wholesale to match the dialog state.
      const next = Array.from(perms);
      const current = new Set(permissions[editing.id] ?? []);
      const newSet = new Set(next);
      // Diff and apply.
      for (const r of newSet) {
        if (!current.has(r)) setPermission(editing.id, r, true);
      }
      for (const r of current) {
        if (!newSet.has(r)) setPermission(editing.id, r, false);
      }
      toast.success(`Role "${label.trim()}" updated`);
    } else {
      let id = slugify(label);
      // Avoid collision with existing role ids.
      const taken = new Set(useDemoStore.getState().roleDefs.map((r) => r.id));
      let n = 1;
      let candidate = id;
      while (taken.has(candidate)) {
        candidate = `${id}_${++n}`;
      }
      id = candidate || `role_${Date.now()}`;
      addRoleDef(
        { id, label: label.trim(), description: description.trim(), tone },
        Array.from(perms),
      );
      toast.success(`Role "${label.trim()}" created`);
    }
    setOpen(false);
    });
  };

  const TriggerEl = trigger ?? (
    <Button size="sm">
      {isEdit ? null : <Plus className="size-4" />}
      {isEdit ? "Edit role" : "New role"}
    </Button>
  );

  return (
    <Dialog open={realOpen} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
      <DialogTrigger asChild>{TriggerEl}</DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldPlus className="size-4" />
            {isEdit ? `Edit role · ${editing?.label}` : "Add a new role"}
          </DialogTitle>
          <DialogDescription>
            Define what this role can see and do. Role definitions and
            permissions are saved to the demo store and survive a reload.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} aria-busy={pending} className="flex flex-col gap-4">
          <fieldset disabled={pending} className="contents">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="font-medium text-sm" htmlFor="role-label">
                Label
              </label>
              <Input
                id="role-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Operations Lead"
                required
              />
              {!isEdit && (
                <p className="mt-1 font-mono text-muted-foreground text-[10px]">
                  id will be:{" "}
                  <span className="text-foreground">
                    {slugify(label) || "—"}
                  </span>
                </p>
              )}
            </div>
            <div>
              <label className="font-medium text-sm">Tone</label>
              <div className="mt-2 grid grid-cols-9 gap-1.5">
                {ROLE_TONE_PRESETS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.cls)}
                    aria-label={`Tone ${t.label}`}
                    className={cn(
                      "flex h-7 items-center justify-center rounded-md border text-[10px] transition",
                      t.cls,
                      tone === t.cls
                        ? "ring-2 ring-ring/60 ring-offset-1 ring-offset-background"
                        : "opacity-80 hover:opacity-100",
                    )}
                  >
                    {t.id[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="font-medium text-sm" htmlFor="role-desc">
              Description
            </label>
            <Textarea
              id="role-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Plain-English summary of what this role is for."
            />
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label className="font-medium text-sm">Permissions</label>
              <span className="text-muted-foreground text-xs">
                {perms.size} resource{perms.size === 1 ? "" : "s"} selected
              </span>
            </div>
            <div className="rounded-lg border p-3">
              {RESOURCE_GROUPS.map((g) => (
                <div key={g.label} className="mb-3 last:mb-0">
                  <div className="mb-1 text-muted-foreground text-[11px] uppercase tracking-wider">
                    {g.label}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.resources.map((r) => {
                      const on = perms.has(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => togglePerm(r)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors",
                            on
                              ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                              : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" disabled={pending} variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : isEdit ? "Save changes" : "Create role"}</Button>
          </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
