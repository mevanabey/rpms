CREATE TYPE "public"."currency" AS ENUM('LKR', 'USD');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('lease_draft', 'lease_signed', 'invoice', 'receipt', 'kyc_id', 'company_reg', 'stamp_duty_receipt', 'vat_invoice', 'notice', 'payment_proof');--> statement-breakpoint
CREATE TYPE "public"."document_signed_status" AS ENUM('unsigned', 'sent', 'signed', 'declined');--> statement-breakpoint
CREATE TYPE "public"."lease_kind" AS ENUM('head', 'sub');--> statement-breakpoint
CREATE TYPE "public"."lease_purpose" AS ENUM('commercial', 'residential', 'bpo');--> statement-breakpoint
CREATE TYPE "public"."lease_status" AS ENUM('draft', 'signed', 'active', 'grace', 'terminated', 'expired', 'renewed');--> statement-breakpoint
CREATE TYPE "public"."ledger_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('rent', 'deposit', 'stamp_duty', 'legal_fees', 'vat', 'late_fee', 'refund', 'commission', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."obligation_kind" AS ENUM('rent_due', 'deposit_due', 'stamp_duty', 'legal_fees', 'insurance', 'lift_service', 'generator_service', 'fire_inspection', 'vat_reimbursement', 'colour_wash', 'renewal_notice', 'termination_notice', 'grace_end', 'lockin_end', 'escalation', 'lease_expiry', 'statue_inspection');--> statement-breakpoint
CREATE TYPE "public"."obligation_status" AS ENUM('pending', 'done', 'overdue', 'waived');--> statement-breakpoint
CREATE TYPE "public"."party_kind" AS ENUM('individual', 'company');--> statement-breakpoint
CREATE TYPE "public"."party_role" AS ENUM('lessor', 'lessee', 'client', 'tenant', 'introducer', 'advisor', 'lessor_lawyer', 'lessee_lawyer', 'accountant_handler', 'witness');--> statement-breakpoint
CREATE TYPE "public"."payment_cadence" AS ENUM('monthly', 'quarterly', 'biannual');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('lkr_cash', 'lkr_transfer', 'usd_transfer', 'bank_draft', 'cheque');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('vacant', 'occupied', 'reserved');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('office', 'apartment', 'storage', 'penthouse', 'floor');--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid,
	"party_id" uuid,
	"kind" "document_kind" NOT NULL,
	"blob_url" text NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"filename" text NOT NULL,
	"mime" varchar(128) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"signed_status" "document_signed_status",
	"signed_at" timestamp with time zone,
	"esig_envelope_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lease" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_entity_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"lessor_party_id" uuid NOT NULL,
	"lessee_party_id" uuid NOT NULL,
	"parent_lease_id" uuid,
	"kind" "lease_kind" NOT NULL,
	"purpose" "lease_purpose" NOT NULL,
	"agreement_label" varchar(32),
	"agreement_label_other" text,
	"status" "lease_status" DEFAULT 'draft' NOT NULL,
	"payment_cadence" "payment_cadence" DEFAULT 'monthly' NOT NULL,
	"default_payment_method" "payment_method" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"grace_end_date" date,
	"lock_in_end_date" date,
	"advance_months" integer,
	"occupancy_cap" integer,
	"security_deposit_amount" numeric(20, 2),
	"security_deposit_currency" "currency",
	"stamp_duty_amount" numeric(20, 2),
	"stamp_duty_currency" "currency",
	"legal_fees_amount" numeric(20, 2),
	"legal_fees_currency" "currency",
	"clauses" jsonb,
	"import_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lease_party_role" (
	"lease_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"role" "party_role" NOT NULL,
	CONSTRAINT "lease_party_role_lease_id_party_id_role_pk" PRIMARY KEY("lease_id","party_id","role")
);
--> statement-breakpoint
CREATE TABLE "lease_unit" (
	"lease_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	CONSTRAINT "lease_unit_lease_id_unit_id_pk" PRIMARY KEY("lease_id","unit_id")
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"obligation_id" uuid,
	"counterparty_party_id" uuid NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"direction" "ledger_direction" NOT NULL,
	"amount_value" numeric(20, 2) NOT NULL,
	"amount_currency" "currency" NOT NULL,
	"due_date" date NOT NULL,
	"paid_date" date,
	"payment_method" "payment_method",
	"reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_entity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" text NOT NULL,
	"registration_no" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_entity_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "obligation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"owner_party_id" uuid,
	"kind" "obligation_kind" NOT NULL,
	"due_date" date NOT NULL,
	"amount_value" numeric(20, 2),
	"amount_currency" "currency",
	"status" "obligation_status" DEFAULT 'pending' NOT NULL,
	"source_clause" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_entity_id" uuid,
	"kind" "party_kind" NOT NULL,
	"display_name" text NOT NULL,
	"legal_name" text,
	"nic_or_passport" varchar(32),
	"company_reg_no" varchar(64),
	"emails" text[] DEFAULT '{}' NOT NULL,
	"phones" text[] DEFAULT '{}' NOT NULL,
	"address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_entity_id" uuid NOT NULL,
	"owner_party_id" uuid,
	"name" text NOT NULL,
	"address_line" text NOT NULL,
	"city" text NOT NULL,
	"district" text,
	"lot_no" varchar(64),
	"plan_no" varchar(64),
	"perches" numeric(10, 2),
	"asst_no" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rent_schedule_tranche" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"monthly_rent_amount" numeric(20, 2) NOT NULL,
	"monthly_rent_currency" "currency" NOT NULL,
	"advance_setoff_amount" numeric(20, 2),
	"advance_setoff_currency" "currency",
	"due_day_of_month" integer NOT NULL,
	"payment_description" text,
	"fx_rate_lkr_per_usd" numeric(10, 4)
);
--> statement-breakpoint
CREATE TABLE "unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"label" text NOT NULL,
	"type" "unit_type" NOT NULL,
	"floor" varchar(32),
	"area_sqft" integer,
	"bedrooms" integer,
	"status" "unit_status" DEFAULT 'vacant' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"role" varchar(32) NOT NULL,
	"entities" text[] DEFAULT '{}' NOT NULL,
	"assigned_lease_ids" uuid[] DEFAULT '{}' NOT NULL,
	"party_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_lease_id_lease_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_party_id_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease" ADD CONSTRAINT "lease_legal_entity_id_legal_entity_id_fk" FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease" ADD CONSTRAINT "lease_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease" ADD CONSTRAINT "lease_lessor_party_id_party_id_fk" FOREIGN KEY ("lessor_party_id") REFERENCES "public"."party"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease" ADD CONSTRAINT "lease_lessee_party_id_party_id_fk" FOREIGN KEY ("lessee_party_id") REFERENCES "public"."party"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_party_role" ADD CONSTRAINT "lease_party_role_lease_id_lease_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_party_role" ADD CONSTRAINT "lease_party_role_party_id_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_unit" ADD CONSTRAINT "lease_unit_lease_id_lease_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_unit" ADD CONSTRAINT "lease_unit_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_lease_id_lease_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_obligation_id_obligation_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "public"."obligation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_counterparty_party_id_party_id_fk" FOREIGN KEY ("counterparty_party_id") REFERENCES "public"."party"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligation" ADD CONSTRAINT "obligation_lease_id_lease_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligation" ADD CONSTRAINT "obligation_owner_party_id_party_id_fk" FOREIGN KEY ("owner_party_id") REFERENCES "public"."party"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party" ADD CONSTRAINT "party_legal_entity_id_legal_entity_id_fk" FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_legal_entity_id_legal_entity_id_fk" FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_owner_party_id_party_id_fk" FOREIGN KEY ("owner_party_id") REFERENCES "public"."party"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_schedule_tranche" ADD CONSTRAINT "rent_schedule_tranche_lease_id_lease_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_party_id_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_lease_idx" ON "document" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "document_sha256_idx" ON "document" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "lease_entity_idx" ON "lease" USING btree ("legal_entity_id");--> statement-breakpoint
CREATE INDEX "lease_property_idx" ON "lease" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "lease_status_idx" ON "lease" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ledger_lease_idx" ON "ledger_entry" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "ledger_due_idx" ON "ledger_entry" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "ledger_paid_idx" ON "ledger_entry" USING btree ("paid_date");--> statement-breakpoint
CREATE INDEX "obligation_lease_idx" ON "obligation" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "obligation_due_idx" ON "obligation" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "obligation_status_idx" ON "obligation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "party_display_name_idx" ON "party" USING btree ("display_name");--> statement-breakpoint
CREATE UNIQUE INDEX "tranche_lease_seq_idx" ON "rent_schedule_tranche" USING btree ("lease_id","sequence");--> statement-breakpoint
CREATE INDEX "unit_property_idx" ON "unit" USING btree ("property_id");--> statement-breakpoint
-- Drizzle can't model the cross-schema FK; wire user_role.user_id to auth.users(id) manually.
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_auth_users_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;