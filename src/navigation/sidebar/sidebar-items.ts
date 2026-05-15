import {
  Building2,
  ClipboardCheck,
  FilePlus2,
  FileSignature,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  ShieldAlert,
  UploadCloud,
  Users,
} from "lucide-react";

import { type Resource } from "@/lib/demo/identity";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
  /** Required permissions — visible iff user `can` any of these resources. */
  requires?: Resource[];
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
  requires?: Resource[];
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

// RPMS sidebar navigation. Mirrors the IA in docs/SPEC.md §6.
// Each item declares the permissions it requires; users whose role doesn't
// have at least one are filtered out by getSidebarItems().
const rpmsNav: NavGroup[] = [
  {
    id: 1,
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      // { title: "Tasks", url: "/tasks", icon: ShieldQuestion, requires: ["tasks:read"] },
      // { title: "Activity", url: "/activity", icon: Activity },
      // { title: "Automation", url: "/automation", icon: GraduationCap, requires: ["automation:read"] },
    ],
  },
  {
    id: 2,
    items: [
      { title: "Properties", url: "/properties", icon: Building2, requires: ["properties:read"] },
      { title: "Parties", url: "/parties", icon: Users, requires: ["parties:read"] },
      // { title: "Units", url: "/units", icon: Gauge, requires: ["units:read"] },
    ],
  },
  {
    id: 3,
    label: "Leases",
    items: [
      { title: "All leases", url: "/leases", icon: FileSignature, requires: ["leases:read"] },
      { title: "Add lease", url: "/leases/new", icon: FilePlus2, isNew: true, requires: ["leases:create"] },
      // { title: "Documents", url: "/documents", icon: Files, requires: ["documents:read"] },
    ],
  },
  {
    id: 4,
    label: "Rent",
    items: [
      { title: "Rent", url: "/rent", icon: Receipt, requires: ["payments:read"] },
    ],
  },
  // {
  //   id: 4,
  //   label: "Money",
  //   items: [
  //     {
  //       title: "Payments",
  //       url: "/payments",
  //       icon: Receipt,
  //       requires: ["payments:read"],
  //       subItems: [
  //         { title: "Ledger", url: "/payments", requires: ["payments:read"] },
  //         { title: "Reconciliation inbox", url: "/payments/inbox", requires: ["payments:reconcile"] },
  //       ],
  //     },
  //     { title: "Commissions", url: "/commissions", icon: Coins, requires: ["commissions:read"] },
  //   ],
  // },
  // {
  //   id: 5,
  //   label: "Operations",
  //   items: [
  //     { title: "Reminders", url: "/reminders", icon: Bell, requires: ["reminders:read"] },
  //     { title: "Maintenance", url: "/maintenance", icon: Wrench, requires: ["maintenance:read"] },
  //     { title: "Compliance", url: "/compliance", icon: ShieldCheck, requires: ["compliance:read"] },
  //   ],
  // },
  // {
  //   id: 6,
  //   label: "Reports",
  //   items: [
  //     {
  //       title: "Reports",
  //       url: "/reports/rent-roll",
  //       icon: ScrollText,
  //       requires: ["reports:read"],
  //       subItems: [
  //         { title: "Rent roll", url: "/reports/rent-roll", icon: ClipboardList, requires: ["reports:read"] },
  //         { title: "Arrears", url: "/reports/arrears", icon: TrendingUp, requires: ["reports:read"] },
  //         { title: "Escalations", url: "/reports/escalations", icon: Calendar, requires: ["reports:read"] },
  //         { title: "Cashflow", url: "/reports/cashflow", icon: Coins, requires: ["reports:read"] },
  //       ],
  //     },
  //   ],
  // },
  {
    id: 7,
    label: "Settings",
    items: [
      { title: "Templates", url: "/admin/templates", icon: FileText, requires: ["admin:templates"] },
      { title: "Import (XLSX)", url: "/admin/import", icon: UploadCloud, requires: ["admin:import"] },
      // { title: "Workflows", url: "/admin/workflows", icon: ClipboardCheck, requires: ["admin:workflows"] },
      { title: "Users", url: "/admin/users", icon: Users, requires: ["admin:users"] },
      { title: "Access", url: "/admin/access", icon: ShieldAlert, requires: ["admin:rbac"] },
    ],
  },
];

type CanAnyFn = (resources: Resource[]) => boolean;

function visibleSub(canAnyFn: CanAnyFn, sub: NavSubItem): boolean {
  if (!sub.requires || sub.requires.length === 0) return true;
  return canAnyFn(sub.requires);
}

function visibleMain(canAnyFn: CanAnyFn, item: NavMainItem): boolean {
  if (item.subItems && item.subItems.length > 0) {
    if (item.subItems.some((s) => visibleSub(canAnyFn, s))) return true;
    return false;
  }
  if (!item.requires || item.requires.length === 0) return true;
  return canAnyFn(item.requires);
}

/**
 * Returns the role-filtered sidebar tree. Pass a `canAny` function bound to
 * the current user + live permissions (use `useCanAnyCheck()` from
 * @/lib/demo/use-store).
 */
export function getSidebarItems(canAnyFn: CanAnyFn | null): NavGroup[] {
  if (!canAnyFn) return [];
  return rpmsNav
    .map((g) => ({
      ...g,
      items: g.items
        .filter((it) => visibleMain(canAnyFn, it))
        .map((it) => ({
          ...it,
          subItems: it.subItems?.filter((s) => visibleSub(canAnyFn, s)),
        })),
    }))
    .filter((g) => g.items.length > 0);
}
