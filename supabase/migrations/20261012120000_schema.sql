-- ============================================================================
-- Ignite Portal - one-shot schema (fresh Supabase project)
-- Includes final tested model:
-- - Supabase as source of truth for reservations
-- - Zoho sync queue and idempotent payment/cancel RPCs
-- - No legacy pending_reservations/payment_events/image_url
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  id_passport_number TEXT,
  reason_for_buying TEXT,
  reserved_unit_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- units
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_number TEXT NOT NULL UNIQUE,
  bedrooms INT NOT NULL,
  bathrooms INT NOT NULL,
  parking INT NOT NULL,
  size_sqm NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Available', 'Reserved', 'Sold', 'Held by Developer')),
  unit_type TEXT NOT NULL,
  image_key_1 TEXT,
  image_key_2 TEXT,
  image_key_3 TEXT,
  floorplan_key TEXT,
  floor TEXT,
  direction TEXT,
  viewers JSONB NOT NULL DEFAULT '{}'::jsonb,
  lock_expires_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS units_status_idx ON public.units (status);
CREATE INDEX IF NOT EXISTS units_lock_expires_at_idx
  ON public.units (lock_expires_at)
  WHERE lock_expires_at IS NOT NULL;

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read units" ON public.units;
CREATE POLICY "Anyone can read units"
  ON public.units FOR SELECT
  TO anon, authenticated
  USING (true);

-- Lock and presence writes stay on the server (service role). There is no
-- client UPDATE policy: the previous policy allowed any signed-in caller to
-- change every column, including price and status.
DROP POLICY IF EXISTS "Authenticated can update unit lock/viewers" ON public.units;

ALTER PUBLICATION supabase_realtime ADD TABLE public.units;

-- ----------------------------------------------------------------------------
-- agents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Sales Specialist',
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active agents" ON public.agents;
CREATE POLICY "Anyone can read active agents"
  ON public.agents FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ----------------------------------------------------------------------------
-- wishlists
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, unit_id)
);

CREATE INDEX IF NOT EXISTS wishlists_user_id_idx ON public.wishlists (user_id);
CREATE INDEX IF NOT EXISTS wishlists_unit_id_idx ON public.wishlists (unit_id);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wishlist" ON public.wishlists;
CREATE POLICY "Users can view own wishlist"
  ON public.wishlists FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own wishlist" ON public.wishlists;
CREATE POLICY "Users can insert own wishlist"
  ON public.wishlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own wishlist" ON public.wishlists;
CREATE POLICY "Users can delete own wishlist"
  ON public.wishlists FOR DELETE
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- reservations (canonical source of truth)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paystack_reference TEXT NOT NULL UNIQUE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('payment_pending', 'paid', 'cancelled', 'expired')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  buyer_first_name TEXT NOT NULL,
  buyer_last_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  buyer_id_passport TEXT NOT NULL,
  buyer_reason_for_buying TEXT NOT NULL,
  unit_number_snapshot TEXT NOT NULL,
  paystack_status TEXT,
  paystack_paid_at TIMESTAMPTZ,
  paystack_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  cancel_reason TEXT,
  zoho_sync_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (zoho_sync_status IN ('not_required', 'pending', 'processing', 'synced', 'failed')),
  zoho_last_error TEXT,
  zoho_lead_id TEXT,
  zoho_contact_id TEXT,
  zoho_reservation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_active_per_unit_idx
  ON public.reservations (unit_id)
  WHERE status IN ('payment_pending', 'paid');

