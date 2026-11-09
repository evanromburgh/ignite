-- Store the Zoho lead linked at signup. Buyers cannot write this column.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS zoho_lead_id TEXT;

COMMENT ON COLUMN public.profiles.zoho_lead_id IS 'Zoho CRM lead id linked at signup.';

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.role := OLD.role;
    NEW.reserved_unit_ids := OLD.reserved_unit_ids;
    NEW.zoho_lead_id := OLD.zoho_lead_id;
  END IF;
  RETURN NEW;
END;
$$;
