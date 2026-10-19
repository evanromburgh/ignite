import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { syncPaidReservationToZoho } from '../_shared/zohoReservationSync.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function backoffMs(attempt: number) {
  const minutes = Math.min(2 ** Math.max(0, attempt - 1), 60)
  return minutes * 60_000
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  try {
    const cronSecret = (Deno.env.get('CRON_SECRET') ?? '').trim()
    if (cronSecret) {
      const provided = (req.headers.get('x-cron-secret') ?? '').trim()
      if (!provided || provided !== cronSecret) {
        return json(401, { error: 'Unauthorized' })
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRole)

    const batchSize = Number(Deno.env.get('ZOHO_SYNC_BATCH_SIZE') ?? 10)
    const nowIso = new Date().toISOString()

    const { data: jobs, error: jobsErr } = await supabase
      .from('zoho_sync_jobs')
      .select('id, reservation_id, attempt_count, max_attempts, status')
      .in('status', ['pending', 'retry'])
      .lte('run_after', nowIso)
      .order('run_after', { ascending: true })
      .limit(batchSize)

    if (jobsErr) {
      console.error('zoho-sync-worker jobs query error:', jobsErr)
      return json(500, { error: 'Failed to query jobs' })
    }

    let processed = 0
    let succeeded = 0
    let failed = 0
    let retried = 0

    for (const job of jobs ?? []) {
      const { data: lockedRows, error: lockErr } = await supabase
        .from('zoho_sync_jobs')
        .update({ status: 'processing', locked_at: new Date().toISOString() })
        .eq('id', job.id)
        .in('status', ['pending', 'retry'])
        .select('id')

      if (lockErr || !lockedRows || lockedRows.length === 0) {
        continue
      }

      processed += 1

      try {
        const result = await syncPaidReservationToZoho(supabase, String(job.reservation_id))
        const nextAttempt = Number(job.attempt_count ?? 0) + 1

        await supabase
          .from('reservations')
          .update({
            zoho_sync_status: 'synced',
            zoho_last_error: null,
            zoho_lead_id: result.zohoLeadId,
            zoho_contact_id: result.zohoContactId,
            zoho_reservation_id: result.zohoReservationId,
          })
          .eq('id', job.reservation_id)

        await supabase
          .from('zoho_sync_jobs')
          .update({
            status: 'succeeded',
            attempt_count: nextAttempt,
            last_error: null,
            locked_at: null,
          })
          .eq('id', job.id)

        succeeded += 1
      } catch (err: any) {
        const message = String(err?.message ?? 'Zoho sync failed')
        const nextAttempt = Number(job.attempt_count ?? 0) + 1
        const maxAttempts = Number(job.max_attempts ?? 8)
        const terminalFail = nextAttempt >= maxAttempts

        await supabase
          .from('reservations')
          .update({
            zoho_sync_status: terminalFail ? 'failed' : 'pending',
            zoho_last_error: message,
          })
          .eq('id', job.reservation_id)

        await supabase
          .from('zoho_sync_jobs')
          .update({
            status: terminalFail ? 'failed' : 'retry',
            attempt_count: nextAttempt,
            last_error: message,
            locked_at: null,
            run_after: terminalFail
              ? nowIso
              : new Date(Date.now() + backoffMs(nextAttempt)).toISOString(),
          })
          .eq('id', job.id)

        if (terminalFail) failed += 1
        else retried += 1
      }
    }

    return json(200, {
      ok: true,
      processed,
      succeeded,
      retried,
      failed,
    })
  } catch (err: any) {
    console.error('zoho-sync-worker error:', err)
    return json(500, { error: 'Internal error', details: err?.message })
  }
})
