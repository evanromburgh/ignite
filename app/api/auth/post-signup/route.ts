import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase'
import { findOrCreateZohoLead } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const userId = String(body?.userId ?? '').trim()
  const email = String(body?.email ?? '').trim().toLowerCase()
  const firstName = String(body?.firstName ?? '').trim()
  const lastName = String(body?.lastName ?? '').trim()
  const phone = String(body?.phone ?? '').trim()
  const idPassport = String(body?.idPassport ?? '').trim()
  const interestedIn = String(body?.interestedIn ?? '').trim()
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

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? ''
  let callerId = ''
  if (token) {
    const { data: caller, error: callerErr } = await supabase.auth.getUser(token)
    if (!callerErr && caller.user) callerId = caller.user.id
  }
  const createdMs = userRes.user.created_at ? new Date(userRes.user.created_at).getTime() : NaN
  const withinSignupWindow = Number.isFinite(createdMs) && Date.now() - createdMs <= 30 * 60 * 1000
  if (callerId !== userId && !withinSignupWindow) {
    return jsonError(403, 'Post-signup window expired')
  }

  const updates: Record<string, string> = { first_name: firstName, last_name: lastName }
  if (phone) updates.phone = phone
  if (idPassport) updates.id_passport_number = idPassport
  if (interestedIn) updates.interested_in = interestedIn
  if (reasonForBuying) updates.reason_for_buying = reasonForBuying
  const { error: profileErr } = await supabase.from('profiles').update(updates).eq('id', userId)
  if (profileErr) console.error('post-signup profile update failed', profileErr.message)

  let zohoLeadId: string | null = null
  let zohoLeadCreated = false
  const { data: profile, error: leadReadErr } = await supabase
    .from('profiles')
    .select('zoho_lead_id')
    .eq('id', userId)
    .maybeSingle()
  if (leadReadErr) console.error('post-signup zoho id lookup failed', leadReadErr.message)
  zohoLeadId = String(profile?.zoho_lead_id ?? '').trim() || null

  if (!zohoLeadId && !leadReadErr) {
    try {
      const lead = await findOrCreateZohoLead({ firstName, lastName, email, phone, interestedIn, reasonForBuying, idPassport })
      zohoLeadId = lead.zohoLeadId
      zohoLeadCreated = lead.created
      const { error: leadWriteErr } = await supabase.from('profiles').update({ zoho_lead_id: zohoLeadId }).eq('id', userId)
      if (leadWriteErr) {
        console.error('post-signup zoho id save failed', leadWriteErr.message)
        zohoLeadId = null
        zohoLeadCreated = false
      }
    } catch (error) {
      console.error('post-signup zoho sync failed', error instanceof Error ? error.message : error)
      zohoLeadId = null
      zohoLeadCreated = false
    }
  }

  return NextResponse.json({ ok: true, profileUpdated: !profileErr, zohoLeadId, zohoLeadCreated })
}
