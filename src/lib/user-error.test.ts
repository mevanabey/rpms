import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { userErrorMessage } from "./user-error";

test("shared errors translate technical failures and preserve actionable business rules", () => {
  assert.match(userErrorMessage(new Error("Access denied: payments:write.")), /administrator/);
  assert.match(userErrorMessage(new Error("Not authenticated.")), /Sign in again/);
  assert.match(userErrorMessage(new TypeError("Failed to fetch")), /check whether your change was saved/);
  assert.doesNotMatch(userErrorMessage(new Error("Failed query: select secret from leases")), /select|secret/);
  assert.doesNotMatch(userErrorMessage(new Error("An error occurred in the Server Components render. digest: 123")), /digest|Components/);
  assert.equal(userErrorMessage(new Error("Add a rent schedule before approving.")), "Add a rent schedule before approving.");
});

test("validation errors name the field and selected payment without JSON", () => {
  const schema = z.object({ notes: z.string().max(4000), receipts: z.array(z.object({ reference: z.string().max(200) })) });
  const result = schema.safeParse({ notes: "x".repeat(4001), receipts: [{ reference: "x".repeat(201) }] });
  assert.equal(result.success, false);
  if (result.success) return;
  const message = userErrorMessage(result.error);
  assert.match(message, /Notes must be 4,000 characters or fewer/);
  assert.match(message, /Payment reference for selected payment 1 must be 200 characters/);
  assert.doesNotMatch(message, /too_big|Zod|"path"/);
});
