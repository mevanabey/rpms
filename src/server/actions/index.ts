"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import type {
  LeaseCreateIntent,
  LeaseUpdateInput,
  MarkPaidInput,
  PartyCreateInput,
  PartyUpdateInput,
  PropertyCreateInput,
  PropertyUpdateInput,
  TrancheUpdateInput,
  UnitCreateInput,
} from "@/core/services";
import type { LedgerEntry, Lease, LeaseStatus, OnboardingStage, Party, Property, Unit } from "@/core/types";
import type { LeasePartyRole } from "@/core/types";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import { buildLeaseChecklistWorkbook } from "@/lib/checklist/export";
import { partyMap } from "@/lib/lookup";
import { requireAppUser } from "@/lib/auth/identity";
import { requireLeaseAccess } from "@/lib/auth/authorization";
import { LEASE_DOCUMENTS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildDataDict } from "@/templates/leases/lease-template-render";
import {
  fromLease,
  type LeaseDocumentData,
} from "@/templates/leases/lease-document-data";
import {
  DEFAULT_PERMISSIONS,
  can,
  rolesFor,
  type AppUser,
  type Resource,
} from "@/lib/demo/identity";
import { getBackend } from "@/server/container";
import { db, withAudit } from "@/server/db/client";
import { ledgerEntry as ledgerEntryTable, party as partyTable, userRole as userRoleTable } from "@/server/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { toParty } from "@/server/adapters/supabase/mappers";
import { leaseClausesPatchSchema } from "@/server/validation/lease-clauses";
import { getMailer } from "@/server/mail";
import { resolveLeaseRecipients } from "@/server/mail/lease-recipients";
import { buildLeaseEmail } from "@/templates/emails/lease-onboarding";

/**
 * Top-level data surfaces touched by writes. Mutations broadcast revalidate
 * through this list so the next render of any of these pages picks up the
 * change without a manual refresh.
 */
const DATA_PATHS = ["/", "/leases", "/rent", "/properties", "/parties"] as const;

function revalidateAll(): void {
  for (const p of DATA_PATHS) revalidatePath(p);
  revalidatePath("/leases/[id]", "page");
  revalidatePath("/properties/[id]", "page");
  revalidatePath("/parties/[id]", "page");
}

/**
 * Lease-scoped revalidation. Calls `revalidateAll()` for the list/index pages
 * and *also* invalidates the resolved `/leases/<id>` URL — pattern-only
 * invalidation (`/leases/[id]`) isn't reliably enough to flush the per-URL
 * RSC payload after a server action in Next.js 16, so the detail page can
 * keep showing stale `onboardingStage` until a hard reload. Adding the
 * concrete URL fixes the lease-progress panel never advancing.
 */
function revalidateLease(leaseId: string): void {
  revalidateAll();
  revalidatePath(`/leases/${leaseId}`);
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : String(e);
  let cleaned = msg;
  if (e instanceof Error && "cause" in e && e.cause instanceof Error) {
    cleaned = e.cause.message || msg;
  }
  return { ok: false, error: cleaned };
}

async function requireLedgerAccess(ledgerEntryId: string): Promise<void> {
  const [entry] = await db
    .select({ leaseId: ledgerEntryTable.leaseId })
    .from(ledgerEntryTable)
    .where(eq(ledgerEntryTable.id, ledgerEntryId))
    .limit(1);
  if (!entry) throw new Error("Ledger entry not found.");
  await requireLeaseAccess(entry.leaseId, "payments:write");
}

/**
 * Server-side RBAC. The permission matrix lives in
 * `src/lib/demo/identity.ts` and is the same map the client RoleGate /
 * sidebar use, so deny decisions match what the UI advertised.
 */
function userCan(user: AppUser, resource: Resource): boolean {
  return can(user, DEFAULT_PERMISSIONS, resource);
}

async function authorizeWrite(resource: Resource): Promise<AppUser> {
  const user = await requireAppUser();
  if (!userCan(user, resource)) {
    throw new Error(
      `Access denied. Role "${user.role}" lacks "${resource}". Ask an admin to grant it.`,
    );
  }
  return user;
}

const ASSIGNMENT_ROLES: Record<string, readonly string[]> = {
  lawyer: ["lessor_lawyer", "lessee_lawyer"],
  accountant: ["accountant_handler"],
  advisor: ["advisor"],
};

async function validateParticipants(roles: LeasePartyRole[] | undefined): Promise<void> {
  const linked = roles?.filter((role) => role.userId) ?? [];
  if (linked.length === 0) return;
  const ids = [...new Set(linked.map((role) => role.userId!))];
  const users = await db.select().from(userRoleTable).where(inArray(userRoleTable.userId, ids));
  const byId = new Map(users.map((user) => [user.userId, user]));
  for (const participant of linked) {
    const user = byId.get(participant.userId!);
    if (!user?.isActive || user.partyId !== participant.partyId ||
        !rolesFor(user).some((role) => ASSIGNMENT_ROLES[role]?.includes(participant.role))) {
      throw new Error("A system user must have a matching role and linked party before assignment.");
    }
  }
}

