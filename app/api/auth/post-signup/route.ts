import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api'
import { publicEnv } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const userId = String(body?.userId ?? '').trim()
  const email = String(body?.email ?? '').trim().toLowerCase()
  const firstName = String(body?.firstName ?? '').trim()
  const lastName = String(body?.lastName ?? '').trim()
  const phone = String(body?.phone ?? '').trim()
  const idPassport = String(body?.idPassport ?? '').trim()
  const reasonForBuying = String(body?.reasonForBuying ?? '').trim()

  if (!userId || !email || !firstName || !lastName) {
    return jsonError(400, 'Missing required signup fields')
  }

  let supabase
  try {
    supabase = createServiceClient()
  } catch {
    return jsonError(500, 'Server configuration error')
  }

  const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(userId)
  if (userErr || !userRes.user) return jsonError(404, 'User not found')
  const authEmail = String(userRes.user.email ?? '').trim().toLowerCase()
  if (!authEmail || authEmail !== email) return jsonError(400, 'User/email mismatch')
  const createdMs = userRes.user.created_at ? new Date(userRes.user.created_at).getTime() : NaN
  if (Number.isFinite(createdMs) && Date.now() - createdMs > 30 * 60 * 1000) {
    return jsonError(403, 'Post-signup window expired')
  }

  const updates: Record<string, string> = { first_name: firstName, last_name: lastName }
  if (phone) updates.phone = phone
  if (idPassport) updates.id_passport_number = idPassport
  if (reasonForBuying) updates.reason_for_buying = reasonForBuying
  const { error: profileErr } = await supabase.from('profiles').update(updates).eq('id', userId)
  if (profileErr) console.error('post-signup profile update failed', profileErr.message)

  try {
    const { url } = publicEnv()
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''
    await fetch(`${url}/functions/v1/create-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: serviceRoleKey },
      body: JSON.stringify({ firstName, lastName, email, phone, idPassport, reasonForBuying }),
    })
    return NextResponse.json({ ok: true, profileUpdated: !profileErr, leadSynced: true })
  } catch (error) {
    console.error('post-signup create-lead failed', error)
    return NextResponse.json({ ok: true, profileUpdated: !profileErr, leadSynced: false })
  }
}
