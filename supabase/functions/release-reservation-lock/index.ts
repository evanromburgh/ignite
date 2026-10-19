import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createServiceRoleClient, getUserFromBearerToken, jsonResponse, optionsResponse } from '../_shared/http.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse()
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    const supabase = createServiceRoleClient()
    const authUser = await getUserFromBearerToken(req, supabase)
    if (!authUser) return jsonResponse(401, { error: 'Unauthorized' })

    const contentType = req.headers.get('content-type') || ''
    const bodyText = await req.text()
    let reference = ''

    if (contentType.includes('application/json')) {
      const parsed = JSON.parse(bodyText || '{}')
      reference = String(parsed?.paymentReference ?? parsed?.ref ?? '').trim()
    } else {
      const params = new URLSearchParams(bodyText)
      reference = String(params.get('paymentReference') ?? params.get('ref') ?? '').trim()
    }

    if (!reference) return jsonResponse(400, { error: 'Missing payment reference' })

    const { data, error } = await supabase.rpc('cancel_reservation_by_reference_v2', {
      p_payment_reference: reference,
      p_user_id: authUser.id,
      p_reason: 'checkout_abandoned',
    })

    if (error) {
      const message = String(error?.message ?? '')
      if (message.toLowerCase().includes('forbidden')) return jsonResponse(403, { error: 'Forbidden' })
      if (message.toLowerCase().includes('not found')) return jsonResponse(404, { error: 'Reservation not found' })
      return jsonResponse(500, { error: 'Failed to release reservation lock' })
    }

    return jsonResponse(200, {
      ok: true,
      reservationId: data?.[0]?.reservation_id ?? null,
      status: data?.[0]?.status ?? null,
    })
  } catch (err: any) {
    console.error('release-reservation-lock error:', err)
    return jsonResponse(500, { error: 'Internal error', details: err?.message })
  }
})
