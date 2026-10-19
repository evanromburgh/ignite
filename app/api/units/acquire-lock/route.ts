import { NextResponse } from 'next/server'
import { jsonError, readUnitId, requireUser } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireUser(request).catch(() => jsonError(500, 'Server configuration error'))
  if (auth instanceof NextResponse) return auth
  const body = await request.json().catch(() => null)
  const unitId = readUnitId(body)
  if (!unitId) return jsonError(400, 'unitId is required')

  const supabase = createServiceClient()
  const { data: settings, error: settingsError } = await supabase
    .from('project_settings')
    .select('lock_duration_ms')
    .eq('id', 1)
    .single()
  const lockDurationMs = Number(settings?.lock_duration_ms)
  if (settingsError || !Number.isFinite(lockDurationMs) || lockDurationMs <= 0) {
    return jsonError(500, 'Failed to reserve unit')
  }

  const lockExpiresAt = new Date(Date.now() + lockDurationMs).toISOString()
  const nowIso = new Date().toISOString()
  const { data: existingUnit, error: existsError } = await supabase
    .from('units')
    .select('id, locked_by, lock_expires_at, status')
    .eq('id', unitId)
    .maybeSingle()
  if (existsError) return jsonError(500, 'Failed to reserve unit')
  if (!existingUnit) return jsonError(404, 'Unit not found')
  if (String(existingUnit.status ?? '').trim() !== 'Available') {
    return jsonError(409, 'This unit is no longer available for reservation.')
  }

  const lockedBy = existingUnit.locked_by == null ? null : String(existingUnit.locked_by)
  const lockExpiresRaw = existingUnit.lock_expires_at == null ? null : String(existingUnit.lock_expires_at)
  const lockActive = lockStillActive(lockExpiresRaw, nowIso)
  if (lockActive && lockedBy && lockedBy !== auth.user.id) {
    return jsonError(409, 'This unit is currently being reserved. Try again shortly.')
  }
  if (lockActive && lockedBy === auth.user.id && lockExpiresRaw) {
    return NextResponse.json({ ok: true, lockExpiresAt: lockExpiresRaw })
  }

  let update = supabase
    .from('units')
    .update({ lock_expires_at: lockExpiresAt, locked_by: auth.user.id })
    .eq('id', unitId)
    .eq('status', 'Available')
  update = lockedBy == null ? update.is('locked_by', null) : update.eq('locked_by', lockedBy)
  update = lockExpiresRaw == null ? update.is('lock_expires_at', null) : update.eq('lock_expires_at', lockExpiresRaw)
  const { data: updatedRows, error: setError } = await update.select('id')
  if (setError) return jsonError(500, 'Failed to reserve unit')
  if (!updatedRows?.length) {
    const held = await lockHeldByUser(supabase, unitId, auth.user.id)
    if (held) return NextResponse.json({ ok: true, lockExpiresAt: held })
    return jsonError(409, 'This unit is currently being reserved. Try again shortly.')
  }
  return NextResponse.json({ ok: true, lockExpiresAt })
}

function lockStillActive(lockExpiresAt: string | null, nowIso: string) {
  if (!lockExpiresAt) return false
  const expiresMs = Date.parse(lockExpiresAt)
  if (Number.isFinite(expiresMs)) return expiresMs > Date.parse(nowIso)
  return lockExpiresAt > nowIso
}

async function lockHeldByUser(
  supabase: ReturnType<typeof createServiceClient>,
  unitId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('units')
    .select('status, locked_by, lock_expires_at')
    .eq('id', unitId)
    .maybeSingle()
  if (error || !data) return null
  if (String(data.status ?? '').trim() !== 'Available') return null
  const lockedBy = data.locked_by == null ? null : String(data.locked_by)
  const lockExpiresAt = data.lock_expires_at == null ? null : String(data.lock_expires_at)
  if (lockedBy !== userId || !lockStillActive(lockExpiresAt, new Date().toISOString())) return null
  return lockExpiresAt
}
