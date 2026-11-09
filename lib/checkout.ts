import type { SupabaseClient } from '@supabase/supabase-js'
import { initializePaystackCharge, paystackSecret, paystackSignatureMatches, verifyPaystackCharge } from '@/lib/paystack'
import { parseReservationReference } from '@/lib/reservation-reference'
import { createServiceClient } from '@/lib/supabase'

type Result = { status: number; body: Record<string, unknown> }

type SubmitBody = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  idPassport?: string
  reasonForBuying?: string
  unitId?: string
  unitNumber?: string
}

export async function submitReservation(userId: string, body: SubmitBody | null): Promise<Result> {
  if (!body) return { status: 400, body: { error: 'Invalid JSON body' } }
  const firstName = String(body.firstName ?? '').trim()
  const lastName = String(body.lastName ?? '').trim()
  const email = String(body.email ?? '').trim()
  const phone = String(body.phone ?? '').trim()
  const idPassport = String(body.idPassport ?? '').trim()
  const reasonForBuying = String(body.reasonForBuying ?? '').trim()
  const unitId = String(body.unitId ?? '').trim()
  const unitNumberFromClient = String(body.unitNumber ?? '').trim()
  if (!firstName || !lastName || !email || !phone || !idPassport || !reasonForBuying || !unitId) {
    return { status: 400, body: { error: 'Missing required fields' } }
  }

  const supabase = createServiceClient()
  const { data: unit, error: unitErr } = await supabase
    .from('units')
    .select('id, unit_number, status, lock_expires_at, locked_by')
    .eq('id', unitId)
    .single()
  if (unitErr || !unit) return { status: 404, body: { error: 'Unit not found' } }
  if (String(unit.status) !== 'Available') return { status: 409, body: { error: 'Unit is no longer available' } }

  const lockOwner = String(unit.locked_by ?? '').trim()
  const lockExpires = unit.lock_expires_at ? new Date(unit.lock_expires_at).getTime() : null
  const lockIsActive = lockExpires != null && lockExpires > Date.now()
  if (!lockIsActive || lockOwner !== userId) {
    return { status: 409, body: { error: 'Your hold on this unit has ended.' } }
  }

  const { data: otherPending, error: otherPendingErr } = await supabase
    .from('reservations')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'payment_pending')
    .neq('unit_id', unitId)
    .limit(1)
  if (otherPendingErr) return { status: 500, body: { error: 'Failed to create reservation' } }
  if (otherPending && otherPending.length > 0) {
    return { status: 409, body: { error: 'You already have a reservation in progress.' } }
  }

  const { data: settings, error: settingsErr } = await supabase
    .from('project_settings')
    .select('reservation_deposit_cents')
    .eq('id', 1)
    .single()
  const amountInCents = Number(settings?.reservation_deposit_cents)
  if (settingsErr || !Number.isInteger(amountInCents) || amountInCents <= 0) {
    return { status: 500, body: { error: 'Reservation deposit is not configured' } }
  }

  const { data: active } = await supabase
    .from('reservations')
    .select('id, user_id, paystack_reference, amount_cents, currency')
    .eq('unit_id', unitId)
    .eq('status', 'payment_pending')
    .limit(1)
    .maybeSingle()
  if (active && active.user_id !== userId) {
    return { status: 409, body: { error: 'An active checkout already exists for this unit' } }
  }
  if (active) {
    const initialized = Number(active.amount_cents) === amountInCents
      ? await initializePaystackCharge(active.paystack_reference, email, amountInCents)
      : { error: 'deposit changed' }
    if ('accessCode' in initialized) {
      return {
        status: 200,
        body: {
          success: true,
          reservationId: active.id,
          paymentReference: active.paystack_reference,
          amountInCents,
          currency: active.currency,
          email,
          accessCode: initialized.accessCode,
          message: 'Existing pending reservation reused',
        },
      }
    }
    await supabase.rpc('cancel_reservation_by_reference_v2', {
      p_payment_reference: active.paystack_reference,
      p_user_id: userId,
      p_reason: 'deposit_changed',
    })
  }

  const reservationId = crypto.randomUUID()
  const paymentReference = `resv_${reservationId}`
  const unitNumberSnapshot = String(unit.unit_number ?? unitNumberFromClient ?? '').trim() || unitId
  const { error: insertErr } = await supabase.from('reservations').insert({
    id: reservationId,
    paystack_reference: paymentReference,
    unit_id: unitId,
    user_id: userId,
    status: 'payment_pending',
    amount_cents: amountInCents,
    currency: 'ZAR',
    buyer_first_name: firstName,
    buyer_last_name: lastName,
    buyer_email: email,
    buyer_phone: phone,
    buyer_id_passport: idPassport,
    buyer_reason_for_buying: reasonForBuying,
    unit_number_snapshot: unitNumberSnapshot,
  })
  if (insertErr) return { status: 500, body: { error: 'Failed to create reservation' } }

  const initialized = await initializePaystackCharge(paymentReference, email, amountInCents)
  if ('error' in initialized) {
    await supabase.rpc('cancel_reservation_by_reference_v2', {
      p_payment_reference: paymentReference,
      p_user_id: userId,
      p_reason: 'paystack_initialize_failed',
    })
    return { status: 502, body: { error: initialized.error } }
  }

  await supabase.from('profiles').update({
    first_name: firstName,
    last_name: lastName,
    phone,
    id_passport_number: idPassport,
    reason_for_buying: reasonForBuying,
  }).eq('id', userId)

  return {
    status: 200,
    body: {
      success: true,
      reservationId,
      paymentReference,
      amountInCents,
      currency: 'ZAR',
      email,
      accessCode: initialized.accessCode,
      message: 'Reservation created. Proceed to payment.',
    },
  }
}

