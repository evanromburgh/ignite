import { NextResponse } from 'next/server'
import { jsonError, readUnitId, requireUser } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireUser(request).catch(() => jsonError(500, 'Server configuration error'))
  if (auth instanceof NextResponse) return auth
  const unitId = readUnitId(await request.json().catch(() => null))
  if (!unitId) return jsonError(400, 'unitId is required')

  let supabase
  try {
    supabase = createServiceClient()
  } catch {
    return jsonError(500, 'Server configuration error')
  }

  const { data, error } = await supabase.rpc('acquire_unit_lock', {
    p_unit_id: unitId,
    p_user_id: auth.user.id,
    p_now: new Date().toISOString(),
  })
  if (error) return lockError(error)
  if (typeof data !== 'string' || !data) return jsonError(500, 'Failed to reserve unit')
  return NextResponse.json({ ok: true, lockExpiresAt: data })
}

function lockError(error: { code?: string }) {
  switch (error.code) {
    case 'P0002':
      return jsonError(404, 'Unit not found')
    case 'P3001':
      return jsonError(409, 'This unit is no longer available for reservation.')
    case 'P3002':
      return jsonError(409, 'This unit is currently being reserved. Try again shortly.')
    case 'P3004':
      return jsonError(409, 'You already have a reservation in progress.')
    case '22P02':
      return jsonError(400, 'unitId is required')
    default:
      return jsonError(500, 'Failed to reserve unit')
  }
}
