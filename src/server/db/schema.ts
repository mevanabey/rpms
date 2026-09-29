/**
 * Drizzle schema — Postgres source of truth for RPMS.
 *
 * Scope: MVP routes (SPEC §0.1) — Dashboard, /properties, /leases, /rent,
 * /admin/*. Notification, workflow_run, maintenance_ticket,
 * introducer_commission, audit_log are intentionally deferred until their
 * routes come back on; add them here when they do.
 *
 * Conventions:
 * - UUIDs everywhere (`gen_random_uuid()`); IDs in the domain layer stay
 *   `string`, no transformation needed.
 * - Money split into `<field>_amount` (numeric(20,2)) + `<field>_currency`
 *   (varchar(3)) — keeps SQL aggregations trivial. Ledger is still the only
 *   source of truth for "paid" (CLAUDE.md §7).
 * - ISO YYYY-MM-DD calendar values are `date`; timestamps are `timestamptz`.
 * - Status / kind / role enums use `pgEnum` where the set is stable; roles in
 *   `user_role` stay `varchar` because they're runtime-editable (SPEC §21).
 * - JSONB for nested clause data and import provenance.
 */

import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ───────────────────────────────────────────────────────── Enums

export const currencyEnum = pgEnum("currency", ["LKR", "USD"]);

export const partyKindEnum = pgEnum("party_kind", ["individual", "company"]);

