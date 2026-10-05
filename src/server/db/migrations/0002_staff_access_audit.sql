CREATE TABLE "lease_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_name" text NOT NULL,
	"actor_email" text,
	"action" text NOT NULL,
	"table_name" text NOT NULL,
	"record_id" text,
	"operation" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "user_role" ADD COLUMN "roles" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_role" ADD COLUMN "password_setup_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "lease_audit_lease_time_idx" ON "lease_audit" USING btree ("lease_id","created_at");
--> statement-breakpoint
UPDATE public.user_role SET roles = ARRAY[role] WHERE cardinality(roles) = 0;
--> statement-breakpoint
ALTER TABLE public.lease_audit ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON public.lease_audit FROM anon, authenticated;
--> statement-breakpoint
CREATE FUNCTION public.rpms_lease_author() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := nullif(current_setting('rpms.actor_id', true), '')::uuid;
  ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Lease authorship cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER lease_author BEFORE INSERT OR UPDATE ON public.lease
FOR EACH ROW EXECUTE FUNCTION public.rpms_lease_author();
--> statement-breakpoint
CREATE FUNCTION public.rpms_capture_lease_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  previous jsonb;
  following jsonb;
  record jsonb;
  lease_ids uuid[];
  affected uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN previous := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN following := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' AND (previous - 'updated_at') = (following - 'updated_at') THEN
    RETURN NEW;
  END IF;
  record := coalesce(following, previous);
  IF TG_TABLE_NAME = 'lease' THEN
    lease_ids := ARRAY[(record->>'id')::uuid];
  ELSIF TG_TABLE_NAME IN ('lease_party_role','lease_unit','rent_schedule_tranche','ledger_entry','obligation','document') THEN
    lease_ids := ARRAY[(previous->>'lease_id')::uuid, (following->>'lease_id')::uuid];
  ELSIF TG_TABLE_NAME = 'party' THEN
    SELECT array_agg(DISTINCT l.id) INTO lease_ids FROM public.lease l
    LEFT JOIN public.lease_party_role p ON p.lease_id = l.id
    WHERE l.lessor_party_id = (record->>'id')::uuid
       OR l.lessee_party_id = (record->>'id')::uuid
       OR p.party_id = (record->>'id')::uuid;
  ELSIF TG_TABLE_NAME = 'property' THEN
    SELECT array_agg(id) INTO lease_ids FROM public.lease
      WHERE property_id = (record->>'id')::uuid;
  ELSIF TG_TABLE_NAME = 'unit' THEN
    SELECT array_agg(lease_id) INTO lease_ids FROM public.lease_unit
      WHERE unit_id = (record->>'id')::uuid;
  ELSIF TG_TABLE_NAME = 'user_role' THEN
    SELECT array_agg(DISTINCT lease_id) INTO lease_ids FROM public.lease_party_role
      WHERE user_id = (record->>'user_id')::uuid;
  END IF;
  FOR affected IN SELECT DISTINCT value FROM unnest(lease_ids) value WHERE value IS NOT NULL LOOP
    INSERT INTO public.lease_audit
      (lease_id, actor_id, actor_name, actor_email, action, table_name, record_id, operation, "before", "after", details)
    VALUES
      (affected, nullif(current_setting('rpms.actor_id', true), '')::uuid,
       coalesce(nullif(current_setting('rpms.actor_name', true), ''), 'System/database'),
       nullif(current_setting('rpms.actor_email', true), ''),
       coalesce(nullif(current_setting('rpms.action', true), ''), TG_TABLE_NAME || ' ' || lower(TG_OP)),
       TG_TABLE_NAME, coalesce(record->>'id', record->>'user_id', record->>'lease_id'), TG_OP,
       previous, following, coalesce(nullif(current_setting('rpms.details', true), '')::jsonb, '{}'::jsonb));
  END LOOP;
  RETURN coalesce(NEW, OLD);
END;
$$;
--> statement-breakpoint
DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['lease','lease_party_role','lease_unit','rent_schedule_tranche','ledger_entry','obligation','document','party','property','unit','user_role'] LOOP
    EXECUTE format('CREATE TRIGGER rpms_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.rpms_capture_lease_change()', target);
  END LOOP;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION public.rpms_audit_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Lease history is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER lease_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.lease_audit
FOR EACH STATEMENT EXECUTE FUNCTION public.rpms_audit_immutable();
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.rpms_capture_lease_change() FROM PUBLIC;
