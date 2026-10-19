import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 60_000
const LIMIT = 8

export async function POST(request: Request) {
  const ip = clientIp(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))
  if (!rateLimit(`check-email:${ip}`, LIMIT, WINDOW_MS)) {
    return jsonError(429, 'Too many email checks. Try again shortly.')
  }

  let email = ''
  try {
    const body = await request.json()
    email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  } catch {
    return jsonError(400, 'Email is required')
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError(400, 'Email is required')
  }

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('auth_user_exists', { lookup_email: email })
    if (error) {
      console.error('check-email lookup failed:', error.message)
      return jsonError(500, 'Email lookup failed')
    }
    return NextResponse.json({ exists: Boolean(data) })
  } catch (error) {
    console.error('check-email misconfigured:', error instanceof Error ? error.message : error)
    return jsonError(500, 'Email lookup failed')
  }
}
