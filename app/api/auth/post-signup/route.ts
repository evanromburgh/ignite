import { NextResponse } from 'next/server'
import { jsonError, requireUser } from '@/lib/api'
import { assignAgentFromZohoUser } from '@/lib/assigned-agent'
import { createAgentAssignmentStore } from '@/lib/assigned-agent-store'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { SIGNUP_INTERESTS, SIGNUP_REASONS } from '@/lib/signup-options'
import { createServiceClient } from '@/lib/supabase'
import { findOrCreateZohoLead } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

const INTERESTS = new Set<string>(SIGNUP_INTERESTS)
const REASONS = new Set<string>(SIGNUP_REASONS)

function bounded(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

export async function POST(request: Request) {
  const ip = clientIp(request.headers.get('x-forwarded-for'))
  if (!rateLimit(`post-signup:${ip}`, 10, 10 * 60_000)) {
    return jsonError(429, 'Too many attempts. Try again shortly.')
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const userId = bounded(body?.userId, 64)
  const email = bounded(body?.email, 254).toLowerCase()
  const firstName = bounded(body?.firstName, 80)
  const lastName = bounded(body?.lastName, 80)
  const phoneRaw = bounded(body?.phone, 20)
  const idRaw = bounded(body?.idPassport, 32).replace(/\D/g, '')
  const interestRaw = bounded(body?.interestedIn, 80)
  const reasonRaw = bounded(body?.reasonForBuying, 80)
  const phone = /^\+\d{8,15}$/.test(phoneRaw) ? phoneRaw : ''
  const idPassport = idRaw.length === 13 ? idRaw : ''
  const interestedIn = INTERESTS.has(interestRaw) ? interestRaw : ''
  const reasonForBuying = REASONS.has(reasonRaw) ? reasonRaw : ''

  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !firstName || !lastName) {
    return jsonError(400, 'Missing required signup fields')
  }

  const caller = await requireUser(request)
  if (caller instanceof NextResponse) return caller
  if (caller.user.id !== userId) return jsonError(403, 'Forbidden')
  const authEmail = String(caller.user.email ?? '').trim().toLowerCase()
  if (!authEmail || authEmail !== email) return jsonError(400, 'User/email mismatch')
  if (!rateLimit(`post-signup-user:${userId}`, 5, 10 * 60_000)) {
    return jsonError(429, 'Too many attempts. Try again shortly.')
  }

  let supabase
  try {
    supabase = createServiceClient()
  } catch {
    return jsonError(500, 'Server configuration error')
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
  let ownerId: string | null = null
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
      ownerId = lead.ownerId
      const { error: leadWriteErr } = await supabase.from('profiles').update({ zoho_lead_id: zohoLeadId }).eq('id', userId)
      if (leadWriteErr) {
        console.error('post-signup zoho id save failed', leadWriteErr.message)
        zohoLeadId = null
        zohoLeadCreated = false
        ownerId = null
      }
    } catch (error) {
      console.error('post-signup zoho sync failed', error instanceof Error ? error.message : error)
      zohoLeadId = null
      zohoLeadCreated = false
      ownerId = null
    }
  }

  if (zohoLeadCreated && zohoLeadId && ownerId) {
    try {
      await assignAgentFromZohoUser(userId, ownerId, createAgentAssignmentStore(supabase))
    } catch (error) {
      console.error('post-signup agent assignment failed', error instanceof Error ? error.message : error)
    }
  }

  return NextResponse.json({ ok: true })
}