export async function confirmReservationPayment(userId: string, paymentReference: string): Promise<Result> {
  if (!paymentReference) return { status: 400, body: { error: 'paymentReference is required' } }
  if (!parseReservationReference(paymentReference)) return { status: 400, body: { error: 'Invalid payment reference format' } }
  const verified = await verifyPaystackCharge(paymentReference)
  if ('error' in verified && verified.error === 'PAYSTACK_SECRET_KEY not configured') {
    return { status: 500, body: { error: 'PAYSTACK_SECRET_KEY not configured' } }
  }
  if ('error' in verified) return { status: 502, body: { error: 'Paystack verify failed', details: verified.details } }

  const verify = verified.verify
  const success = Boolean(verify?.status === true && String(verify?.data?.status ?? '').toLowerCase() === 'success')
  if (!success) return { status: 409, body: { error: 'Payment not successful' } }

  const supabase = createServiceClient()
  const { data: reservation, error: reservationErr } = await supabase
    .from('reservations')
    .select('amount_cents, user_id')
    .eq('paystack_reference', paymentReference)
    .single()
  if (reservationErr || !reservation) return { status: 404, body: { error: 'Reservation not found' } }
  if (reservation.user_id !== userId) return { status: 403, body: { error: 'Forbidden' } }
  if (Number(verify?.data?.amount) !== Number(reservation.amount_cents)) {
    return { status: 409, body: { error: 'Paid amount does not match the reservation deposit' } }
  }

  const finalized = await finalizePayment(supabase, paymentReference, { event: 'manual.confirm', data: verify?.data ?? {} })
  if ('error' in finalized) return { status: 500, body: { error: 'Failed to finalize reservation', details: finalized.error } }
  return {
    status: 200,
    body: {
      success: true,
      reservationId: finalized.reservationId,
      status: finalized.status,
      alreadyPaid: finalized.alreadyPaid,
    },
  }
}

export async function cancelReservation(userId: string, paymentReference: string): Promise<Result> {
  if (!paymentReference) return { status: 400, body: { error: 'paymentReference is required' } }
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('cancel_reservation_by_reference_v2', {
    p_payment_reference: paymentReference,
    p_user_id: userId,
    p_reason: 'user_cancelled',
  })
  if (error) {
    const message = String(error.message ?? '')
    if (message.toLowerCase().includes('forbidden')) return { status: 403, body: { error: 'Forbidden' } }
    if (message.toLowerCase().includes('not found')) return { status: 404, body: { error: 'Reservation not found' } }
    return { status: 500, body: { error: 'Failed to cancel reservation' } }
  }
  const row = data?.[0]
  return {
    status: 200,
    body: {
      success: true,
      reservationId: row?.reservation_id ?? null,
      status: row?.status ?? null,
      wasPaid: row?.was_paid ?? false,
    },
  }
}

export async function handlePaystackWebhook(bodyText: string, signature: string): Promise<void> {
  const secret = paystackSecret()
  if (!secret || !paystackSignatureMatches(secret, bodyText, signature)) return
  const payload = JSON.parse(bodyText || '{}')
  const event = String(payload?.event ?? '')
  const data = payload?.data ?? {}
  const reference = String(data?.reference ?? '').trim()
  if (!reference || !parseReservationReference(reference)) return

  const supabase = createServiceClient()
  const failed = event === 'charge.failed' || event === 'charge.reversed' || String(data?.status ?? '').toLowerCase() === 'failed'
  if (failed) {
    await supabase.rpc('cancel_reservation_by_reference_v2', {
      p_payment_reference: reference,
      p_user_id: null,
      p_reason: 'paystack_failed',
    })
    return
  }
  const success = event === 'charge.success' && String(data?.status ?? '').toLowerCase() === 'success'
  if (!success) return

  const { data: reservation, error } = await supabase
    .from('reservations')
    .select('amount_cents')
    .eq('paystack_reference', reference)
    .maybeSingle()
  if (error || !reservation || Number(data?.amount) !== Number(reservation.amount_cents)) return
  await finalizePayment(supabase, reference, payload)
}

async function finalizePayment(supabase: SupabaseClient, paymentReference: string, payload: unknown) {
  const { data, error } = await supabase.rpc('finalize_reservation_payment_v2', {
    p_payment_reference: paymentReference,
    p_paystack_payload: payload,
  })
  if (error) return { error: error.message }
  const row = data?.[0]
  return {
    reservationId: row?.reservation_id ?? null,
    status: row?.status ?? null,
    alreadyPaid: row?.already_paid ?? false,
  }
}
