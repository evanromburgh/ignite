-- The chat shows the sales agent who owns the buyer's Zoho lead.
-- Buyers cannot write profiles.agent_id. Zoho user ids are not readable by the browser.

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS zoho_user_id TEXT;

COMMENT ON COLUMN public.agents.zoho_user_id IS
  'Zoho CRM user id for this sales agent. Set only for agents a lead-owner workflow assigns.';

CREATE UNIQUE INDEX IF NOT EXISTS agents_zoho_user_id_key
  ON public.agents (zoho_user_id)
  WHERE zoho_user_id IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.agent_id IS
  'Sales agent matched from the Zoho lead owner. Written only by the service role.';

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.role := OLD.role;
    NEW.reserved_unit_ids := OLD.reserved_unit_ids;
    NEW.zoho_lead_id := OLD.zoho_lead_id;
    NEW.agent_id := OLD.agent_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON TABLE public.agents FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id,
  name,
  title,
  phone,
  email,
  image_url,
  sort_order,
  is_active,
  created_at,
  updated_at
) ON TABLE public.agents TO authenticated;

DROP POLICY IF EXISTS "Anyone can read active agents" ON public.agents;
DROP POLICY IF EXISTS "Users can read their assigned agent" ON public.agents;
CREATE POLICY "Users can read their assigned agent"
  ON public.agents FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.agent_id = agents.id
    )
  );
