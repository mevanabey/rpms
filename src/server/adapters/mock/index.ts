import type { Backend } from "@/core/services";
import type {
  LedgerEntry,
  Lease,
  Notification,
  Obligation,
  Party,
  Property,
  Unit,
} from "@/core/types";

import { deriveObligationsAndLedger } from "./derive";
import { LEASES, LEDGER, NOTIFICATIONS, OBLIGATIONS, PARTIES, PROPERTIES, UNITS } from "./seed";

const derived = deriveObligationsAndLedger(LEASES);

// Module-scoped in-memory state. Resets on server restart — this is Phase 01.
const state = {
  leases: [...LEASES] as Lease[],
  parties: [...PARTIES] as Party[],
  properties: [...PROPERTIES] as Property[],
  units: [...UNITS] as Unit[],
  obligations: [...OBLIGATIONS, ...derived.obligations] as Obligation[],
  ledger: [...LEDGER, ...derived.ledger] as LedgerEntry[],
  notifications: [...NOTIFICATIONS] as Notification[],
};

const norm = (v: string) => v.toLowerCase();

export const mockBackend: Backend = {
  leases: {
    async list(filter) {
      let out = state.leases;
      if (filter?.status?.length) out = out.filter((l) => filter.status!.includes(l.status));
      if (filter?.propertyId) out = out.filter((l) => l.propertyId === filter.propertyId);
      if (filter?.cadence) out = out.filter((l) => l.paymentCadence === filter.cadence);
      if (filter?.search) {
        const q = norm(filter.search);
        out = out.filter((l) => norm(l.id).includes(q) || norm(l.propertyId).includes(q));
      }
      return out;
    },
    async get(id) {
      return state.leases.find((l) => l.id === id) ?? null;
    },
  },

  parties: {
    async list(filter) {
      let out = state.parties;
      if (filter?.search) {
        const q = norm(filter.search);
        out = out.filter(
          (p) =>
            norm(p.displayName).includes(q) ||
            (p.legalName ? norm(p.legalName).includes(q) : false) ||
            p.emails.some((e) => norm(e).includes(q)),
        );
      }
      // role filter would join through lease.additionalRoles — skipped in mock for now
      return out;
    },
    async get(id) {
      return state.parties.find((p) => p.id === id) ?? null;
    },
  },

  properties: {
    async listProperties() {
      return state.properties;
    },
    async getProperty(id) {
      return state.properties.find((p) => p.id === id) ?? null;
    },
    async listUnits(propertyId) {
      return propertyId ? state.units.filter((u) => u.propertyId === propertyId) : state.units;
    },
  },

  payments: {
    async listLedger(filter) {
      let out = state.ledger;
      if (filter?.leaseId) out = out.filter((e) => e.leaseId === filter.leaseId);
      if (filter?.kind?.length) out = out.filter((e) => filter.kind!.includes(e.kind));
      if (filter?.paid !== undefined) {
        out = out.filter((e) => Boolean(e.paidDate) === filter.paid);
      }
      if (filter?.from) out = out.filter((e) => e.dueDate >= filter.from!);
      if (filter?.to) out = out.filter((e) => e.dueDate <= filter.to!);
      return out;
    },
    async listObligations(leaseId) {
      return leaseId
        ? state.obligations.filter((o) => o.leaseId === leaseId)
        : state.obligations;
    },
    async inboxQueue() {
      return [];
    },
  },

  reminders: {
    async listQueue(filter) {
      let out = state.notifications;
      if (filter?.leaseId) out = out.filter((n) => n.leaseId === filter.leaseId);
      if (filter?.status?.length) out = out.filter((n) => filter.status!.includes(n.status));
      return out;
    },
    async enqueue(input) {
      const n: Notification = {
        ...input,
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        status: "queued",
      };
      state.notifications.push(n);
      return n;
    },
  },

  onboarding: {
    async initiate() {
      throw new Error("onboarding.initiate is not implemented in the mock adapter — Phase 02");
    },
    async status() {
      return null;
    },
  },
};
