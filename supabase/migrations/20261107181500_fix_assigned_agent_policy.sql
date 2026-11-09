-- The previous policy compared profiles.agent_id to profiles.id inside the
-- subquery, so a signed-in buyer could never read the assigned agent.

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
