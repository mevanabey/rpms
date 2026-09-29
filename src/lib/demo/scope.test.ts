import assert from "node:assert/strict";
import test from "node:test";

import type { AppUser } from "./identity";
import { canSeeLease, scopeByLease } from "./scope";

const assigned = ["lease-one", "lease-two"];
const leases = ["lease-one", "lease-other"].map((id) => ({ id }));

function user(role: string): AppUser {
  return { id: role, name: role, email: `${role}@example.test`, role, entities: [], assignedLeaseIds: assigned };
}

test("staff participant roles see only explicit lease assignments", () => {
  for (const role of ["lawyer", "accountant", "advisor"]) {
    assert.equal(canSeeLease(user(role), "lease-one"), true);
    assert.equal(canSeeLease(user(role), "lease-other"), false);
    assert.deepEqual(scopeByLease(user(role), leases, (lease) => lease.id), [leases[0]]);
  }
});

test("unassigned and unknown roles fail closed", () => {
  assert.deepEqual(scopeByLease(user("viewer"), leases, (lease) => lease.id), []);
  assert.equal(canSeeLease(user("viewer"), "lease-one"), false);
  assert.equal(canSeeLease({ ...user("lawyer"), assignedLeaseIds: [] }, "lease-one"), false);
});

test("portfolio operators retain portfolio access", () => {
  for (const role of ["admin", "account_manager"]) {
    assert.deepEqual(scopeByLease(user(role), leases, (lease) => lease.id), leases);
  }
});
