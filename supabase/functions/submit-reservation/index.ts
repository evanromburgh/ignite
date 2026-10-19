import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createServiceRoleClient, getUserFromBearerToken, jsonResponse, optionsResponse } from '../_shared/http.ts'

async function initializePaystackCharge(reference: string, email: string, amountInCents: number) {
  const secret = String(Deno.env.get('PAYSTACK_SECRET_KEY') ?? '').trim()
  if (!secret) return { error: 'PAYSTACK_SECRET_KEY not configured' }
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: amountInCents,
      currency: 'ZAR',
      reference,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  const accessCode = String(payload?.data?.access_code ?? '').trim()
  if (!response.ok || !accessCode) {
    return { error: String(payload?.message ?? 'Paystack initialize failed') }
  }
  return { accessCode }
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse()
  }

  try {
    const supabase = createServiceRoleClient()
    const user = await getUserFromBearerToken(req, supabase)
    if (!user) return jsonResponse(401, { error: 'Unauthorized' })
    const body = await req.json().catch(() => null) as SubmitBody | null
    if (!body) return jsonResponse(400, { error: 'Invalid JSON body' })

    const firstName = String(body.firstName ?? '').trim()
    const lastName = String(body.lastName ?? '').trim()
    const email = String(body.email ?? '').trim()
    const phone = String(body.phone ?? '').trim()
    const idPassport = String(body.idPassport ?? '').trim()
    const reasonForBuying = String(body.reasonForBuying ?? '').trim()
    const unitId = String(body.unitId ?? '').trim()
    const unitNumberFromClient = String(body.unitNumber ?? '').trim()

    if (!firstName || !lastName || !email || !phone || !idPassport || !reasonForBuying || !unitId) {
      return jsonResponse(400, { error: 'Missing required fields' })
    }

    const { data: unit, error: unitErr } = await supabase
      .from('units')
      .select('id, unit_number, status, lock_expires_at, locked_by')
      .eq('id', unitId)
      .single()

    if (unitErr || !unit) {
      return jsonResponse(404, { error: 'Unit not found' })
    }

    if (String(unit.status) !== 'Available') {
      return jsonResponse(409, { error: 'Unit is no longer available' })
    }

    const lockOwner = String(unit.locked_by ?? '').trim()
    const lockExpires = unit.lock_expires_at ? new Date(unit.lock_expires_at).getTime() : null
    const lockIsActive = lockExpires != null && lockExpires > Date.now()
    if (lockIsActive && lockOwner && lockOwner !== user.id) {
      return jsonResponse(409, { error: 'Unit is temporarily locked by another user' })
    }

    const { data: settings, error: settingsErr } = await supabase
      .from('project_settings')
      .select('reservation_deposit_cents')
      .eq('id', 1)
      .single()

    const amountInCents = Number(settings?.reservation_deposit_cents)
    if (settingsErr || !Number.isInteger(amountInCents) || amountInCents <= 0) {
      console.error('submit-reservation deposit lookup failed:', settingsErr)
      return jsonResponse(500, { error: 'Reservation deposit is not configured' })
    }

    const { data: active } = await supabase
      .from('reservations')
      .select('id, user_id, paystack_reference, amount_cents, currency')
      .eq('unit_id', unitId)
      .eq('status', 'payment_pending')
      .limit(1)
      .maybeSingle()

    if (active && active.user_id !== user.id) {
      return jsonResponse(409, { error: 'An active checkout already exists for this unit' })
    }

    if (active) {
      const initialized = Number(active.amount_cents) === amountInCents
        ? await initializePaystackCharge(active.paystack_reference, email, amountInCents)
        : { error: 'deposit changed' }
      if ('accessCode' in initialized) {
        return jsonResponse(200, {
          success: true,
          reservationId: active.id,
          paymentReference: active.paystack_reference,
          amountInCents,
          currency: active.currency,
          email,
          accessCode: initialized.accessCode,
          message: 'Existing pending reservation reused',
        })
      }
      await supabase.rpc('cancel_reservation_by_reference_v2', {
        p_payment_reference: active.paystack_reference,
        p_user_id: user.id,
        p_reason: 'deposit_changed',
      })
    }

    const reservationId = crypto.randomUUID()
    const paymentReference = `resv_${reservationId}`
    const unitNumberSnapshot = String(unit.unit_number ?? unitNumberFromClient ?? '').trim() || unitId

    const { error: insertErr } = await supabase
      .from('reservations')
      .insert({
        id: reservationId,
        paystack_reference: paymentReference,
        unit_id: unitId,
        user_id: user.id,
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
        zoho_sync_status: 'not_required',
      })

    if (insertErr) {
      console.error('submit-reservation insert error:', insertErr)
      return jsonResponse(500, { error: 'Failed to create reservation' })
    }

    const initialized = await initializePaystackCharge(paymentReference, email, amountInCents)
    if ('error' in initialized) {
      await supabase.rpc('cancel_reservation_by_reference_v2', {
        p_payment_reference: paymentReference,
        p_user_id: user.id,
        p_reason: 'paystack_initialize_failed',
      })
      return jsonResponse(502, { error: initialized.error })
    }

    // Best-effort profile enrichment so records are consistent across flows.
    await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        id_passport_number: idPassport,
        reason_for_buying: reasonForBuying,
      })
      .eq('id', user.id)

    return jsonResponse(200, {
      success: true,
      reservationId,
      paymentReference,
      amountInCents,
      currency: 'ZAR',
      email,
      accessCode: initialized.accessCode,
      message: 'Reservation created. Proceed to payment.',
    })
  } catch (error: any) {
    console.error('submit-reservation error:', error)
    return jsonResponse(500, { error: 'Internal server error', details: error?.message })
  }
})