export const partyRoleEnum = pgEnum("party_role", [
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

export const unitTypeEnum = pgEnum("unit_type", [
  "office",
  "apartment",
  "storage",
  "penthouse",
  "floor",
]);

export const unitStatusEnum = pgEnum("unit_status", [
  "vacant",
  "occupied",
  "reserved",
]);

export const leaseKindEnum = pgEnum("lease_kind", ["head", "sub"]);

export const leasePurposeEnum = pgEnum("lease_purpose", [
  "commercial",
  "residential",
  "bpo",
]);

export const leaseStatusEnum = pgEnum("lease_status", [
  "draft",
  "signed",
  "active",
  "grace",
  "terminated",
  "expired",
  "renewed",
]);

export const paymentCadenceEnum = pgEnum("payment_cadence", [
  "monthly",
  "quarterly",
  "biannual",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "lkr_cash",
  "lkr_transfer",
  "usd_transfer",
  "bank_draft",
  "cheque",
]);

export const ledgerKindEnum = pgEnum("ledger_kind", [
  "rent",
  "deposit",
  "stamp_duty",
  "legal_fees",
  "vat",
  "late_fee",
  "refund",
  "commission",
  "adjustment",
]);

export const ledgerDirectionEnum = pgEnum("ledger_direction", ["in", "out"]);

export const obligationKindEnum = pgEnum("obligation_kind", [
  "rent_due",
  "deposit_due",
  "stamp_duty",
  "legal_fees",
  "insurance",
  "lift_service",
  "generator_service",
  "fire_inspection",
  "vat_reimbursement",
  "colour_wash",
  "renewal_notice",
  "termination_notice",
  "grace_end",
  "lockin_end",
  "escalation",
  "lease_expiry",
  "statue_inspection",
]);

export const obligationStatusEnum = pgEnum("obligation_status", [
  "pending",
  "done",
  "overdue",
  "waived",
]);

export const documentKindEnum = pgEnum("document_kind", [
  "lease_draft",
  "lease_signed",
  "invoice",
  "receipt",
  "kyc_id",
  "company_reg",
  "stamp_duty_receipt",
  "vat_invoice",
  "notice",
  "payment_proof",
]);

export const documentSignedStatusEnum = pgEnum("document_signed_status", [
  "unsigned",
  "sent",
  "signed",
  "declined",
]);

// ───────────────────────────────────────────────────────── Legal entity

/**
 * Capital Trust group entities (CTH, CTP-1, CTR, TCL, CBPO, ColBPO).
 * Every lease, party, property, document is owned by exactly one. Server-side
 * scoping checks this column (CLAUDE.md §5).
 */
export const legalEntity = pgTable("legal_entity", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  name: text("name").notNull(),
  registrationNo: varchar("registration_no", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ───────────────────────────────────────────────────────── Party

export const party = pgTable(
  "party",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legalEntityId: uuid("legal_entity_id").references(() => legalEntity.id, {
      onDelete: "set null",
    }),
    kind: partyKindEnum("kind").notNull(),
    displayName: text("display_name").notNull(),
    legalName: text("legal_name"),
    nicOrPassport: varchar("nic_or_passport", { length: 32 }),
    companyRegNo: varchar("company_reg_no", { length: 64 }),
    emails: text("emails").array().notNull().default([]),
    phones: text("phones").array().notNull().default([]),
    address: text("address"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("party_display_name_idx").on(t.displayName)],
);

// ───────────────────────────────────────────────────────── Property + unit

export const property = pgTable("property", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalEntityId: uuid("legal_entity_id")
    .notNull()
    .references(() => legalEntity.id, { onDelete: "restrict" }),
  ownerPartyId: uuid("owner_party_id").references(() => party.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  addressLine: text("address_line").notNull(),
  city: text("city").notNull(),
  district: text("district"),
  lotNo: varchar("lot_no", { length: 64 }),
  planNo: varchar("plan_no", { length: 64 }),
  perches: numeric("perches", { precision: 10, scale: 2 }),
  asstNo: varchar("asst_no", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const unit = pgTable(
  "unit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    type: unitTypeEnum("type").notNull(),
    floor: varchar("floor", { length: 32 }),
    areaSqft: integer("area_sqft"),
    bedrooms: integer("bedrooms"),
    status: unitStatusEnum("status").notNull().default("vacant"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("unit_property_idx").on(t.propertyId)],
);

// ───────────────────────────────────────────────────────── Lease

export const lease = pgTable(
  "lease",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "restrict" }),
    lessorPartyId: uuid("lessor_party_id")
      .notNull()
      .references(() => party.id, { onDelete: "restrict" }),
    lesseePartyId: uuid("lessee_party_id")
      .notNull()
      .references(() => party.id, { onDelete: "restrict" }),
    parentLeaseId: uuid("parent_lease_id"),

    kind: leaseKindEnum("kind").notNull(),
    purpose: leasePurposeEnum("purpose").notNull(),
    agreementLabel: varchar("agreement_label", { length: 32 }),
    agreementLabelOther: text("agreement_label_other"),

    status: leaseStatusEnum("status").notNull().default("draft"),
    paymentCadence: paymentCadenceEnum("payment_cadence")
      .notNull()
      .default("monthly"),
    defaultPaymentMethod: paymentMethodEnum("default_payment_method").notNull(),

    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    graceEndDate: date("grace_end_date"),
    lockInEndDate: date("lock_in_end_date"),
    advanceMonths: integer("advance_months"),
    occupancyCap: integer("occupancy_cap"),

    securityDepositAmount: numeric("security_deposit_amount", {
      precision: 20,
      scale: 2,
    }),
    securityDepositCurrency: currencyEnum("security_deposit_currency"),
    stampDutyAmount: numeric("stamp_duty_amount", { precision: 20, scale: 2 }),
    stampDutyCurrency: currencyEnum("stamp_duty_currency"),
    legalFeesAmount: numeric("legal_fees_amount", { precision: 20, scale: 2 }),
    legalFeesCurrency: currencyEnum("legal_fees_currency"),

    /** Clause-level intake data (handler checklist). See LeaseClauses type. */
    clauses: jsonb("clauses"),
    /** Raw source row when migrated from XLSX. */
    importMeta: jsonb("import_meta"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Soft delete — non-null means hidden everywhere. Row is never physically
     *  removed so history/audit and child references survive. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** Path inside the Supabase Storage `lease-documents` bucket where the
     *  executed lease is stored (e.g. `<leaseId>/signed.pdf`). Non-null means
     *  the lease has been signed and uploaded — status transitions to
     *  `active` at the same time. */
    signedLeasePath: text("signed_lease_path"),
    signedLeaseUploadedAt: timestamp("signed_lease_uploaded_at", { withTimezone: true }),
    /** Pre-signing onboarding stage:
     *    null              = Draft (Step 1)
     *    "agreement_ready" = Send Emails (Step 2) — agreement generated/uploaded
     *    "emails_sent"     = Advisor Approval (Step 3) — both lawyer + advisor emailed
     *    "at_accounts"     = Accounts (Step 4) — accounts emailed
     *  Once status becomes "active" the lease is at Step 5 (Active). */
    onboardingStage: text("onboarding_stage"),
    /** Path inside `lease-documents` to the draft (pre-signing) agreement. */
    agreementPath: text("agreement_path"),
    agreementGeneratedAt: timestamp("agreement_generated_at", { withTimezone: true }),
    lawyerEmailSentAt: timestamp("lawyer_email_sent_at", { withTimezone: true }),
    advisorEmailSentAt: timestamp("advisor_email_sent_at", { withTimezone: true }),
    accountsEmailSentAt: timestamp("accounts_email_sent_at", { withTimezone: true }),
  },
  (t) => [
    index("lease_entity_idx").on(t.legalEntityId),
    index("lease_property_idx").on(t.propertyId),
    index("lease_status_idx").on(t.status),
  ],
);

export const leaseUnit = pgTable(
  "lease_unit",
  {
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => lease.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unit.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.leaseId, t.unitId] })],
);

export const leasePartyRoleTable = pgTable(
  "lease_party_role",
  {
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => lease.id, { onDelete: "cascade" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => party.id, { onDelete: "restrict" }),
    // Present only for a participant with an RPMS login. External contacts
    // retain the party record without receiving application access.
    userId: uuid("user_id"),
    role: partyRoleEnum("role").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.leaseId, t.partyId, t.role] }),
    index("lease_party_role_user_idx").on(t.userId),
  ],
);

