import { NextResponse } from 'next/server'
import { jsonError, requireUser } from '@/lib/api'
import { submitReservation } from '@/lib/checkout'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireUser(request).catch(() => jsonError(500, 'Server configuration error'))
  if (auth instanceof NextResponse) return auth
  const body = await request.json().catch(() => null)
  try {
    const result = await submitReservation(auth.user.id, body)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('submit reservation failed', error)
    return jsonError(500, 'Internal server error')
  }
}
