-- Databases that already applied the original schema still have the Zoho
-- queue and reservation columns. Replace the payment RPCs first so they no
-- longer write those columns, then drop the objects.

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
    paid_at = now()
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

  RETURN QUERY SELECT v_res.id, v_res.status, FALSE, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_reservation_payment_v2(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_reservation_payment_v2(TEXT, JSONB) TO service_role;

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
    cancel_reason = COALESCE(p_reason, 'user_cancelled')
  WHERE id = v_res.id
  RETURNING * INTO v_res;

  UPDATE public.units
  SET lock_expires_at = NULL, locked_by = NULL
  WHERE id = v_res.unit_id;

  RETURN QUERY SELECT v_res.id, v_res.status, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_reservation_by_reference_v2(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_reservation_by_reference_v2(TEXT, UUID, TEXT) TO service_role;

DROP TABLE IF EXISTS public.zoho_sync_jobs;

ALTER TABLE public.reservations
  DROP COLUMN IF EXISTS zoho_sync_status,
  DROP COLUMN IF EXISTS zoho_last_error,
  DROP COLUMN IF EXISTS zoho_lead_id,
  DROP COLUMN IF EXISTS zoho_contact_id,
  DROP COLUMN IF EXISTS zoho_reservation_id;
