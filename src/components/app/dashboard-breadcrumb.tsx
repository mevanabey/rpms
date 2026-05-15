"use client";

import { Fragment } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Path-driven breadcrumb.
 *
 * Reads URL segments and maps known prefixes to human labels. For dynamic
 * detail routes (e.g. `/leases/{id}`) it shows a shortened ID; once each
 * module owns its data layer it can hydrate the full entity name via a
 * per-route context provider — see CLAUDE.md principle #3.
 */

const STATIC_LABELS: Record<string, string> = {
  properties: "Properties",
  units: "Units",
  parties: "Parties",
  leases: "Leases",
  new: "New lease",
  documents: "Documents",
  payments: "Payments",
  inbox: "Reconciliation inbox",
  commissions: "Commissions",
  reminders: "Reminders",
  maintenance: "Maintenance",
  compliance: "Compliance",
  reports: "Reports",
  "rent-roll": "Rent roll",
  arrears: "Arrears",
  escalations: "Escalations",
  cashflow: "Cashflow",
  admin: "Admin",
  import: "Import",
  templates: "Templates",
  workflows: "Workflows",
  users: "Users",
  access: "Access",
  tasks: "Tasks",
  activity: "Activity",
  automation: "Automation",
};

interface Crumb {
  label: string;
  href: string;
  isLast: boolean;
}

function humanize(segment: string): string {
  return STATIC_LABELS[segment] ?? segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function shortenId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

export function DashboardBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs: Crumb[] = [];
  let href = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    href += `/${seg}`;
    const isLast = i === segments.length - 1;
    const prev = i > 0 ? segments[i - 1] : null;

    // Detail-route IDs: show a short stub. Modules can swap this for the
    // real entity name later by reading from a per-route context provider.
    const isEntityId = prev !== null && prev in STATIC_LABELS && !STATIC_LABELS[seg];
    const label = isEntityId ? shortenId(decodeURIComponent(seg)) : humanize(seg);

    crumbs.push({ label, href, isLast });
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <Fragment key={crumb.href}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {crumb.isLast ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <BreadcrumbPage className="max-w-[240px] truncate">{crumb.label}</BreadcrumbPage>
                  </TooltipTrigger>
                  <TooltipContent>{crumb.label}</TooltipContent>
                </Tooltip>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
