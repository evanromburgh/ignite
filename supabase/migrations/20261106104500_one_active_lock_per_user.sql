-- One buyer can hold one active unit lock. A second reserve releases the
-- previous hold. An open checkout on another unit blocks a new hold.
-- Concurrent reserves for the same buyer serialize on a transaction lock.

CREATE OR REPLACE FUNCTION public.enforce_one_active_unit_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.locked_by IS NULL OR NEW.lock_expires_at IS NULL OR NEW.lock_expires_at <= now() THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.units
    WHERE locked_by = NEW.locked_by
      AND id <> NEW.id
      AND lock_expires_at IS NOT NULL
      AND lock_expires_at > now()
  ) THEN
    RAISE EXCEPTION 'User already holds an active unit lock'
      USING ERRCODE = 'P3005';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS units_one_active_lock ON public.units;
CREATE TRIGGER units_one_active_lock
BEFORE UPDATE OF locked_by, lock_expires_at ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.enforce_one_active_unit_lock();

DROP FUNCTION IF EXISTS public.acquire_unit_lock(uuid, uuid);
DROP FUNCTION IF EXISTS public.database_now_ms();

CREATE OR REPLACE FUNCTION public.acquire_unit_lock(
  p_unit_id uuid,
  p_user_id uuid,
  p_now timestamptz
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration integer;
  v_unit public.units%ROWTYPE;
  v_expires timestamptz;
BEGIN
  IF p_unit_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Unit not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_now IS NULL THEN
    RAISE EXCEPTION 'Lock duration is not configured'
      USING ERRCODE = 'P3003';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT lock_duration_ms
  INTO v_duration
  FROM public.project_settings
  WHERE id = 1;

  IF v_duration IS NULL OR v_duration <= 0 THEN
    RAISE EXCEPTION 'Lock duration is not configured'
      USING ERRCODE = 'P3003';
  END IF;

  SELECT *
  INTO v_unit
  FROM public.units
  WHERE id = p_unit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unit not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_unit.status IS DISTINCT FROM 'Available' THEN
    RAISE EXCEPTION 'This unit is no longer available for reservation.'
      USING ERRCODE = 'P3001';
  END IF;

  IF v_unit.locked_by IS NOT NULL
     AND v_unit.locked_by IS DISTINCT FROM p_user_id
     AND v_unit.lock_expires_at IS NOT NULL
     AND v_unit.lock_expires_at > p_now THEN
    RAISE EXCEPTION 'This unit is currently being reserved. Try again shortly.'
      USING ERRCODE = 'P3002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reservations
    WHERE user_id = p_user_id
      AND status = 'payment_pending'
      AND unit_id IS DISTINCT FROM p_unit_id
  ) OR EXISTS (
    SELECT 1
    FROM public.units
    WHERE locked_by = p_user_id
      AND id IS DISTINCT FROM p_unit_id
      AND lock_expires_at IS NOT NULL
      AND lock_expires_at > p_now
  ) THEN
    RAISE EXCEPTION 'You already have a reservation in progress.'
      USING ERRCODE = 'P3004';
  END IF;

  UPDATE public.units
  SET lock_expires_at = NULL, locked_by = NULL
  WHERE locked_by = p_user_id
    AND id IS DISTINCT FROM p_unit_id
    AND (lock_expires_at IS NULL OR lock_expires_at <= p_now);

  IF v_unit.locked_by = p_user_id
     AND v_unit.lock_expires_at IS NOT NULL
     AND v_unit.lock_expires_at > p_now THEN
    RETURN v_unit.lock_expires_at;
  END IF;

  v_expires := p_now + make_interval(secs => v_duration / 1000.0);

  UPDATE public.units
  SET lock_expires_at = v_expires,
      locked_by = p_user_id
  WHERE id = p_unit_id
    AND status = 'Available';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This unit is no longer available for reservation.'
      USING ERRCODE = 'P3001';
  END IF;

  RETURN v_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_one_active_unit_lock() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_one_active_unit_lock() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_one_active_unit_lock() TO service_role;

REVOKE ALL ON FUNCTION public.acquire_unit_lock(uuid, uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_unit_lock(uuid, uuid, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_unit_lock(uuid, uuid, timestamptz) TO service_role;