export const rentScheduleTranche = pgTable(
  "rent_schedule_tranche",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => lease.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    monthlyRentAmount: numeric("monthly_rent_amount", {
      precision: 20,
      scale: 2,
    }).notNull(),
    monthlyRentCurrency: currencyEnum("monthly_rent_currency").notNull(),
    advanceSetoffAmount: numeric("advance_setoff_amount", {
      precision: 20,
      scale: 2,
    }),
    advanceSetoffCurrency: currencyEnum("advance_setoff_currency"),
    dueDayOfMonth: integer("due_day_of_month").notNull(),
    paymentDescription: text("payment_description"),
    fxRateLkrPerUsd: numeric("fx_rate_lkr_per_usd", {
      precision: 10,
      scale: 4,
    }),
  },
  (t) => [
    uniqueIndex("tranche_lease_seq_idx").on(t.leaseId, t.sequence),
  ],
);

// ───────────────────────────────────────────────────────── Obligation

export const obligation = pgTable(
  "obligation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => lease.id, { onDelete: "cascade" }),
    ownerPartyId: uuid("owner_party_id").references(() => party.id, {
      onDelete: "set null",
    }),
    kind: obligationKindEnum("kind").notNull(),
    dueDate: date("due_date").notNull(),
    amountValue: numeric("amount_value", { precision: 20, scale: 2 }),
    amountCurrency: currencyEnum("amount_currency"),
    status: obligationStatusEnum("status").notNull().default("pending"),
    sourceClause: varchar("source_clause", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("obligation_lease_idx").on(t.leaseId),
    index("obligation_due_idx").on(t.dueDate),
    index("obligation_status_idx").on(t.status),
  ],
);

// ───────────────────────────────────────────────────────── Ledger

export const ledgerEntry = pgTable(
  "ledger_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => lease.id, { onDelete: "cascade" }),
    obligationId: uuid("obligation_id").references(() => obligation.id, {
      onDelete: "set null",
    }),
    counterpartyPartyId: uuid("counterparty_party_id")
      .notNull()
      .references(() => party.id, { onDelete: "restrict" }),
    kind: ledgerKindEnum("kind").notNull(),
    direction: ledgerDirectionEnum("direction").notNull(),
    amountValue: numeric("amount_value", { precision: 20, scale: 2 }).notNull(),
    amountCurrency: currencyEnum("amount_currency").notNull(),
    dueDate: date("due_date").notNull(),
    paidDate: date("paid_date"),
    paymentMethod: paymentMethodEnum("payment_method"),
    reference: text("reference"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ledger_lease_idx").on(t.leaseId),
    index("ledger_due_idx").on(t.dueDate),
    // "Has this been paid" hits this constantly.
    index("ledger_paid_idx").on(t.paidDate),
  ],
);

// ───────────────────────────────────────────────────────── Document

