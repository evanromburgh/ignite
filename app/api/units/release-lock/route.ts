import { NextResponse } from 'next/server'
import { jsonError, readUnitId, requireUser } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireUser(request).catch(() => jsonError(500, 'Server configuration error'))
  if (auth instanceof NextResponse) return auth
  const unitId = readUnitId(await request.json().catch(() => null))
  if (!unitId) return jsonError(400, 'unitId is required')
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('units')
    .update({ lock_expires_at: null, locked_by: null })
    .eq('id', unitId)
    .eq('locked_by', auth.user.id)
  if (error) return jsonError(500, 'Failed to release reservation')
  return NextResponse.json({ ok: true })
}