// ──────────────────────────────────────────────── Schemas

const moneyShape = z
  .object({
    amount: z.number().nonnegative(),
    currency: z.enum(["LKR", "USD"]),
  })
  .strict();

const PARTY_ROLES = [
  "lessor",
  "lessee",
  "client",
  "tenant",
  "introducer",
  "advisor",
  "lessor_lawyer",
  "lessee_lawyer",
  "accountant_handler",
  "witness",
] as const;

const partyCreateSchema = z
  .object({
    kind: z.enum(["individual", "company"]),
    displayName: z.string().min(1),
    legalName: z.string().optional(),
    nicOrPassport: z.string().optional(),
    companyRegNo: z.string().optional(),
    emails: z.array(z.string().email()).optional(),
    phones: z.array(z.string()).optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    legalEntityCode: z.string().optional(),
  })
  .strict();

const propertyCreateSchema = z
  .object({
    name: z.string().min(1),
    addressLine: z.string().min(1),
    city: z.string().min(1),
    district: z.string().optional(),
    lotNo: z.string().optional(),
    planNo: z.string().optional(),
    perches: z.number().nonnegative().optional(),
    asstNo: z.string().optional(),
    ownerPartyId: z.string().uuid().optional(),
    legalEntityCode: z.string().optional(),
  })
  .strict();

const unitCreateSchema = z
  .object({
    propertyId: z.string().uuid(),
    label: z.string().min(1),
    type: z.enum(["office", "apartment", "storage", "penthouse", "floor"]),
    floor: z.string().optional(),
    areaSqft: z.number().int().positive().optional(),
    bedrooms: z.number().int().nonnegative().optional(),
    status: z.enum(["vacant", "occupied", "reserved"]).optional(),
  })
  .strict();

const partyRoleEnum = z.enum([
  "lessor",
  "lessee",
  "client",
  "tenant",
  "introducer",
  "advisor",
  "lessor_lawyer",
  "lessee_lawyer",
  "accountant_handler",
  "witness",
]);

const trancheShape = z
  .object({
    sequence: z.number().int().positive(),
    startDate: z.string(),
    endDate: z.string(),
    monthlyRent: moneyShape,
    advanceSetoff: moneyShape.optional(),
    dueDayOfMonth: z.number().int().min(1).max(31),
    paymentDescription: z.string().optional(),
    fxRateLkrPerUsd: z.number().positive().optional(),
  })
  .strict();

const leaseCreateSchema = z
  .object({
    propertyId: z.string().uuid(),
    unitIds: z.array(z.string().uuid()),
    lessorPartyId: z.string().uuid(),
    lesseePartyId: z.string().uuid(),
    parentLeaseId: z.string().uuid().optional(),
    kind: z.enum(["head", "sub"]),
    purpose: z.enum(["commercial", "residential", "bpo"]),
    agreementLabel: z
      .enum(["lease_agreement", "rental_agreement", "other"])
      .optional(),
    agreementLabelOther: z.string().optional(),
    status: z
      .enum(["draft", "signed", "active", "grace", "terminated", "expired", "renewed"])
      .optional(),
    paymentCadence: z.enum(["monthly", "quarterly", "biannual"]),
    defaultPaymentMethod: z.enum([
      "lkr_cash",
      "lkr_transfer",
      "usd_transfer",
      "bank_draft",
      "cheque",
    ]),
    startDate: z.string(),
    endDate: z.string(),
    graceEndDate: z.string().optional(),
    lockInEndDate: z.string().optional(),
    advanceMonths: z.number().int().nonnegative().optional(),
    occupancyCap: z.number().int().positive().optional(),
    securityDeposit: moneyShape.optional(),
    stampDuty: moneyShape.optional(),
    legalFees: moneyShape.optional(),
    clauses: z.record(z.string(), z.unknown()).optional(),
    additionalRoles: z
      .array(z.object({ partyId: z.string().uuid(), role: partyRoleEnum, userId: z.string().uuid().optional() }))
      .optional(),
    tranches: z.array(trancheShape).min(1),
    legalEntityCode: z.string().optional(),
  })
  .strict();

