import { NextResponse } from 'next/server'
import { jsonError, requireUser } from '@/lib/api'
import { cancelReservation } from '@/lib/checkout'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireUser(request).catch(() => jsonError(500, 'Server configuration error'))
  if (auth instanceof NextResponse) return auth
  const body = await request.json().catch(() => null) as { paymentReference?: string } | null
  try {
    const result = await cancelReservation(auth.user.id, String(body?.paymentReference ?? '').trim())
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('cancel reservation failed', error)
    return jsonError(500, 'Internal server error')
  }
}
