/**
 * RBAC primitives. Roles + permissions are runtime-editable from
 * /admin/access (admin only) — the *defaults* live here as the seed for the
 * demo store. Components read live values via the hooks in `use-store.ts`.
 *
 * Phase 02 keeps the same `Role` / `Resource` / `RoleDefinition` shapes —
 * the difference is the source of truth (Postgres) and the enforcement
 * layer (RLS + tRPC procedures).
 */

export type Role = string;

export interface RoleDefinition {
  id: Role;
  label: string;
  description: string;
  /** Tailwind class string for the role chip. */
  tone: string;
  /** Built-in roles cannot be deleted; they can still be relabelled and have
   *  permissions adjusted. */
  builtin: boolean;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** An account may perform more than one staff function. */
  roles?: Role[];
  entities: string[];
  initials?: string;
  partyId?: string;
  /** Derived from explicit lease assignments for scoped staff roles. */
  assignedLeaseIds?: string[];
  createdLeaseIds?: string[];
}

export type Resource =
  | "properties:read"
  | "properties:write"
  | "properties:create"
  | "units:read"
  | "units:write"
  | "units:create"
  | "parties:read"
  | "parties:write"
  | "parties:create"
  | "leases:read"
  | "leases:write"
  | "leases:create"
  | "documents:read"
  | "documents:write"
  | "payments:read"
  | "payments:write"
  | "payments:reconcile"
  | "commissions:read"
  | "commissions:payout"
  | "reminders:read"
  | "reminders:send"
  | "maintenance:read"
  | "maintenance:write"
  | "compliance:read"
  | "compliance:write"
  | "tasks:read"
  | "tasks:decide"
  | "automation:read"
  | "automation:promote"
  | "reports:read"
  | "admin:import"
  | "admin:templates"
  | "admin:workflows"
  | "admin:users"
  | "admin:rbac"
  | "admin:reset-demo";

export const ALL_RESOURCES: readonly Resource[] = [
  "properties:read",
  "properties:write",
  "properties:create",
  "units:read",
  "units:write",
  "units:create",
  "parties:read",
  "parties:write",
  "parties:create",
  "leases:read",
  "leases:write",
  "leases:create",
  "documents:read",
  "documents:write",
  "payments:read",
  "payments:write",
  "payments:reconcile",
  "commissions:read",
  "commissions:payout",
  "reminders:read",
  "reminders:send",
  "maintenance:read",
  "maintenance:write",
  "compliance:read",
  "compliance:write",
  "tasks:read",
  "tasks:decide",
  "automation:read",
  "automation:promote",
  "reports:read",
  "admin:import",
  "admin:templates",
  "admin:workflows",
  "admin:users",
  "admin:rbac",
  "admin:reset-demo",
];

