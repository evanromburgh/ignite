import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim() ?? ''
  const header = request.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!cronSecret || bearer !== cronSecret) return jsonError(401, 'Unauthorized')

  let supabase
  try {
    supabase = createServiceClient()
  } catch {
    return jsonError(500, 'Server configuration error')
  }

  const { data: settings } = await supabase
    .from('project_settings')
    .select('presence_ttl_ms')
    .eq('id', 1)
    .single()
  const ttl = Number(settings?.presence_ttl_ms)
  if (!Number.isFinite(ttl) || ttl <= 0) return jsonError(500, 'Presence TTL is not configured')

  const { data: units, error } = await supabase.from('units').select('id, viewers')
  if (error || !units?.length) return NextResponse.json({ ok: true, pruned: 0 })

  const now = Date.now()
  let updated = 0
  for (const row of units) {
    const raw = row.viewers
    if (!raw || typeof raw !== 'object') continue
    const pruned: Record<string, number> = {}
    for (const [sid, ts] of Object.entries(raw as Record<string, unknown>)) {
      const timestamp = typeof ts === 'number' ? ts : Number(ts)
      if (!Number.isNaN(timestamp) && now - timestamp <= ttl) pruned[sid] = timestamp
    }
    if (Object.keys(pruned).length !== Object.keys(raw as object).length) {
      const { error: updateError } = await supabase.from('units').update({ viewers: pruned }).eq('id', row.id)
      if (!updateError) updated += 1
    }
  }
  return NextResponse.json({ ok: true, pruned: updated })
}
