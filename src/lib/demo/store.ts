"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { buildInitialDemoState } from "./seed";
import {
  BUILTIN_ROLE_IDS,
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLES,
  type Resource,
  type Role,
  type RoleDefinition,
} from "./identity";
import {
  AUTONOMY_NEXT,
  AUTONOMY_THRESHOLD,
  type Activity,
  type ApprovalRequest,
  type AutonomyEntry,
  type DemoState,
  type DraftLease,
  type DraftParty,
  type DraftProperty,
  type DraftUnit,
  type LeaseDocSettings,
  type LeaseSignatureRecord,
  type MaintenanceTicket,
  type RentPaymentRecord,
  type RentReminderRecord,
  type TemplateOverride,
  type TicketComment,
  type TicketStatus,
  type WorkflowKind,
} from "./types";

interface DemoActions {
  // Lifecycle
  hydrate: () => void;
  resetDemo: () => void;
  // Activity
  pushActivity: (activity: Omit<Activity, "id" | "ts" | "acked">) => Activity;
  ackActivity: (id: string) => void;
  ackAllActivities: () => void;
  // Approvals
  requestApproval: (req: Omit<ApprovalRequest, "id" | "ts" | "decision">) => ApprovalRequest;
  decideApproval: (
    approvalId: string,
    optionId: string,
    by: "human" | "auto",
    note?: string,
  ) => void;
  // Autonomy
  setAutonomyLevel: (workflow: WorkflowKind, level: AutonomyEntry["level"]) => void;
  promoteAutonomy: (workflow: WorkflowKind) => void;
  // Draft leases (wizard)
  addDraftLease: (intent: Record<string, unknown>) => DraftLease;
  addDraftProperty: (input: Omit<DraftProperty, "id" | "ts">) => DraftProperty;
  addDraftUnit: (input: Omit<DraftUnit, "id" | "ts">) => DraftUnit;
  addDraftParty: (input: Omit<DraftParty, "id" | "ts">) => DraftParty;
  // Templates
  setTemplateOverride: (
    id: string,
    patch: { subject?: string; body?: string },
    updatedBy?: string,
  ) => TemplateOverride;
  resetTemplate: (id: string) => void;
  // Maintenance
  addTicket: (input: Omit<MaintenanceTicket, "id" | "ts" | "comments">) => MaintenanceTicket;
  updateTicketStatus: (id: string, status: TicketStatus, by: string) => void;
  addTicketComment: (id: string, comment: Omit<TicketComment, "id" | "ts">) => void;
  // Rent (manual reconciliation + reminders) — Phase 01 demo overlay
  markRentPaid: (
    ledgerEntryId: string,
    input: Omit<RentPaymentRecord, "ts">,
    context: { leaseId: string; amount: { amount: number; currency: "LKR" | "USD" }; tenantName?: string },
  ) => RentPaymentRecord;
  unmarkRentPaid: (ledgerEntryId: string) => void;
  sendRentReminder: (
    input: Omit<RentReminderRecord, "id" | "ts">,
    context: { dueDate: string; amount: { amount: number; currency: "LKR" | "USD" }; tenantName?: string },
  ) => RentReminderRecord;
  // Party address overlay (Phase 01) — captured by lease intake
  setPartyAddress: (partyId: string, address: string) => void;
  // Lease signatures (Phase 01 e-sign overlay)
  saveLeaseSignature: (
    leaseId: string,
    partyId: string,
    input: Omit<LeaseSignatureRecord, "signedAt">,
  ) => LeaseSignatureRecord;
  clearLeaseSignature: (leaseId: string, partyId: string) => void;
  clearLeaseSignatures: (leaseId: string) => void;
  // Lease PDF template settings (operator-tweakable copy)
  setLeaseDocSettings: (patch: Partial<LeaseDocSettings>) => void;
  resetLeaseDocSettings: () => void;
  // Identity / auth simulation
  loginAs: (userId: string) => void;
  logout: () => void;
  // RBAC editing
  addRoleDef: (def: Omit<RoleDefinition, "builtin">, initialPermissions: Resource[]) => RoleDefinition;
  updateRoleDef: (id: Role, patch: Partial<Omit<RoleDefinition, "id" | "builtin">>) => void;
  deleteRoleDef: (id: Role) => { ok: boolean; reason?: string };
  setPermission: (role: Role, resource: Resource, allowed: boolean) => void;
  resetRolePermissions: (role: Role) => void;
  resetAllRbac: () => void;
  // Sim engine
  setSimEnabled: (enabled: boolean) => void;
  markTickAt: (ts: number) => void;
  // Tour
  markTourCompleted: () => void;
}

