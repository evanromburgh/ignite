import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { parseReservationReference } from '../_shared/reservationReference.ts'
import { createServiceRoleClient, jsonOk, optionsResponse } from '../_shared/http.ts'
import { processSingleZohoSync } from '../_shared/zohoSyncJob.ts'

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse()
  }

  try {
    const supabase = createServiceRoleClient()

    const bodyText = await req.text()
    const payload = JSON.parse(bodyText || '{}')
    const event = String(payload?.event ?? '')
    const data = payload?.data ?? {}
    const reference = String(data?.reference ?? '').trim()
    if (!reference) return jsonOk()

    const paystackSecret = (Deno.env.get('PAYSTACK_SECRET_KEY') ?? '').trim()
    if (paystackSecret) {
      const signature = req.headers.get('x-paystack-signature') || ''
      const expected = await hmacSha512Hex(paystackSecret, bodyText)
      if (signature !== expected) {
        console.error('payment-webhook signature mismatch')
        return jsonOk()
      }
    }

    const parsed = parseReservationReference(reference)
    if (!parsed) {
      console.error('payment-webhook invalid reference format:', reference)
      return jsonOk()
    }

    const isSuccess = event === 'charge.success' && String(data?.status ?? '').toLowerCase() === 'success'
    const isFailure = event === 'charge.failed' || event === 'charge.reversed' || String(data?.status ?? '').toLowerCase() === 'failed'

    if (isFailure) {
      await supabase.rpc('cancel_reservation_by_reference_v2', {
        p_payment_reference: reference,
        p_user_id: null,
        p_reason: 'paystack_failed',
      })
      return jsonOk()
    }

    if (!isSuccess) return jsonOk()

    const { data: reservation, error: reservationErr } = await supabase
      .from('reservations')
      .select('amount_cents')
      .eq('paystack_reference', reference)
      .maybeSingle()
    const paidAmount = Number(data?.amount)
    if (reservationErr || !reservation || paidAmount !== Number(reservation.amount_cents)) {
      console.error('payment-webhook amount mismatch', { reference, paidAmount, expected: reservation?.amount_cents })
      return jsonOk()
    }

    const { data: finalizedRows, error: finalizeErr } = await supabase.rpc('finalize_reservation_payment_v2', {
      p_payment_reference: reference,
      p_paystack_payload: payload,
    })

    if (finalizeErr) {
      console.error('payment-webhook finalize error:', finalizeErr)
      return jsonOk()
    }

    const finalized = finalizedRows?.[0]
    if (!finalized?.reservation_id) return jsonOk()

    if (finalized.enqueued_job) {
      await processSingleZohoSync(supabase, String(finalized.reservation_id))
    }

    return jsonOk()
  } catch (err) {
    console.error('payment-webhook error:', err)
    return jsonOk()
  }
})
