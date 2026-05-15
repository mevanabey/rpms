import { FileText, Mail } from "lucide-react";

import { LeaseDocumentTemplateCard } from "./_components/lease-document-template-card";
import { TemplateCard } from "./_components/template-card";
import { RoleGate } from "@/components/app/role-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TEMPLATE_DEFS } from "@/lib/demo/templates";

export default function TemplatesPage() {
  const leaseTemplates = TEMPLATE_DEFS.filter((t) => t.group === "lease");
  const notificationTemplates = TEMPLATE_DEFS.filter((t) => t.group === "notification");

  return (
    <RoleGate required={["admin:templates"]}>
      <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Templates</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            The auto-generated lease PDF, plus DOCX boilerplates and notification
            templates. View renders with sample data; Edit lets you tweak the copy —
            changes apply to every future render until you reset.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" /> Lease document templates
              </CardTitle>
              <CardDescription>
                The auto-generated PDF is the document parties actually sign. The DOCX
                templates below are kept as the long-form lawyer boilerplate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <LeaseDocumentTemplateCard />
              {leaseTemplates.map((t) => (
                <TemplateCard key={t.id} template={t} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="size-4" /> Notification templates
              </CardTitle>
              <CardDescription>
                react-email components driven by the rent-collection-cycle workflow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {notificationTemplates.map((t) => (
                <TemplateCard key={t.id} template={t} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGate>
  );
}