export const document = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leaseId: uuid("lease_id").references(() => lease.id, {
      onDelete: "set null",
    }),
    partyId: uuid("party_id").references(() => party.id, {
      onDelete: "set null",
    }),
    kind: documentKindEnum("kind").notNull(),
    blobUrl: text("blob_url").notNull(),
    /** SHA-256 hex; doubles as the dedupe key (SPEC §8 / §10). */
    sha256: varchar("sha256", { length: 64 }).notNull(),
    filename: text("filename").notNull(),
    mime: varchar("mime", { length: 128 }).notNull(),
    version: integer("version").notNull().default(1),
    signedStatus: documentSignedStatusEnum("signed_status"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    esigEnvelopeId: varchar("esig_envelope_id", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("document_lease_idx").on(t.leaseId),
    index("document_sha256_idx").on(t.sha256),
  ],
);

// ───────────────────────────────────────────────────────── User → role mapping
//
// Supabase Auth owns the `auth.users` table. We attach app-level role +
// entity-scope + lease-scope here. Roles are varchar (not enum) because they
// are runtime-editable via /admin/access (SPEC §21 / identity.ts).

export const userRole = pgTable(
  "user_role",
  {
    userId: uuid("user_id").primaryKey(), // FK to auth.users(id) — referenced in raw SQL via migration
    role: varchar("role", { length: 32 }).notNull(),
    entities: text("entities").array().notNull().default([]),
    assignedLeaseIds: uuid("assigned_lease_ids").array().notNull().default([]),
    partyId: uuid("party_id").references(() => party.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

// ───────────────────────────────────────────────────────── Relations
// Required by Drizzle's relational query API (`db.query.lease.findMany({ with: { ... } })`).

export const propertyRelations = relations(property, ({ one, many }) => ({
  legalEntity: one(legalEntity, {
    fields: [property.legalEntityId],
    references: [legalEntity.id],
  }),
  owner: one(party, {
    fields: [property.ownerPartyId],
    references: [party.id],
  }),
  units: many(unit),
}));

export const unitRelations = relations(unit, ({ one, many }) => ({
  property: one(property, {
    fields: [unit.propertyId],
    references: [property.id],
  }),
  leaseUnits: many(leaseUnit),
}));

export const leaseRelations = relations(lease, ({ one, many }) => ({
  legalEntity: one(legalEntity, {
    fields: [lease.legalEntityId],
    references: [legalEntity.id],
  }),
  property: one(property, {
    fields: [lease.propertyId],
    references: [property.id],
  }),
  lessor: one(party, {
    fields: [lease.lessorPartyId],
    references: [party.id],
    relationName: "lease_lessor",
  }),
  lessee: one(party, {
    fields: [lease.lesseePartyId],
    references: [party.id],
    relationName: "lease_lessee",
  }),
  units: many(leaseUnit),
  partyRoles: many(leasePartyRoleTable),
  tranches: many(rentScheduleTranche),
  obligations: many(obligation),
  ledger: many(ledgerEntry),
}));

export const leaseUnitRelations = relations(leaseUnit, ({ one }) => ({
  lease: one(lease, {
    fields: [leaseUnit.leaseId],
    references: [lease.id],
  }),
  unit: one(unit, {
    fields: [leaseUnit.unitId],
    references: [unit.id],
  }),
}));

export const leasePartyRoleRelations = relations(
  leasePartyRoleTable,
  ({ one }) => ({
    lease: one(lease, {
      fields: [leasePartyRoleTable.leaseId],
      references: [lease.id],
    }),
    party: one(party, {
      fields: [leasePartyRoleTable.partyId],
      references: [party.id],
    }),
  }),
);

export const rentScheduleTrancheRelations = relations(
  rentScheduleTranche,
  ({ one }) => ({
    lease: one(lease, {
      fields: [rentScheduleTranche.leaseId],
      references: [lease.id],
    }),
  }),
);

export const obligationRelations = relations(obligation, ({ one }) => ({
  lease: one(lease, {
    fields: [obligation.leaseId],
    references: [lease.id],
  }),
  ownerParty: one(party, {
    fields: [obligation.ownerPartyId],
    references: [party.id],
  }),
}));

export const ledgerEntryRelations = relations(ledgerEntry, ({ one }) => ({
  lease: one(lease, {
    fields: [ledgerEntry.leaseId],
    references: [lease.id],
  }),
  obligation: one(obligation, {
    fields: [ledgerEntry.obligationId],
    references: [obligation.id],
  }),
  counterparty: one(party, {
    fields: [ledgerEntry.counterpartyPartyId],
    references: [party.id],
  }),
}));

export const partyRelations = relations(party, ({ one }) => ({
  legalEntity: one(legalEntity, {
    fields: [party.legalEntityId],
    references: [legalEntity.id],
  }),
}));
