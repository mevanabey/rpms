ALTER TABLE "lease" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN IF NOT EXISTS "signed_lease_path" text;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN IF NOT EXISTS "signed_lease_uploaded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN IF NOT EXISTS "onboarding_stage" text;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN IF NOT EXISTS "agreement_path" text;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN IF NOT EXISTS "agreement_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN IF NOT EXISTS "lawyer_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN IF NOT EXISTS "advisor_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN IF NOT EXISTS "accounts_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lease_party_role" ADD COLUMN IF NOT EXISTS "user_id" uuid;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lease_party_role_user_idx" ON "lease_party_role" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lease_party_role_user_role_idx" ON "lease_party_role" ("lease_id", "role", "user_id") WHERE "user_id" IS NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lease_party_role_user_id_auth_users_fk') THEN
    ALTER TABLE "lease_party_role" ADD CONSTRAINT "lease_party_role_user_id_auth_users_fk"
      FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
--> statement-breakpoint
-- All application reads and writes use the server-only Drizzle connection.
-- Browser Supabase clients are used for Auth only; deny direct Data API access.
ALTER TABLE "public"."document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."lease" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."lease_party_role" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."lease_unit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."ledger_entry" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."legal_entity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."obligation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."party" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."property" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."rent_schedule_tranche" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."unit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."user_role" ENABLE ROW LEVEL SECURITY;
