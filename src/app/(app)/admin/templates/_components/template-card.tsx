"use client";

import { CheckCircle2, Eye, FileText, Mail, Pencil } from "lucide-react";

import { TemplateDialog } from "./template-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TemplateDef } from "@/lib/demo/templates";
import { useTemplateOverrides } from "@/lib/demo/use-store";

interface Props {
  template: TemplateDef;
}

export function TemplateCard({ template }: Props) {
  const overrides = useTemplateOverrides();
  const override = overrides[template.id];
  const isCustomized = Boolean(override && (override.body || override.subject));
  const Icon = template.group === "lease" ? FileText : Mail;

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium text-sm">{template.name}</span>
            {isCustomized ? (
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-100 text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              >
                <CheckCircle2 className="size-2.5" /> customized
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                default
              </Badge>
            )}
          </div>
          {template.file && (
            <div className="mt-1 font-mono text-muted-foreground text-xs">{template.file}</div>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
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
            {template.group === "lease" &&
              template.variables.slice(0, 6).map((v) => (
                <Badge key={v.key} variant="outline" className="font-mono text-[10px]">
                  {`{{${v.key}}}`}
                </Badge>
              ))}
            {template.group === "lease" && template.variables.length > 6 && (
              <Badge variant="outline" className="text-[10px]">
                +{template.variables.length - 6}
              </Badge>
            )}
          </div>
          <div className="mt-2 line-clamp-2 text-muted-foreground text-xs">
            {template.description}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <TemplateDialog
          template={template}
          initialMode="view"
          trigger={
            <Button variant="outline" size="sm">
              <Eye className="size-3.5" /> View
            </Button>
          }
        />
        <TemplateDialog
          template={template}
          initialMode="edit"
          trigger={
            <Button variant="outline" size="sm">
              <Pencil className="size-3.5" /> Edit
            </Button>
          }
        />
      </div>
    </div>
  );
}
