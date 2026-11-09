-- Clients can read units, but wishlists RLS only exposes each user's own rows.
-- wishlist_count is the public total for a unit, maintained when wishlist rows change.

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS wishlist_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.units.wishlist_count IS
  'Number of wishlist rows for this unit. Maintained by private.sync_unit_wishlist_count.';

UPDATE public.units AS unit
SET wishlist_count = counted.total
FROM (
  SELECT existing.id, count(wish.id)::integer AS total
  FROM public.units AS existing
  LEFT JOIN public.wishlists AS wish ON wish.unit_id = existing.id
  GROUP BY existing.id
) AS counted
WHERE unit.id = counted.id;

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.sync_unit_wishlist_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.units
    SET wishlist_count = wishlist_count + 1
    WHERE id = NEW.unit_id;
    RETURN NEW;
  END IF;

  UPDATE public.units
  SET wishlist_count = GREATEST(wishlist_count - 1, 0)
  WHERE id = OLD.unit_id;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_unit_wishlist_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.sync_unit_wishlist_count() TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA private TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION private.sync_unit_wishlist_count() TO supabase_auth_admin;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS wishlists_sync_unit_count ON public.wishlists;
CREATE TRIGGER wishlists_sync_unit_count
  AFTER INSERT OR DELETE ON public.wishlists
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_unit_wishlist_count();
