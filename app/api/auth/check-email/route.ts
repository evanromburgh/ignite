import { NextResponse } from 'next/server'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

function emailIsValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: Request) {
  const ip = clientIp(request.headers.get('x-forwarded-for'))
  if (!rateLimit(`check-email:${ip}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429, headers: NO_STORE })
  }

  const body = await request.json().catch(() => null) as { email?: unknown } | null
  const email = String(body?.email ?? '').trim().toLowerCase()
  if (!emailIsValid(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400, headers: NO_STORE })
  }

  let supabase
  try {
    supabase = createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Could not check that email.' }, { status: 500, headers: NO_STORE })
  }

  const { data, error } = await supabase.rpc('auth_user_exists', { lookup_email: email })
  if (error) {
    console.error('email lookup failed', error.message)
    return NextResponse.json({ error: 'Could not check that email.' }, { status: 500, headers: NO_STORE })
  }

  return NextResponse.json({ exists: Boolean(data) }, { headers: NO_STORE })
}
