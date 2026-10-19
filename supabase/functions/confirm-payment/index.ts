import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseReservationReference } from '../_shared/reservationReference.ts'
import { createServiceRoleClient, CORS_HEADERS, getUserFromBearerToken, jsonResponse, optionsResponse } from '../_shared/http.ts'
import { processSingleZohoSync } from '../_shared/zohoSyncJob.ts'

async function hasServiceRoleAccess(supabaseUrl: string, candidateKey: string): Promise<boolean> {
  const key = String(candidateKey ?? '').trim()
  if (!key) return false
  try {
    const probe = createClient(supabaseUrl, key)
    const { error } = await probe.auth.admin.listUsers({ page: 1, perPage: 1 })
    return !error
  } catch {
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse()
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    const supabase = createServiceRoleClient()
    const supabaseUrl = String(Deno.env.get('SUPABASE_URL') ?? '').trim()

    const apiKeyHeader = String(req.headers.get('apikey') ?? '').trim()
    const internalServiceCall = await hasServiceRoleAccess(supabaseUrl, apiKeyHeader)

    if (!internalServiceCall) {
      const user = await getUserFromBearerToken(req, supabase)
      if (!user) return jsonResponse(401, { error: 'Unauthorized' })
    }

    const body = await req.json().catch(() => null) as { paymentReference?: string } | null
    const paymentReference = String(body?.paymentReference ?? '').trim()
    if (!paymentReference) return jsonResponse(400, { error: 'paymentReference is required' })

    const parsed = parseReservationReference(paymentReference)
    if (!parsed) return jsonResponse(400, { error: 'Invalid payment reference format' })

    const paystackSecret = String(Deno.env.get('PAYSTACK_SECRET_KEY') ?? '').trim()
    if (!paystackSecret) return jsonResponse(500, { error: 'PAYSTACK_SECRET_KEY not configured' })

    const verifyUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(paymentReference)}`
    const verifyRes = await fetch(verifyUrl, {
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
    })
    if (!verifyRes.ok) {
      return jsonResponse(502, { error: 'Paystack verify failed', details: await verifyRes.text() })
    }

    const verify = await verifyRes.json().catch(() => ({}))
    const success = Boolean(verify?.status === true && String(verify?.data?.status ?? '').toLowerCase() === 'success')
    if (!success) {
      return jsonResponse(409, { error: 'Payment not successful', verify })
    }

    const { data: reservation, error: reservationErr } = await supabase
      .from('reservations')
      .select('amount_cents')
      .eq('paystack_reference', paymentReference)
      .single()
    const paidAmount = Number(verify?.data?.amount)
    if (reservationErr || !reservation || paidAmount !== Number(reservation.amount_cents)) {
      return jsonResponse(409, { error: 'Paid amount does not match the reservation deposit' })
    }

    const { data: finalizedRows, error: finalizeErr } = await supabase.rpc('finalize_reservation_payment_v2', {
      p_payment_reference: paymentReference,
      p_paystack_payload: { event: 'manual.confirm', data: verify?.data ?? {} },
    })
    if (finalizeErr) {
      console.error('confirm-payment finalize error:', finalizeErr)
      return jsonResponse(500, { error: 'Failed to finalize reservation', details: finalizeErr.message })
    }

    const finalized = finalizedRows?.[0]
    if (finalized?.enqueued_job && finalized?.reservation_id) {
      await processSingleZohoSync(supabase, String(finalized.reservation_id))
    }

    return jsonResponse(200, {
      success: true,
      reservationId: finalized?.reservation_id ?? null,
      status: finalized?.status ?? null,
      alreadyPaid: finalized?.already_paid ?? false,
    })
  } catch (err: any) {
    console.error('confirm-payment error:', err)
    return jsonResponse(500, { error: 'Internal server error', details: err?.message })
  }
})