CREATE INDEX IF NOT EXISTS reservations_user_status_idx ON public.reservations (user_id, status);
CREATE INDEX IF NOT EXISTS reservations_created_at_idx ON public.reservations (created_at DESC);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reservations" ON public.reservations;
CREATE POLICY "Users can view own reservations"
  ON public.reservations FOR SELECT
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- zoho sync jobs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zoho_sync_jobs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reservation_id UUID NOT NULL UNIQUE REFERENCES public.reservations(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'reservation_paid_sync' CHECK (job_type = 'reservation_paid_sync'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'retry', 'succeeded', 'failed', 'cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 8 CHECK (max_attempts > 0),
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zoho_sync_jobs_due_idx
  ON public.zoho_sync_jobs (status, run_after)
  WHERE status IN ('pending', 'retry');

ALTER TABLE public.zoho_sync_jobs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Shared updated_at trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS units_updated_at ON public.units;
CREATE TRIGGER units_updated_at
BEFORE UPDATE ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS agents_updated_at ON public.agents;
CREATE TRIGGER agents_updated_at
BEFORE UPDATE ON public.agents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS reservations_updated_at ON public.reservations;
CREATE TRIGGER reservations_updated_at
BEFORE UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS zoho_sync_jobs_updated_at ON public.zoho_sync_jobs;
CREATE TRIGGER zoho_sync_jobs_updated_at
BEFORE UPDATE ON public.zoho_sync_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RPC: finalize payment atomically (idempotent)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_reservation_payment_v2(
  p_payment_reference TEXT,
  p_paystack_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  reservation_id UUID,
  status TEXT,
  already_paid BOOLEAN,
  enqueued_job BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.reservations%ROWTYPE;
BEGIN
  SELECT *
  INTO v_res
  FROM public.reservations
  WHERE paystack_reference = p_payment_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found for reference %', p_payment_reference
      USING ERRCODE = 'P0002';
  END IF;

  IF v_res.status = 'paid' THEN
    RETURN QUERY SELECT v_res.id, v_res.status, TRUE, FALSE;
    RETURN;
  END IF;

  IF v_res.status IN ('cancelled', 'expired') THEN
    RETURN QUERY SELECT v_res.id, v_res.status, FALSE, FALSE;
    RETURN;
  END IF;

  UPDATE public.reservations
  SET
    status = 'paid',
    paystack_status = COALESCE(NULLIF(p_paystack_payload->'data'->>'status', ''), 'success'),
    paystack_paid_at = COALESCE(NULLIF(p_paystack_payload->'data'->>'paid_at', '')::timestamptz, now()),
    paystack_payload = COALESCE(p_paystack_payload, '{}'::jsonb),
    paid_at = now(),
    zoho_sync_status = 'pending'
  WHERE id = v_res.id
  RETURNING * INTO v_res;

  UPDATE public.units
  SET status = 'Reserved', lock_expires_at = NULL, locked_by = NULL
  WHERE id = v_res.unit_id;

  UPDATE public.profiles
  SET reserved_unit_ids = CASE
    WHEN v_res.unit_id = ANY (COALESCE(reserved_unit_ids, '{}'::uuid[])) THEN reserved_unit_ids
    ELSE array_append(COALESCE(reserved_unit_ids, '{}'::uuid[]), v_res.unit_id)
  END
  WHERE id = v_res.user_id;

  INSERT INTO public.zoho_sync_jobs (reservation_id, status, run_after, payload)
  VALUES (v_res.id, 'pending', now(), jsonb_build_object('source', 'payment-webhook'))
  ON CONFLICT ON CONSTRAINT zoho_sync_jobs_reservation_id_key
  DO UPDATE SET
    status = 'pending',
    run_after = now(),
    locked_at = NULL,
    last_error = NULL,
    updated_at = now();

  RETURN QUERY SELECT v_res.id, v_res.status, FALSE, TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_reservation_payment_v2(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_reservation_payment_v2(TEXT, JSONB) TO service_role;

-- ----------------------------------------------------------------------------
-- RPC: cancel reservation atomically (idempotent)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_reservation_by_reference_v2(
  p_payment_reference TEXT,
  p_user_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'user_cancelled'
)
RETURNS TABLE (
  reservation_id UUID,
  status TEXT,
  was_paid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.reservations%ROWTYPE;
BEGIN
  SELECT *
  INTO v_res
  FROM public.reservations
  WHERE paystack_reference = p_payment_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found for reference %', p_payment_reference
      USING ERRCODE = 'P0002';
  END IF;

  IF p_user_id IS NOT NULL AND v_res.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden to cancel this reservation'
      USING ERRCODE = '42501';
  END IF;

  IF v_res.status = 'paid' THEN
    RETURN QUERY SELECT v_res.id, v_res.status, TRUE;
    RETURN;
  END IF;

  IF v_res.status IN ('cancelled', 'expired') THEN
    RETURN QUERY SELECT v_res.id, v_res.status, FALSE;
    RETURN;
  END IF;

  UPDATE public.reservations
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancel_reason = COALESCE(p_reason, 'user_cancelled'),
    zoho_sync_status = 'not_required'
  WHERE id = v_res.id
  RETURNING * INTO v_res;

  UPDATE public.units
  SET lock_expires_at = NULL, locked_by = NULL
  WHERE id = v_res.unit_id;

  UPDATE public.zoho_sync_jobs z
  SET
    status = 'cancelled',
    last_error = 'Reservation cancelled before Zoho sync'
  WHERE z.reservation_id = v_res.id
    AND z.status IN ('pending', 'retry', 'processing');

  RETURN QUERY SELECT v_res.id, v_res.status, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_reservation_by_reference_v2(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_reservation_by_reference_v2(TEXT, UUID, TEXT) TO service_role;

-- Keep buyers from promoting themselves or writing reserved units.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.role := OLD.role;
    NEW.reserved_unit_ids := OLD.reserved_unit_ids;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_privileged ON public.profiles;
CREATE TRIGGER profiles_protect_privileged
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileged_columns();

REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM anon, authenticated;

-- One-address lookup for the sign-in flow. Execute is service-role only.
CREATE OR REPLACE FUNCTION public.auth_user_exists(lookup_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = lower(trim(lookup_email))
  );
$$;

REVOKE ALL ON FUNCTION public.auth_user_exists(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_exists(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_exists(TEXT) TO service_role;