type DemoStore = DemoState & DemoActions;

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function bumpAutonomyOnApproval(
  entry: AutonomyEntry,
  optionId: string,
): AutonomyEntry {
  const next = { ...entry, lastDecisionTs: Date.now() };
  // Crude heuristic: any "approve"/"primary" answer increases confidence;
  // any "reject"/"destructive" answer cuts it down.
  if (optionId === "approve" || optionId === "match_partial" || optionId === "match_full") {
    next.approvedHuman += 1;
    next.confidencePct = Math.min(100, next.confidencePct + 4);
  } else if (optionId === "reject" || optionId === "escalate" || optionId === "park") {
    next.rejectedHuman += 1;
    next.confidencePct = Math.max(0, next.confidencePct - 8);
  } else {
    // Neutral options: small bump
    next.approvedHuman += 1;
    next.confidencePct = Math.min(100, next.confidencePct + 2);
  }
  // Auto-promote if we crossed a threshold (visible "graduation" moment).
  const nextLevel = AUTONOMY_NEXT[next.level];
  if (nextLevel && next.confidencePct >= AUTONOMY_THRESHOLD[next.level]) {
    next.level = nextLevel;
  }
  return next;
}

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      ...buildInitialDemoState(),

      hydrate: () => set({ hydrated: true }),
      resetDemo: () => set({ ...buildInitialDemoState(), hydrated: true }),

      pushActivity: (activity) => {
        const next: Activity = { ...activity, id: uid("act"), ts: Date.now(), acked: false };
        set((s) => ({ activities: [next, ...s.activities].slice(0, 250) }));
        return next;
      },
      ackActivity: (id) =>
        set((s) => ({
          activities: s.activities.map((a) => (a.id === id ? { ...a, acked: true } : a)),
        })),
      ackAllActivities: () =>
        set((s) => ({ activities: s.activities.map((a) => ({ ...a, acked: true })) })),

      requestApproval: (req) => {
        const next: ApprovalRequest = { ...req, id: uid("ap"), ts: Date.now() };
        set((s) => ({ approvals: [next, ...s.approvals] }));
        return next;
      },
      decideApproval: (approvalId, optionId, by, note) => {
        const state = get();
        const approval = state.approvals.find((a) => a.id === approvalId);
        if (!approval || approval.decision) return;
        const option = approval.options.find((o) => o.id === optionId);
        const decided: ApprovalRequest = {
          ...approval,
          decision: { ts: Date.now(), optionId, by, note },
        };
        const remaining = state.approvals.filter((a) => a.id !== approvalId);
        const aut = state.autonomy[approval.workflow];
        const nextAut = aut ? bumpAutonomyOnApproval(aut, optionId) : aut;
        const promoted = nextAut && nextAut.level !== aut?.level;
        const optionLabel = option?.label ?? optionId;
        const newActivities: Activity[] = [
          {
            id: uid("act"),
            ts: Date.now(),
            workflow: approval.workflow,
            severity: optionId === "reject" || optionId === "escalate" ? "warning" : "success",
            title: `Decision · ${approval.title.replace(/\?$/, "")}`,
            body: `${by === "human" ? "Human" : "System"} chose: ${optionLabel}.`,
            leaseId: approval.leaseId,
            amount: approval.amount,
            acked: false,
          },
        ];
        if (promoted && nextAut) {
          newActivities.unshift({
            id: uid("act"),
            ts: Date.now() + 1,
            workflow: approval.workflow,
            severity: "success",
            title: `Autonomy promoted · ${approval.workflow}`,
            body: `Confidence ${nextAut.confidencePct}% — system graduated to "${nextAut.level}".`,
            acked: false,
          });
        }
        set({
          approvals: [decided, ...remaining].slice(0, 200),
          autonomy: nextAut
            ? { ...state.autonomy, [approval.workflow]: nextAut }
            : state.autonomy,
          activities: [...newActivities, ...state.activities].slice(0, 250),
        });
      },

      setAutonomyLevel: (workflow, level) =>
        set((s) => ({
          autonomy: {
            ...s.autonomy,
            [workflow]: { ...s.autonomy[workflow], level, lastDecisionTs: Date.now() },
          },
        })),
      promoteAutonomy: (workflow) => {
        const cur = get().autonomy[workflow];
        if (!cur) return;
        const next = AUTONOMY_NEXT[cur.level];
        if (!next) return;
        set((s) => ({
          autonomy: {
            ...s.autonomy,
            [workflow]: {
              ...cur,
              level: next,
              confidencePct: Math.max(cur.confidencePct, AUTONOMY_THRESHOLD[cur.level]),
              lastDecisionTs: Date.now(),
            },
          },
        }));
      },

      addDraftLease: (intent) => {
        const draft: DraftLease = {
          id: uid("draft"),
          ts: Date.now(),
          intent,
          status: "draft",
        };
        set((s) => ({ draftLeases: [draft, ...s.draftLeases] }));
        return draft;
      },
      addDraftProperty: (input) => {
        const draft: DraftProperty = { ...input, id: uid("prop"), ts: Date.now() };
        set((s) => ({ draftProperties: [draft, ...s.draftProperties] }));
        return draft;
      },
      addDraftUnit: (input) => {
        const draft: DraftUnit = { ...input, id: uid("unit"), ts: Date.now() };
        set((s) => ({ draftUnits: [draft, ...s.draftUnits] }));
        return draft;
      },
      addDraftParty: (input) => {
        const draft: DraftParty = { ...input, id: uid("party"), ts: Date.now() };
        set((s) => ({ draftParties: [draft, ...s.draftParties] }));
        return draft;
      },
      setTemplateOverride: (id, patch, updatedBy) => {
        const next: TemplateOverride = {
          subject: patch.subject,
          body: patch.body,
          updatedAt: Date.now(),
          updatedBy,
        };
        // Activity log disabled — app simplified.
        // const editActivity: Activity = {
        //   id: uid("act"),
        //   ts: Date.now(),
        //   workflow: "system",
        //   severity: "info",
        //   title: `Template edited · ${id}`,
        //   body: updatedBy
        //     ? `${updatedBy} updated the template body / subject.`
        //     : "Template body / subject updated.",
        //   acked: false,
        // };
        set((s) => ({
          templateOverrides: { ...s.templateOverrides, [id]: next },
        }));
        return next;
      },
      resetTemplate: (id) =>
        set((s) => {
          if (!(id in s.templateOverrides)) return s;
          const { [id]: _gone, ...rest } = s.templateOverrides;
          return { templateOverrides: rest };
        }),

      addTicket: (input) => {
        const ticket: MaintenanceTicket = {
          ...input,
          id: uid("ticket"),
          ts: Date.now(),
          comments: [],
        };
        set((s) => ({ tickets: [ticket, ...s.tickets] }));
        return ticket;
      },
      updateTicketStatus: (id, status, by) => {
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status,
                  comments: [
                    ...t.comments,
                    {
                      id: uid("tc"),
                      ts: Date.now(),
                      author: by,
                      body: `Status changed to ${status}.`,
                      kind: "status_change",
                    },
                  ],
                }
              : t,
          ),
        }));
      },
      addTicketComment: (id, comment) => {
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === id
              ? {
                  ...t,
                  comments: [
                    ...t.comments,
                    { ...comment, id: uid("tc"), ts: Date.now() },
                  ],
                }
              : t,
          ),
        }));
      },
      markRentPaid: (ledgerEntryId, input, context) => {
        const record: RentPaymentRecord = { ...input, ts: Date.now() };
        const activity: Activity = {
          id: uid("act"),
          ts: Date.now(),
          workflow: "human",
          severity: "success",
          title: "Rent marked paid",
          body: context.tenantName
            ? `${input.by} confirmed receipt from ${context.tenantName} (${input.method.replace("_", " ")}) on ${input.paidDate}.`
            : `${input.by} confirmed receipt (${input.method.replace("_", " ")}) on ${input.paidDate}.`,
          leaseId: context.leaseId,
          amount: context.amount,
          acked: false,
        };
        set((s) => ({
          rentPayments: { ...s.rentPayments, [ledgerEntryId]: record },
          activities: [activity, ...s.activities].slice(0, 250),
        }));
        return record;
      },
      unmarkRentPaid: (ledgerEntryId) =>
        set((s) => {
          if (!(ledgerEntryId in s.rentPayments)) return s;
          const { [ledgerEntryId]: _gone, ...rest } = s.rentPayments;
          return { rentPayments: rest };
        }),
      sendRentReminder: (input, context) => {
        const record: RentReminderRecord = {
          ...input,
          id: uid("rem"),
          ts: Date.now(),
        };
        const activity: Activity = {
          id: uid("act"),
          ts: Date.now(),
          workflow: "human",
          severity: "info",
          title: "Rent reminder sent",
          body: context.tenantName
            ? `${input.by} emailed ${context.tenantName} (${input.to.join(", ")}) — rent due ${context.dueDate}.`
            : `${input.by} emailed ${input.to.join(", ")} — rent due ${context.dueDate}.`,
          leaseId: input.leaseId,
          amount: context.amount,
          acked: false,
        };
        set((s) => ({
          rentReminders: [record, ...s.rentReminders].slice(0, 200),
          activities: [activity, ...s.activities].slice(0, 250),
        }));
        return record;
      },
      setPartyAddress: (partyId, address) =>
        set((s) => {
          const trimmed = address.trim();
          if (!trimmed) {
            if (!(partyId in s.partyAddresses)) return s;
            const { [partyId]: _gone, ...rest } = s.partyAddresses;
            return { partyAddresses: rest };
          }
          if (s.partyAddresses[partyId] === trimmed) return s;
          return { partyAddresses: { ...s.partyAddresses, [partyId]: trimmed } };
        }),
      saveLeaseSignature: (leaseId, partyId, input) => {
        const record: LeaseSignatureRecord = {
          ...input,
          signedAt: new Date().toISOString(),
        };
        set((s) => ({
          leaseSignatures: {
            ...s.leaseSignatures,
            [leaseId]: {
              ...(s.leaseSignatures[leaseId] ?? {}),
              [partyId]: record,
            },
          },
        }));
        return record;
      },
      clearLeaseSignature: (leaseId, partyId) =>
        set((s) => {
          const current = s.leaseSignatures[leaseId];
          if (!current || !(partyId in current)) return s;
          const { [partyId]: _gone, ...rest } = current;
          const nextForLease = Object.keys(rest).length === 0 ? undefined : rest;
          const nextAll = { ...s.leaseSignatures };
          if (nextForLease) nextAll[leaseId] = nextForLease;
          else delete nextAll[leaseId];
          return { leaseSignatures: nextAll };
        }),
      clearLeaseSignatures: (leaseId) =>
        set((s) => {
          if (!(leaseId in s.leaseSignatures)) return s;
          const next = { ...s.leaseSignatures };
          delete next[leaseId];
          return { leaseSignatures: next };
        }),
      setLeaseDocSettings: (patch) =>
        set((s) => {
          const merged: LeaseDocSettings = { ...s.leaseDocSettings, ...patch };
          // Drop empty-string fields so they fall back to template defaults.
          for (const k of Object.keys(merged) as (keyof LeaseDocSettings)[]) {
            const v = merged[k];
            if (typeof v === "string" && v.trim() === "") delete merged[k];
          }
          return { leaseDocSettings: merged };
        }),
      resetLeaseDocSettings: () => set({ leaseDocSettings: {} }),
      loginAs: (userId) => set({ currentUserId: userId }),
      logout: () => set({ currentUserId: null }),

      addRoleDef: (def, initialPermissions) => {
        const newDef: RoleDefinition = { ...def, builtin: false };
        set((s) => ({
          roleDefs: [...s.roleDefs, newDef],
          permissions: { ...s.permissions, [def.id]: [...initialPermissions] },
        }));
        return newDef;
      },
      updateRoleDef: (id, patch) =>
        set((s) => ({
          roleDefs: s.roleDefs.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      deleteRoleDef: (id) => {
        if (BUILTIN_ROLE_IDS.has(id)) {
          return { ok: false, reason: "Built-in roles can't be deleted." };
        }
        // We don't track all users in the store, but PRESET_USERS may use it.
        // Refuse if anyone is using it.
        // (Imported lazily to avoid circular deps at module init.)
        const stillInUse = false; // PRESET_USERS doesn't include custom roles by default
        if (stillInUse) {
          return { ok: false, reason: "Some users still have this role." };
        }
        set((s) => {
          const { [id]: _removed, ...rest } = s.permissions;
          return {
            roleDefs: s.roleDefs.filter((r) => r.id !== id),
            permissions: rest,
          };
        });
        return { ok: true };
      },
      setPermission: (role, resource, allowed) =>
        set((s) => {
          const current = s.permissions[role] ?? [];
          const next = allowed
            ? current.includes(resource)
              ? current
              : [...current, resource]
            : current.filter((r) => r !== resource);
          return { permissions: { ...s.permissions, [role]: next } };
        }),
      resetRolePermissions: (role) =>
        set((s) => {
          const def = DEFAULT_PERMISSIONS[role];
          if (!def) return s;
          return { permissions: { ...s.permissions, [role]: [...def] } };
        }),
      resetAllRbac: () =>
        set(() => ({
          roleDefs: DEFAULT_ROLES.map((r) => ({ ...r })),
          permissions: Object.fromEntries(
            Object.entries(DEFAULT_PERMISSIONS).map(([k, v]) => [k, [...v]]),
          ) as Record<Role, Resource[]>,
        })),

      setSimEnabled: (enabled) => set({ simEnabled: enabled }),
      markTickAt: (ts) => set({ lastTickAt: ts }),

      markTourCompleted: () => set({ tourCompletedAt: Date.now() }),
    }),
    {
      name: "rpms-demo-state",
      version: 1,
      partialize: (state) => ({
        activities: state.activities,
        approvals: state.approvals,
        autonomy: state.autonomy,
        draftLeases: state.draftLeases,
        draftProperties: state.draftProperties,
        draftUnits: state.draftUnits,
        draftParties: state.draftParties,
        tickets: state.tickets,
        templateOverrides: state.templateOverrides,
        rentPayments: state.rentPayments,
        rentReminders: state.rentReminders,
        partyAddresses: state.partyAddresses,
        leaseSignatures: state.leaseSignatures,
        leaseDocSettings: state.leaseDocSettings,
        currentUserId: state.currentUserId,
        roleDefs: state.roleDefs,
        permissions: state.permissions,
        tourCompletedAt: state.tourCompletedAt,
        lastTickAt: state.lastTickAt,
        simEnabled: state.simEnabled,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

/**
 * Selectors — keep components shallow & cheap.
 */
export const selectUnreadActivityCount = (s: DemoState) =>
  s.activities.filter((a) => !a.acked).length;

export const selectPendingApprovals = (s: DemoState) =>
  s.approvals.filter((a) => !a.decision);

export const selectDecidedApprovals = (s: DemoState) =>
  s.approvals.filter((a) => !!a.decision);
