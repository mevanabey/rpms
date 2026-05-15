"use client";

import { useMemo, useState } from "react";

import { Eye, FileText, Mail, Pencil, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useDemoStore } from "@/lib/demo/store";
import { renderTemplate, sampleVarMap, type TemplateDef } from "@/lib/demo/templates";
import { useTemplateOverrides } from "@/lib/demo/use-store";
import { useCurrentUser } from "@/lib/demo/use-store";
import { cn, formatDate } from "@/lib/utils";

interface Props {
  template: TemplateDef;
  /** Open straight to the editor instead of the previewer. */
  initialMode?: "view" | "edit";
  /** The trigger button. If omitted, no trigger is rendered (controlled mode). */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}

export function TemplateDialog({
  template,
  initialMode = "view",
  trigger,
  open: openProp,
  onOpenChange,
}: Props) {
  const overrides = useTemplateOverrides();
  const setTemplateOverride = useDemoStore((s) => s.setTemplateOverride);
  const resetTemplate = useDemoStore((s) => s.resetTemplate);
  const user = useCurrentUser();

  const override = overrides[template.id];
  const effectiveBody = override?.body ?? template.defaultBody;
  const effectiveSubject = override?.subject ?? template.defaultSubject ?? "";
  const isCustomized = Boolean(override && (override.body || override.subject));

  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const [tab, setTab] = useState<"view" | "edit">(initialMode);
  const [draftBody, setDraftBody] = useState(effectiveBody);
  const [draftSubject, setDraftSubject] = useState(effectiveSubject);

  // Each open is a fresh editing session: snap drafts back to the persisted
  // override (or default) whenever the dialog opens, then track edits in
  // local state until the user saves or closes.
  const setOpen = (next: boolean) => {
    if (next) {
      setTab(initialMode);
      setDraftBody(effectiveBody);
      setDraftSubject(effectiveSubject);
    }
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  const sampleVars = useMemo(() => sampleVarMap(template), [template]);
  const previewSubject = useMemo(
    () => (tab === "edit" ? renderTemplate(draftSubject, sampleVars) : renderTemplate(effectiveSubject, sampleVars)),
    [tab, draftSubject, effectiveSubject, sampleVars],
  );
  const previewBody = useMemo(
    () => (tab === "edit" ? renderTemplate(draftBody, sampleVars) : renderTemplate(effectiveBody, sampleVars)),
    [tab, draftBody, effectiveBody, sampleVars],
  );

  const dirty =
    draftBody !== effectiveBody ||
    (template.defaultSubject !== undefined && draftSubject !== effectiveSubject);

  function onSave() {
    setTemplateOverride(
      template.id,
      {
        body: draftBody === template.defaultBody ? undefined : draftBody,
        subject:
          template.defaultSubject === undefined
            ? undefined
            : draftSubject === template.defaultSubject
              ? undefined
              : draftSubject,
      },
      user?.name,
    );
    toast.success("Template saved", {
      description: "Changes apply to all future renders. Reset to revert.",
    });
    setTab("view");
  }

  function onReset() {
    resetTemplate(template.id);
    setDraftBody(template.defaultBody);
    setDraftSubject(template.defaultSubject ?? "");
    toast.success("Template reset to default");
  }

  const HeaderIcon = template.group === "lease" ? FileText : Mail;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] w-screen flex-col gap-0 overflow-hidden rounded-none border-0 p-0 !max-w-none !max-h-none sm:h-[92vh] sm:w-[96vw] sm:!max-w-[1280px] sm:rounded-lg sm:border"
      >
        <DialogHeader className="flex flex-col gap-2 border-b px-4 py-3 space-y-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2 text-base leading-tight">
                <HeaderIcon className="size-4 shrink-0" />
                <span className="min-w-0 break-words">{template.name}</span>
                {isCustomized && (
                  <Badge variant="outline" className="text-[10px]">
                    Customized
                  </Badge>
                )}
              </DialogTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {template.id}
                </Badge>
                {template.channels?.map((c) => (
                  <Badge key={c} variant="outline" className="text-[10px]">
                    {c}
                  </Badge>
                ))}
                {template.locales?.map((l) => (
                  <Badge key={l} variant="outline" className="font-mono text-[10px]">
                    {l}
                  </Badge>
                ))}
              </div>
              <DialogDescription className="mt-1.5 text-xs">
                {template.description}
                {override?.updatedAt && (
                  <>
                    {" · "}
                    Last edited {formatDate(new Date(override.updatedAt).toISOString())}
                    {override.updatedBy ? ` by ${override.updatedBy}` : ""}
                  </>
                )}
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                className="shrink-0 sm:hidden"
              >
                <X className="size-4" />
              </Button>
            </DialogClose>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 self-stretch sm:self-start">
            {tab === "edit" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReset}
                  disabled={!isCustomized}
                  className="flex-1 sm:flex-none"
                >
                  <RotateCcw className="size-3.5" /> Reset
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onSave}
                  disabled={!dirty}
                  className="flex-1 sm:flex-none"
                >
                  <Save className="size-3.5" /> Save changes
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTab("edit")}
                className="flex-1 sm:flex-none"
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                className="hidden shrink-0 sm:inline-flex"
              >
                <X className="size-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "view" | "edit")}
            className="flex h-full min-h-0 flex-col"
          >
            <div className="border-b px-4 sm:px-5">
              <TabsList>
                <TabsTrigger value="view">
                  <Eye className="size-3.5" /> Preview
                </TabsTrigger>
                <TabsTrigger value="edit">
                  <Pencil className="size-3.5" /> Source
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="view" className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-5">
              <PreviewPane
                kind={template.group}
                subject={previewSubject}
                body={previewBody}
                file={template.file}
              />
              <VariableLegend template={template} />
            </TabsContent>

            <TabsContent value="edit" className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                <div className="flex flex-col gap-3">
                  {template.defaultSubject !== undefined && (
                    <div>
                      <label className="text-muted-foreground text-xs uppercase tracking-wider">
                        Subject
                      </label>
                      <Input
                        value={draftSubject}
                        onChange={(e) => setDraftSubject(e.target.value)}
                        className="mt-1 font-mono text-xs"
                      />
                    </div>
                  )}
                  <div className="flex min-h-0 flex-1 flex-col">
                    <label className="text-muted-foreground text-xs uppercase tracking-wider">
                      Body ({template.group === "lease" ? "DOCX source" : "Plain text + mustache"})
                    </label>
                    <Textarea
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      className={cn(
                        "mt-1 min-h-[40vh] resize-y font-mono text-xs leading-relaxed",
                        template.group === "lease" && "min-h-[55vh]",
                      )}
                      spellCheck={false}
                    />
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Use{" "}
                    <code className="font-mono">{`{{var.path}}`}</code> for substitutions. The
                    Preview tab renders with sample values listed on the right. Phase 02 swaps this
                    for a docxtemplater / react-email builder.
                  </p>
                </div>
                <VariableLegend template={template} compact />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewPane({
  kind,
  subject,
  body,
  file,
}: {
  kind: "lease" | "notification";
  subject?: string;
  body: string;
  file?: string;
}) {
  if (kind === "notification") {
    return (
      <div className="rounded-lg border bg-background">
        {subject && (
          <div className="border-b px-4 py-2.5">
            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
              Subject
            </div>
            <div className="mt-0.5 font-medium text-sm">{subject}</div>
          </div>
        )}
        <div className="px-4 py-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{body}</pre>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="font-mono text-muted-foreground text-[11px]">{file ?? "lease document"}</div>
        <Badge variant="outline" className="text-[10px]">
          rendered preview
        </Badge>
      </div>
      <div className="px-6 py-6">
        <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed">{body}</pre>
      </div>
    </div>
  );
}

function VariableLegend({
  template,
  compact = false,
}: {
  template: TemplateDef;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border bg-muted/40 p-3", !compact && "mt-4")}>
      <div className="flex items-center justify-between">
        <div className="font-medium text-xs">Variables</div>
        <Badge variant="outline" className="text-[10px]">
          {template.variables.length}
        </Badge>
      </div>
      <ul className="mt-2 space-y-1 text-xs">
        {template.variables.map((v) => (
          <li key={v.key} className="flex items-baseline justify-between gap-2">
            <code className="font-mono text-[11px]">{`{{${v.key}}}`}</code>
            <span className="truncate text-muted-foreground">{v.sample}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
