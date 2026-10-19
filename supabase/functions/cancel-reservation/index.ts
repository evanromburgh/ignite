/// <reference path="../edge-runtime.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRole)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Unauthorized' })

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData.user) return json(401, { error: 'Unauthorized' })

    const body = await req.json().catch(() => null) as { paymentReference?: string } | null
    const paymentReference = String(body?.paymentReference ?? '').trim()
    if (!paymentReference) return json(400, { error: 'paymentReference is required' })

    const { data, error } = await supabase.rpc('cancel_reservation_by_reference_v2', {
      p_payment_reference: paymentReference,
      p_user_id: authData.user.id,
      p_reason: 'user_cancelled',
    })

    if (error) {
      const message = String(error?.message ?? '')
      if (message.toLowerCase().includes('forbidden')) return json(403, { error: 'Forbidden' })
      if (message.toLowerCase().includes('not found')) return json(404, { error: 'Reservation not found' })
      console.error('cancel-reservation rpc error:', error)
      return json(500, { error: 'Failed to cancel reservation' })
    }

    const row = data?.[0]
    return json(200, {
      success: true,
      reservationId: row?.reservation_id ?? null,
      status: row?.status ?? null,
      wasPaid: row?.was_paid ?? false,
    })
  } catch (err: any) {
    console.error('cancel-reservation error:', err)
    return json(500, { error: 'Internal server error', details: err?.message })
  }
})
