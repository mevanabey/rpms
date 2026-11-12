import assert from "node:assert/strict";
import test from "node:test";

import type { Backend, LeaseListFilter, PaymentListFilter } from "@/core/services";
import type { AppUser } from "@/lib/demo/identity";
import { scopedLeaseIds } from "@/lib/demo/scope";
import { mockBackend } from "./adapters/mock";
import { secureBackend } from "./secured-backend";

function actor(overrides: Partial<AppUser> = {}): AppUser {
  return { id: "staff", name: "Staff", email: "staff@example.test", role: "lawyer", entities: [], ...overrides };
}

test("requested lease scope can only narrow the verified user's access", () => {
  const user = actor({ assignedLeaseIds: ["assigned"], createdLeaseIds: ["created", "assigned"] });
  assert.deepEqual(scopedLeaseIds(user), ["assigned", "created"]);
  assert.deepEqual(scopedLeaseIds(user, ["other", "created"]), ["created"]);
  assert.deepEqual(scopedLeaseIds(user, []), []);
  assert.deepEqual(scopedLeaseIds(actor()), []);
  assert.equal(scopedLeaseIds(actor({ role: "admin" })), undefined);
  assert.deepEqual(scopedLeaseIds(actor({ role: "admin" }), ["requested"]), ["requested"]);
});

test("lease overview pushes authorization into the adapter and filters its result", async () => {
  const seed = await mockBackend.leases.listOverview();
  assert.ok(seed.length > 1);
  let received: LeaseListFilter | undefined;
  let calls = 0;
  const backend: Backend = {
    ...mockBackend,
    leases: {
      ...mockBackend.leases,
      async listOverview(filter) { received = filter; calls++; return seed; },
    },
  };
  const allowed = seed[0].lease.id;
  const secured = secureBackend(backend, async () => actor({ assignedLeaseIds: [allowed] }));
  assert.deepEqual(await secured.leases.listOverview(), [seed[0]]);
  assert.deepEqual(received?.ids, [allowed]);
  assert.deepEqual(await secured.leases.listOverview({ ids: [seed[1].lease.id] }), []);
  assert.equal(calls, 1, "an inaccessible filter must not reach the database");
  assert.deepEqual(await secureBackend(backend, async () => actor()).leases.listOverview(), []);
  assert.equal(calls, 1);
});

test("lease detail rejects an inaccessible root before querying", async () => {
  let calls = 0;
  const backend: Backend = {
    ...mockBackend,
    leases: { ...mockBackend.leases, async getDetails() { calls++; return null; } },
  };
  assert.equal(await secureBackend(backend, async () => actor()).leases.getDetails("other"), null);
  assert.equal(calls, 0);
});

test("lease detail excludes inaccessible relatives and their contacts", async () => {
  const [root, relative] = await mockBackend.leases.list();
  assert.ok(root && relative);
  const details = await mockBackend.leases.getDetails(root.id);
  assert.ok(details);
  const foreignParty = { id: "unrelated-contact", kind: "individual" as const, displayName: "Private", emails: [], phones: [] };
  const foreignLease = { ...relative, id: "unrelated-lease", lessorPartyId: foreignParty.id, lesseePartyId: foreignParty.id, additionalRoles: [] };
  const backend: Backend = {
    ...mockBackend,
    leases: { ...mockBackend.leases, async getDetails() {
      return { ...details, relatedLeases: [foreignLease], parties: [...details.parties, foreignParty] };
    } },
  };
  const scoped = await secureBackend(backend, async () => actor({ assignedLeaseIds: [root.id] })).leases.getDetails(root.id);
  assert.ok(scoped);
  assert.deepEqual(scoped.relatedLeases, []);
  assert.equal(scoped.parties.some((party) => party.id === foreignParty.id), false);
  const admin = await secureBackend(backend, async () => actor({ role: "admin" })).leases.getDetails(root.id);
  assert.equal(admin?.relatedLeases[0].id, foreignLease.id);
  assert.equal(admin?.parties.some((party) => party.id === foreignParty.id), true);
});

test("ledger scope is applied before the adapter and inaccessible leases are skipped", async () => {
  let received: PaymentListFilter | undefined;
  let calls = 0;
  const backend: Backend = {
    ...mockBackend,
    payments: { ...mockBackend.payments, async listLedger(filter) { received = filter; calls++; return []; } },
  };
  const scoped = secureBackend(backend, async () => actor({ createdLeaseIds: ["created"] }));
  await scoped.payments.listLedger({ kind: ["rent"] });
  assert.deepEqual(received, { kind: ["rent"], leaseIds: ["created"] });
  assert.deepEqual(await scoped.payments.listLedger({ leaseId: "other" }), []);
  assert.deepEqual(await scoped.payments.listLedger({ leaseIds: [] }), []);
  assert.equal(calls, 1);
});

test("mock reads honor explicit empty scopes and retain lease detail relations", async () => {
  assert.deepEqual(await mockBackend.leases.list({ ids: [] }), []);
  assert.deepEqual(await mockBackend.leases.listOverview({ ids: [] }), []);
  assert.deepEqual(await mockBackend.payments.listLedger({ leaseIds: [] }), []);
  const [row] = await mockBackend.leases.listOverview();
  assert.ok(row);
  const details = await mockBackend.leases.getDetails(row.lease.id);
  assert.equal(details?.lease.id, row.lease.id);
  assert.equal(details?.property?.id, row.lease.propertyId);
  assert.ok(details?.relatedLeases.every((lease) => lease.id === row.lease.parentLeaseId || lease.parentLeaseId === row.lease.id));
});