/** Tailwind class strings used by the colour picker in the role editor. */
export const ROLE_TONE_PRESETS: Array<{ id: string; label: string; cls: string }> = [
  { id: "violet", label: "Violet", cls: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-900" },
  { id: "blue", label: "Blue", cls: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900" },
  { id: "emerald", label: "Emerald", cls: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900" },
  { id: "amber", label: "Amber", cls: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900" },
  { id: "rose", label: "Rose", cls: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900" },
  { id: "sky", label: "Sky", cls: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-900" },
  { id: "lime", label: "Lime", cls: "bg-lime-100 text-lime-900 border-lime-200 dark:bg-lime-950 dark:text-lime-200 dark:border-lime-900" },
  { id: "fuchsia", label: "Fuchsia", cls: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-200 dark:border-fuchsia-900" },
  { id: "zinc", label: "Zinc", cls: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800" },
];

export const DEFAULT_ROLES: RoleDefinition[] = [
  { id: "admin", label: "Admin", description: "Full access — system, properties, leases, rent, and RBAC.", tone: ROLE_TONE_PRESETS[0].cls, builtin: true },
  { id: "account_manager", label: "Account Manager", description: "Day-to-day operator. Manages properties, leases, marks rent paid, and sends reminders.", tone: ROLE_TONE_PRESETS[1].cls, builtin: true },
  { id: "lawyer", label: "Lawyer", description: "Read-only access to leases where they are assigned as a lawyer.", tone: ROLE_TONE_PRESETS[3].cls, builtin: true },
  { id: "accountant", label: "Accountant", description: "Create and manage leases; rent and payments for assigned or self-created leases.", tone: ROLE_TONE_PRESETS[2].cls, builtin: true },
  { id: "advisor", label: "Advisor", description: "Create and manage leases assigned to them or created by them.", tone: ROLE_TONE_PRESETS[5].cls, builtin: true },
  { id: "viewer", label: "Viewer", description: "No app access until an administrator assigns a staff role.", tone: ROLE_TONE_PRESETS[8].cls, builtin: true },
];

export const DEFAULT_PERMISSIONS: Record<Role, Resource[]> = {
  admin: [...ALL_RESOURCES],
  account_manager: [
    "properties:read",
    "properties:write",
    "properties:create",
    "units:read",
    "units:write",
    "units:create",
    "parties:read",
    "parties:write",
    "parties:create",
    "leases:read",
    "leases:write",
    "leases:create",
    "documents:read",
    "documents:write",
    "payments:read",
    "payments:write",
    "payments:reconcile",
    "reminders:read",
    "reminders:send",
    "reports:read",
    // Account managers own lease document templates day-to-day.
    "admin:templates",
  ],
  lawyer: ["leases:read"],
  accountant: ["leases:read", "leases:create", "leases:write", "properties:read", "properties:create", "units:read", "units:create", "parties:read", "parties:create", "documents:read", "documents:write", "payments:read", "payments:write"],
  advisor: ["leases:read", "leases:create", "leases:write", "properties:read", "properties:create", "units:read", "units:create", "parties:read", "parties:create", "documents:read", "documents:write"],
  viewer: [],
};

/** Built-in role IDs — used to refuse delete on these. */
export const BUILTIN_ROLE_IDS: ReadonlySet<Role> = new Set(DEFAULT_ROLES.map((r) => r.id));

/** Pure permission check — pass the live `permissions` map from the store. */
export function can(
  user: AppUser | null | undefined,
  permissions: Record<Role, Resource[]>,
  resource: Resource,
): boolean {
  if (!user) return false;
  return rolesFor(user).some((role) => permissions[role]?.includes(resource));
}

export function canAny(
  user: AppUser | null | undefined,
  permissions: Record<Role, Resource[]>,
  resources: Resource[],
): boolean {
  if (!user) return false;
  return resources.some((resource) => can(user, permissions, resource));
}

export function rolesFor(user: Pick<AppUser, "role" | "roles">): Role[] {
  return [...new Set([user.role, ...(user.roles ?? [])])];
}

export function hasRole(user: AppUser, role: Role): boolean {
  return rolesFor(user).includes(role);
}

export const PRESET_USERS: AppUser[] = [
  {
    id: "user_mevan",
    name: "Mevan",
    email: "mevan@capitaltrust.lk",
    role: "admin",
    entities: ["CTH", "CTP-1", "CTR", "TCL", "CBPO", "ColBPO"],
    initials: "M",
  },
  {
    id: "user_disna",
    name: "Disna",
    email: "disna@capitaltrust.lk",
    role: "account_manager",
    entities: ["CTH", "CTP-1", "CTR"],
    initials: "DI",
  },
  {
    id: "user_ruvini",
    name: "Ruvini Weerasinghe",
    email: "ruvini@cth-legal.lk",
    role: "lawyer",
    entities: ["CTH"],
    initials: "RW",
    // Lucky Seven head lease + the two Trizen subleases under her file.
    assignedLeaseIds: [
      "lease_lucky_seven_head",
      "lease_trz_t3_21_c5",
      "lease_trz_t3_36_c5",
    ],
  },
  {
    id: "user_sulochana",
    name: "Sulochana Costa",
    email: "sulochana@cth-legal.lk",
    role: "lawyer",
    entities: ["CTR"],
    initials: "SC",
    assignedLeaseIds: ["lease_ctr_a1", "lease_ctr_a2"],
  },
];

/** Resource grouping for the RBAC matrix + role editor. */
export const RESOURCE_GROUPS: Array<{ label: string; resources: Resource[] }> = [
  { label: "Estate", resources: ["properties:read", "properties:create", "properties:write", "units:read", "units:create", "units:write", "parties:read", "parties:create", "parties:write"] },
  { label: "Agreements", resources: ["leases:read", "leases:write", "leases:create", "documents:read", "documents:write"] },
  { label: "Rent & money", resources: ["payments:read", "payments:write", "payments:reconcile", "reminders:read", "reminders:send"] },
  { label: "Reports", resources: ["reports:read"] },
  { label: "Admin", resources: ["admin:import", "admin:templates", "admin:workflows", "admin:users", "admin:rbac", "admin:reset-demo"] },
];