const leaseUpdateSchema = z
  .object({
    lessorPartyId: z.string().uuid().optional(),
    lesseePartyId: z.string().uuid().optional(),
    purpose: z.enum(["commercial", "residential", "bpo"]).optional(),
    agreementLabel: z
      .enum(["lease_agreement", "rental_agreement", "other"])
      .nullish(),
    agreementLabelOther: z.string().nullish(),
    status: z
      .enum(["draft", "signed", "active", "grace", "terminated", "expired", "renewed"])
      .optional(),
    paymentCadence: z.enum(["monthly", "quarterly", "biannual"]).optional(),
    defaultPaymentMethod: z
      .enum(["lkr_cash", "lkr_transfer", "usd_transfer", "bank_draft", "cheque"])
      .optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    graceEndDate: z.string().nullish(),
    lockInEndDate: z.string().nullish(),
    advanceMonths: z.number().int().nonnegative().nullish(),
    occupancyCap: z.number().int().positive().nullish(),
    securityDeposit: moneyShape.nullish(),
    stampDuty: moneyShape.nullish(),
    legalFees: moneyShape.nullish(),
    // Clause bag — merged key-by-key by the adapter; `null` clears a clause.
    clauses: leaseClausesPatchSchema.optional(),
    // Relations — present means "replace the whole set".
    unitIds: z.array(z.string().uuid()).optional(),
    additionalRoles: z
      .array(
        z
          .object({
            partyId: z.string().uuid(),
            role: z.enum(PARTY_ROLES),
            userId: z.string().uuid().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

const trancheUpdateSchema = z
  .object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    monthlyRent: moneyShape.optional(),
    advanceSetoff: moneyShape.nullish(),
    dueDayOfMonth: z.number().int().min(1).max(31).optional(),
    paymentDescription: z.string().nullish(),
    fxRateLkrPerUsd: z.number().positive().nullish(),
  })
  .strict();

const partyUpdateSchema = z
  .object({
    kind: z.enum(["individual", "company"]).optional(),
    displayName: z.string().min(1).optional(),
    legalName: z.string().nullish(),
    nicOrPassport: z.string().nullish(),
    companyRegNo: z.string().nullish(),
    emails: z.array(z.string().email()).optional(),
    phones: z.array(z.string()).optional(),
    address: z.string().nullish(),
    notes: z.string().nullish(),
  })
  .strict();

const propertyUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    addressLine: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    district: z.string().nullish(),
    lotNo: z.string().nullish(),
    planNo: z.string().nullish(),
    perches: z.number().nonnegative().nullish(),
    asstNo: z.string().nullish(),
  })
  .strict();

const markPaidSchema = z
  .object({
    paidDate: z.string(),
    paymentMethod: z.enum([
      "lkr_cash",
      "lkr_transfer",
      "usd_transfer",
      "bank_draft",
      "cheque",
    ]),
    reference: z.string().optional(),
    notes: z.string().optional(),
    amount: moneyShape.optional(),
  })
  .strict();

// ──────────────────────────────────────────────── Actions

/** Explicitly link an existing Auth account to a contact record. No email matching. */
export async function prepareStaffPartyAction(
  userId: string,
  role: "lawyer" | "accountant" | "advisor",
  existingPartyId?: string,
): Promise<ActionResult<Party>> {
  try {
    const actor = await authorizeWrite("leases:write");
    z.string().uuid().parse(userId);
    if (existingPartyId) z.string().uuid().parse(existingPartyId);
    if (!ASSIGNMENT_ROLES[role]) throw new Error("Invalid staff role.");
    const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(userId);
    if (error || !data.user?.email) throw new Error("System user not found.");
    const authUser = data.user;
    const name = String(authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? authUser.email!.split("@")[0]);
    const contact = await withAudit(actor, "Staff contact linked", () => db.transaction(async (tx) => {
      await tx.execute(sql`select user_id from user_role where user_id = ${userId} for update`);
      const [linked] = await tx.select().from(userRoleTable).where(eq(userRoleTable.userId, userId)).limit(1);
      if (!linked?.isActive || !rolesFor(linked).includes(role)) {
        throw new Error("Select an active system user with the matching role.");
      }
      if (linked.partyId) {
        if (existingPartyId && existingPartyId !== linked.partyId) {
          throw new Error("This system user is already linked to a different contact.");
        }
        const [existing] = await tx.select().from(partyTable).where(eq(partyTable.id, linked.partyId)).limit(1);
        if (!existing) throw new Error("The linked contact no longer exists.");
        return toParty(existing);
      }
      if (existingPartyId) {
        const [existing] = await tx.select().from(partyTable).where(eq(partyTable.id, existingPartyId)).limit(1);
        if (!existing || existing.kind !== "individual") throw new Error("Select an individual contact to link.");
        const otherLinks = await tx.select({ userId: userRoleTable.userId }).from(userRoleTable)
          .where(eq(userRoleTable.partyId, existingPartyId));
        if (otherLinks.some((link) => link.userId !== userId)) {
          throw new Error("This contact is already linked to another account.");
        }
        await tx.update(userRoleTable).set({ partyId: existing.id, updatedAt: new Date() })
          .where(eq(userRoleTable.userId, userId));
        return toParty(existing);
      }
      const [created] = await tx.insert(partyTable).values({
        kind: "individual",
        displayName: name,
        emails: [authUser.email!],
        phones: [],
      }).returning();
      if (!created) throw new Error("Could not create staff contact.");
      await tx.update(userRoleTable).set({ partyId: created.id, updatedAt: new Date() })
        .where(eq(userRoleTable.userId, userId));
      return toParty(created);
    }));
    revalidateAll();
    return { ok: true, data: contact };
  } catch (e) {
    return fail(e);
  }
}

export async function createPartyAction(
  input: PartyCreateInput,
): Promise<ActionResult<Party>> {
  try {
    await authorizeWrite("parties:create");
    const parsed = partyCreateSchema.parse(input);
    const data = await getBackend().parties.create(parsed as PartyCreateInput);
    revalidateAll();
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function createPropertyAction(
  input: PropertyCreateInput,
): Promise<ActionResult<Property>> {
  try {
    await authorizeWrite("properties:create");
    const parsed = propertyCreateSchema.parse(input);
    const data = await getBackend().properties.createProperty(
      parsed as PropertyCreateInput,
    );
    revalidateAll();
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function createUnitAction(
  input: UnitCreateInput,
): Promise<ActionResult<Unit>> {
  try {
    await authorizeWrite("units:create");
    const parsed = unitCreateSchema.parse(input);
    const data = await getBackend().properties.createUnit(parsed as UnitCreateInput);
    revalidateAll();
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function createLeaseAction(
  intent: LeaseCreateIntent,
): Promise<ActionResult<Lease>> {
  try {
    await authorizeWrite("leases:create");
    const parsed = leaseCreateSchema.parse(intent);
    if (parsed.parentLeaseId) await requireLeaseAccess(parsed.parentLeaseId);
    await validateParticipants(parsed.additionalRoles);
    const data = await getBackend().leases.create(parsed as LeaseCreateIntent);
    revalidateAll();
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function updateLeaseStatusAction(
  id: string,
  status: LeaseStatus,
): Promise<ActionResult<Lease>> {
  try {
    z.string().uuid().parse(id);
    await requireLeaseAccess(id, "leases:write");
    const data = await getBackend().leases.updateStatus(id, status);
    revalidateLease(id);
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function updateLeaseAction(
  id: string,
  patch: LeaseUpdateInput,
): Promise<ActionResult<Lease>> {
  try {
    z.string().uuid().parse(id);
    await requireLeaseAccess(id, "leases:write");
    const parsed = leaseUpdateSchema.parse(patch);
    await validateParticipants(parsed.additionalRoles);
    const data = await getBackend().leases.update(id, parsed as LeaseUpdateInput);
    revalidateLease(id);
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Patch one rent-schedule tranche (the lease's contracted rent for a period).
 * Separate from `updateLeaseAction` because tranches are a relation, not a
 * lease column — see SPEC §7.
 */
export async function updateLeaseTrancheAction(
  leaseId: string,
  trancheId: string,
  patch: TrancheUpdateInput,
): Promise<ActionResult<Lease>> {
  try {
    z.string().uuid().parse(leaseId);
    await requireLeaseAccess(leaseId, "leases:write");
    z.string().uuid().parse(trancheId);
    const parsed = trancheUpdateSchema.parse(patch);
    const data = await getBackend().leases.updateTranche(
      leaseId,
      trancheId,
      parsed as TrancheUpdateInput,
    );
    revalidateLease(leaseId);
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Patch a party record. Note this edits the party everywhere it appears —
 * parties are shared across leases by design (SPEC §6).
 */
export async function updatePartyAction(
  id: string,
  patch: PartyUpdateInput,
): Promise<ActionResult<Party>> {
  try {
    await authorizeWrite("parties:write");
    z.string().uuid().parse(id);
    const parsed = partyUpdateSchema.parse(patch);
    const data = await getBackend().parties.update(id, parsed as PartyUpdateInput);
    revalidateAll();
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

/** Patch a property record — shared across every lease on that building. */
export async function updatePropertyAction(
  id: string,
  patch: PropertyUpdateInput,
): Promise<ActionResult<Property>> {
  try {
    await authorizeWrite("properties:write");
    z.string().uuid().parse(id);
    const parsed = propertyUpdateSchema.parse(patch);
    const data = await getBackend().properties.updateProperty(
      id,
      parsed as PropertyUpdateInput,
    );
    revalidateAll();
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLeaseAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    z.string().uuid().parse(id);
    await requireLeaseAccess(id, "leases:write");
    await getBackend().leases.softDelete(id);
    revalidateLease(id);
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
}

const VALID_STAGES = new Set<OnboardingStage>(["agreement_ready", "emails_sent", "at_accounts"]);

export async function setLeaseOnboardingStageAction(
  id: string,
  stage: OnboardingStage | null,
): Promise<ActionResult<Lease>> {
  try {
    z.string().uuid().parse(id);
    const user = await requireLeaseAccess(id, "leases:write");
    if (stage !== null && !VALID_STAGES.has(stage)) {
      throw new Error(`Invalid onboarding stage: ${stage}`);
    }
    const lease = await getBackend().leases.get(id);
    if (!lease) throw new Error("Lease not found.");
    if (stage === null && !rolesFor(user).includes("admin")) throw new Error("Only an admin can reset onboarding.");
    if (stage === "agreement_ready" && !lease.agreementPath) throw new Error("Generate or upload an agreement first.");
    if ((stage === "emails_sent" || stage === "at_accounts") && (!lease.lawyerEmailSentAt || !lease.advisorEmailSentAt)) throw new Error("Confirm the lawyer and advisor emails first.");
    if (stage === "at_accounts" && !lease.accountsEmailSentAt) throw new Error("Confirm the accounts email first.");
    const data = await getBackend().leases.setOnboardingStage(id, stage);
    revalidateLease(id);
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

const ALLOWED_AGREEMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};

/**
 * Single round-trip: server reads the tagged template from public/, fills it
 * with the lease's data via docxtemplater, uploads to Storage, marks the
 * agreement generated, and returns a signed URL for the client to download.
 * Avoids the client-side render → client-built-FormData → upload chain that
 * trips Next.js' server-action multipart layer in dev.
 */
export async function generateLeaseAgreementAction(
  leaseId: string,
): Promise<ActionResult<{ lease: Lease; url: string; path: string }>> {
  try {
    z.string().uuid().parse(leaseId);
    await requireLeaseAccess(leaseId, "leases:write");

    const backend = getBackend();
    const lease = await backend.leases.get(leaseId);
    if (!lease) throw new Error(`Lease ${leaseId} not found`);

    const [parties, property, units] = await Promise.all([
      backend.parties.list(),
      backend.properties.getProperty(lease.propertyId),
      backend.properties.listUnits(lease.propertyId),
    ]);
    const data = fromLease(lease, property ?? undefined, units, partyMap(parties));

    const purpose: "residential" | "commercial" =
      data.purpose === "residential" ? "residential" : "commercial";
    const templatePath = resolve(process.cwd(), `public/lease-templates/${purpose}.docx`);
    const templateBuf = await readFile(templatePath);
    const zip = new PizZip(templateBuf);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(buildDataDict(data));
    const out = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;

    const path = `${leaseId}/agreement-${Date.now()}.docx`;
    const sb = getSupabaseAdmin();
    const { error: upErr } = await sb.storage
      .from(LEASE_DOCUMENTS_BUCKET)
      .upload(path, out, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const updated = await withAudit(await requireAppUser(), "Lease agreement generated", () => backend.leases.markAgreementGenerated(leaseId, path), { path });

    const { data: urlData, error: urlErr } = await sb.storage
      .from(LEASE_DOCUMENTS_BUCKET)
      .createSignedUrl(path, 60 * 10);
    if (urlErr || !urlData) {
      throw new Error(`Could not generate signed URL: ${urlErr?.message ?? "unknown"}`);
    }

    revalidateLease(leaseId);
    return { ok: true, data: { lease: updated, url: urlData.signedUrl, path } };
  } catch (e) {
    console.error("[generateLeaseAgreementAction]", e);
    return fail(e);
  }
}

export async function uploadLeaseAgreementAction(
  leaseId: string,
  formData: FormData,
): Promise<ActionResult<Lease>> {
  try {
    z.string().uuid().parse(leaseId);
    await requireLeaseAccess(leaseId, "leases:write");
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("No file provided.");
    if (file.size === 0) throw new Error("Uploaded file is empty.");
    if (file.size > MAX_SIGNED_LEASE_BYTES) {
      throw new Error(`File is larger than ${MAX_SIGNED_LEASE_BYTES / (1024 * 1024)} MB.`);
    }
    const ext = ALLOWED_AGREEMENT_TYPES[file.type];
    if (!ext) {
      throw new Error(`Unsupported file type: ${file.type || "unknown"}. Upload a PDF or Word document.`);
    }
    const path = `${leaseId}/agreement-${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sb = getSupabaseAdmin();
    const { error: upErr } = await sb.storage
      .from(LEASE_DOCUMENTS_BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
    const data = await withAudit(await requireAppUser(), "Lease agreement uploaded", () => getBackend().leases.markAgreementGenerated(leaseId, path), { filename: file.name, path, bytes: file.size });
    revalidateLease(leaseId);
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

/** Called when the user clicks "Generate Lease Agreement" — the client has
 *  already produced + downloaded the .docx; this records the storage path of
 *  the persisted copy (uploaded by the client too) and advances the stage.
 *
 *  In this turn the client uploads the generated bytes via
 *  `uploadLeaseAgreementAction` (same code path as a manual upload). This
 *  action stays in the file as a fallback for a bytes-less mark. */
export async function markLeaseAgreementGeneratedAction(
  leaseId: string,
  storagePath: string,
): Promise<ActionResult<Lease>> {
  try {
    z.string().uuid().parse(leaseId);
    await requireLeaseAccess(leaseId, "leases:write");
    z.string().min(1).parse(storagePath);
    if (!storagePath.startsWith(`${leaseId}/`) || storagePath.includes("..")) throw new Error("Invalid lease document path.");
    const data = await getBackend().leases.markAgreementGenerated(leaseId, storagePath);
    revalidateLease(leaseId);
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Sends one lease-onboarding email and, only if the transport accepted it,
 * advances the onboarding stage.
 *
 * Ordering matters: send first, record second. Marking the stage before a
 * confirmed send would let a failed delivery show as "sent 30 Jul" on the
 * stepper, and the operator would never know the lawyer wasn't told.
 */
export async function sendLeaseEmailAction(
  leaseId: string,
  kind: "lawyer" | "advisor" | "accounts",
): Promise<ActionResult<Lease & { emailedTo: string[]; redirected: boolean }>> {
  try {
    z.string().uuid().parse(leaseId);
    const user = await requireLeaseAccess(leaseId, "leases:write");
    if (kind !== "lawyer" && kind !== "advisor" && kind !== "accounts") {
      throw new Error(`Invalid email kind: ${kind}`);
    }

    const backend = getBackend();
    const lease = await backend.leases.get(leaseId);
    if (!lease) throw new Error(`Lease ${leaseId} not found`);

    const [parties, property, units] = await Promise.all([
      backend.parties.list(),
      backend.properties.getProperty(lease.propertyId),
      backend.properties.listUnits(lease.propertyId),
    ]);
    const byId = partyMap(parties);
    const linkedUsers = new Map<string, { email: string; name?: string }>();
    const staffIds = [...new Set((lease.additionalRoles ?? []).flatMap((role) => role.userId ? [role.userId] : []))];
    await Promise.all(staffIds.map(async (id) => {
      const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(id);
      if (error || !data.user?.email) throw new Error("A linked system user no longer has an email address.");
      linkedUsers.set(id, {
        email: data.user.email,
        name: String(data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? data.user.email.split("@")[0]),
      });
    }));
    const to = resolveLeaseRecipients(lease, kind, byId, linkedUsers);

    const alreadySent = kind === "lawyer" ? lease.lawyerEmailSentAt : kind === "advisor" ? lease.advisorEmailSentAt : lease.accountsEmailSentAt;
    if (alreadySent) throw new Error("This email has already been confirmed as sent.");
    if (lease.status !== "draft" || (kind === "accounts" ? lease.onboardingStage !== "emails_sent" : lease.onboardingStage !== "agreement_ready")) {
      throw new Error("Complete the preceding workflow step before sending this email.");
    }
    if (process.env.MAIL_TRANSPORT !== "smtp") {
      throw new Error("Email delivery is not configured. Send the email outside RPMS, then use the manual confirmation.");
    }

    const attachments = await loadAgreementAttachment(lease);
    const body = buildLeaseEmail({
      kind,
      leaseRef: leaseRef(lease, property, units),
      propertyName: property?.name ?? "—",
      unitLabels: units.filter((u) => lease.unitIds.includes(u.id)).map((u) => u.label),
      lessorName: byId.get(lease.lessorPartyId)?.displayName ?? "—",
      lesseeName: byId.get(lease.lesseePartyId)?.displayName ?? "—",
      startDate: lease.startDate,
      endDate: lease.endDate,
      monthlyRent: lease.tranches[0]?.monthlyRent,
      securityDeposit: lease.securityDeposit,
      leaseUrl: await absoluteUrl(`/leases/${leaseId}`),
      sender: { name: user.name, email: user.email },
      hasAgreement: attachments.length > 0,
    });

    const result = await getMailer().send({ ...body, to, attachments });
    if (result.redirected || result.rejected.length || !to.every((recipient) => result.accepted.some((address) => address.toLowerCase() === recipient.email.toLowerCase()))) {
      throw new Error("The email did not reach all intended recipients. The workflow has not advanced; use manual confirmation after sending it to them.");
    }

    const data = await withAudit(user, "Lease email sent", () => backend.leases.markLeaseEmailSent(leaseId, kind), {
      kind, recipients: to.map((recipient) => recipient.email), method: "email", redirected: result.redirected,
    });
    revalidateLease(leaseId);
    return {
      ok: true,
      data: {
        ...data,
        emailedTo: to.map((a) => a.email),
        redirected: result.redirected,
      },
    };
  } catch (e) {
    console.error("[sendLeaseEmailAction]", e);
    return fail(e);
  }
}

/** Records an email sent outside RPMS and uses the same guarded stage rules. */
export async function markLeaseEmailManuallySentAction(
  leaseId: string,
  input: { kind: "lawyer" | "advisor" | "accounts"; recipients: string[]; note: string },
): Promise<ActionResult<Lease>> {
  try {
    z.string().uuid().parse(leaseId);
    const user = await requireLeaseAccess(leaseId, "leases:write");
    const parsed = z.object({
      kind: z.enum(["lawyer", "advisor", "accounts"]),
      recipients: z.array(z.string().trim().email()).min(1).max(30),
      note: z.string().trim().min(3, "Add a note identifying the email sent.").max(2000),
    }).strict().parse(input);
    const data = await withAudit(user, "Email marked sent manually", () =>
      getBackend().leases.markLeaseEmailSent(leaseId, parsed.kind), { ...parsed, method: "manual" });
    revalidateLease(leaseId);
    return { ok: true, data };
  } catch (e) { return fail(e); }
}

/** Short human reference for subject lines: "Lucky Seven — L4, L5". */
function leaseRef(lease: Lease, property: Property | null, units: Unit[]): string {
  const labels = units.filter((u) => lease.unitIds.includes(u.id)).map((u) => u.label);
  const name = property?.name ?? "Lease";
  return labels.length > 0 ? `${name} — ${labels.join(", ")}` : name;
}

/**
 * Pulls the generated agreement out of Storage so it rides along with the
 * email. A missing or unreadable document is not fatal — the template says so
 * explicitly and the send still goes out, because chasing a lawyer with the
 * details is better than blocking the pipeline on a storage hiccup.
 */
async function loadAgreementAttachment(
  lease: Lease,
): Promise<{ filename: string; content: Uint8Array; contentType: string }[]> {
  if (!lease.agreementPath) return [];
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.storage
      .from(LEASE_DOCUMENTS_BUCKET)
      .download(lease.agreementPath);
    if (error || !data) throw new Error(error?.message ?? "empty download");
    const ext = lease.agreementPath.split(".").pop()?.toLowerCase() ?? "docx";
    return [
      {
        filename: `lease-agreement.${ext}`,
        content: new Uint8Array(await data.arrayBuffer()),
        contentType:
          ext === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ];
  } catch (e) {
    console.error("[sendLeaseEmailAction] could not attach agreement", e);
    return [];
  }
}

/** Absolute URL for links in emails, derived from the request's own host. */
async function absoluteUrl(path: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}

export async function markLeaseActiveAction(
  leaseId: string,
): Promise<ActionResult<Lease & { rentEntriesCreated: number }>> {
  try {
    z.string().uuid().parse(leaseId);
    const user = await requireLeaseAccess(leaseId, "leases:write");
    const backend = getBackend();
    const { data, result } = await withAudit(user, "Lease activated", async () => {
      const data = await backend.leases.markLeaseActive(leaseId);
      const result = await backend.leases.generateRentSchedule(leaseId);
      return { data, result };
    });
    // Pre-create the unpaid monthly rent ledger entries so the Rent /
    // Recent ledger / Mark-as-Paid surfaces all see them immediately. Safe
    // to re-run — generateRentSchedule skips months that already exist.
    revalidateLease(leaseId);
    return { ok: true, data: { ...data, rentEntriesCreated: result.created } };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Manual trigger for the rent-schedule materialisation — useful when a lease
 * was activated before this code shipped, or when tranches change and new
 * months need to be added. Idempotent.
 */
export async function generateRentScheduleAction(
  leaseId: string,
): Promise<ActionResult<{ created: number; skipped: number }>> {
  try {
    z.string().uuid().parse(leaseId);
    await requireLeaseAccess(leaseId, "leases:write");
    const result = await getBackend().leases.generateRentSchedule(leaseId);
    revalidateLease(leaseId);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e);
  }
}

export async function getLeaseAgreementUrlAction(
  leaseId: string,
): Promise<ActionResult<{ url: string; path: string }>> {
  try {
    z.string().uuid().parse(leaseId);
    await requireLeaseAccess(leaseId, "leases:read");
    const lease = await getBackend().leases.get(leaseId);
    if (!lease) throw new Error(`Lease ${leaseId} not found`);
    if (!lease.agreementPath) throw new Error("No lease agreement has been generated or uploaded yet.");
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.storage
      .from(LEASE_DOCUMENTS_BUCKET)
      .createSignedUrl(lease.agreementPath, 60 * 10);
    if (error || !data) throw new Error(`Could not generate signed URL: ${error?.message ?? "unknown"}`);
    return { ok: true, data: { url: data.signedUrl, path: lease.agreementPath } };
  } catch (e) {
    return fail(e);
  }
}

const ALLOWED_SIGNED_LEASE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};
const MAX_SIGNED_LEASE_BYTES = 25 * 1024 * 1024; // 25 MB

export async function uploadSignedLeaseAction(
  leaseId: string,
  formData: FormData,
): Promise<ActionResult<Lease>> {
  try {
    z.string().uuid().parse(leaseId);
    const user = await requireLeaseAccess(leaseId, "leases:write");
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("No file provided.");
    }
    if (file.size === 0) {
      throw new Error("Uploaded file is empty.");
    }
    if (file.size > MAX_SIGNED_LEASE_BYTES) {
      throw new Error(`File is larger than ${MAX_SIGNED_LEASE_BYTES / (1024 * 1024)} MB.`);
    }
    const ext = ALLOWED_SIGNED_LEASE_TYPES[file.type];
    if (!ext) {
      throw new Error(`Unsupported file type: ${file.type || "unknown"}. Upload a PDF or Word document.`);
    }

    const path = `${leaseId}/signed-${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sb = getSupabaseAdmin();
    const { error: upErr } = await sb.storage
      .from(LEASE_DOCUMENTS_BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (upErr) {
      throw new Error(`Upload failed: ${upErr.message}`);
    }

    const backend = getBackend();
    const data = await withAudit(user, "Signed lease uploaded", async () => {
      const data = await backend.leases.attachSignedLease(leaseId, path);
      await backend.leases.generateRentSchedule(leaseId);
      return data;
    }, { filename: file.name, path, bytes: file.size });
    revalidateLease(leaseId);
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Export the lease as an .xlsx intake checklist, laid out like the firm's own
 * check lists (see `src/lib/checklist/export.ts`). Returns the workbook
 * base64-encoded; the caller turns it into a download.
 */
export async function exportLeaseChecklistAction(
  leaseId: string,
): Promise<ActionResult<{ fileName: string; base64: string }>> {
  try {
    z.string().uuid().parse(leaseId);
    await requireLeaseAccess(leaseId, "leases:read");

    const backend = getBackend();
    const lease = await backend.leases.get(leaseId);
    if (!lease) throw new Error(`Lease ${leaseId} not found`);

    const [parties, property, units] = await Promise.all([
      backend.parties.list(),
      backend.properties.getProperty(lease.propertyId),
      backend.properties.listUnits(lease.propertyId),
    ]);

    const data = buildLeaseChecklistWorkbook(
      { lease, property: property ?? undefined, units, parties },
      new Date().toISOString().slice(0, 10),
    );
    return { ok: true, data };
  } catch (e) {
    console.error("[exportLeaseChecklistAction]", e);
    return fail(e);
  }
}

export async function getSignedLeaseUrlAction(
  leaseId: string,
): Promise<ActionResult<{ url: string; path: string }>> {
  try {
    z.string().uuid().parse(leaseId);
    await requireLeaseAccess(leaseId, "leases:read");
    const lease = await getBackend().leases.get(leaseId);
    if (!lease) throw new Error(`Lease ${leaseId} not found`);
    if (!lease.signedLeasePath) throw new Error("No signed lease has been uploaded for this lease.");
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.storage
      .from(LEASE_DOCUMENTS_BUCKET)
      .createSignedUrl(lease.signedLeasePath, 60 * 10); // 10 minutes
    if (error || !data) {
      throw new Error(`Could not generate signed URL: ${error?.message ?? "unknown"}`);
    }
    return { ok: true, data: { url: data.signedUrl, path: lease.signedLeasePath } };
  } catch (e) {
    return fail(e);
  }
}

export async function loadLeaseDocumentDataAction(
  leaseId: string,
): Promise<ActionResult<LeaseDocumentData>> {
  try {
    z.string().uuid().parse(leaseId);
    await requireLeaseAccess(leaseId, "leases:read");
    const backend = getBackend();
    const lease = await backend.leases.get(leaseId);
    if (!lease) {
      throw new Error(`Lease ${leaseId} not found`);
    }
    const [parties, property, units] = await Promise.all([
      backend.parties.list(),
      backend.properties.getProperty(lease.propertyId),
      backend.properties.listUnits(lease.propertyId),
    ]);
    const data = fromLease(lease, property ?? undefined, units, partyMap(parties));
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function markRentPaidAction(
  ledgerEntryId: string,
  input: MarkPaidInput,
): Promise<ActionResult<LedgerEntry>> {
  try {
    z.string().uuid().parse(ledgerEntryId);
    await requireLedgerAccess(ledgerEntryId);
    const parsed = markPaidSchema.parse(input);
    const data = await getBackend().payments.markPaid(
      ledgerEntryId,
      parsed as MarkPaidInput,
    );
    revalidateLease(data.leaseId);
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function unmarkRentPaidAction(
  ledgerEntryId: string,
): Promise<ActionResult<LedgerEntry>> {
  try {
    z.string().uuid().parse(ledgerEntryId);
    await requireLedgerAccess(ledgerEntryId);
    const data = await getBackend().payments.unmarkPaid(ledgerEntryId);
    revalidateLease(data.leaseId);
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function markNextRentPaidAction(
  leaseId: string,
  input: MarkPaidInput,
): Promise<ActionResult<LedgerEntry>> {
  try {
    z.string().uuid().parse(leaseId);
    await requireLeaseAccess(leaseId, "payments:write");
    const parsed = markPaidSchema.parse(input);
    const data = await getBackend().payments.markNextRentPaid(
      leaseId,
      parsed as MarkPaidInput,
    );
    revalidateLease(leaseId);
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}
