-- Run after migration 0001. These app roles do not grant access to any lease
-- until an admin links each system user in the lease's Team & contacts section.
DO $$
DECLARE
  missing_emails text;
  entity_codes text[];
  assignments jsonb := '[
    {"email":"admin@capitaltrust.lk","role":"admin"},
    {"email":"tushan@capitaltrust.lk","role":"admin"},
    {"email":"accounts@capitaltrust.lk","role":"accountant"},
    {"email":"lawyer@capitaltrust.lk","role":"lawyer"},
    {"email":"advisor@capitaltrust.lk","role":"advisor"}
  ]'::jsonb;
BEGIN
  SELECT string_agg(d.email, ', ') INTO missing_emails
  FROM jsonb_to_recordset(assignments) AS d(email text, role text)
  LEFT JOIN auth.users AS u ON lower(u.email) = lower(d.email)
  WHERE u.id IS NULL;

  IF missing_emails IS NOT NULL THEN
    RAISE EXCEPTION 'Supabase Auth users not found: %', missing_emails;
  END IF;

  SELECT coalesce(array_agg(code ORDER BY code), ARRAY[]::text[])
  INTO entity_codes FROM public.legal_entity;

  INSERT INTO public.user_role (user_id, role, entities, assigned_lease_ids, is_active)
  SELECT u.id, d.role, entity_codes, ARRAY[]::uuid[], true
  FROM jsonb_to_recordset(assignments) AS d(email text, role text)
  JOIN auth.users AS u ON lower(u.email) = lower(d.email)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    entities = EXCLUDED.entities,
    is_active = true,
    updated_at = now();
END $$;
