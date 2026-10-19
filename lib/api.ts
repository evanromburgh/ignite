import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase'

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status })
}

export async function requireUser(request: Request): Promise<{ user: User; token: string } | NextResponse> {
  const header = request.headers.get('authorization')
  const token = header?.replace(/^Bearer\s+/i, '').trim() ?? ''
  if (!token) return jsonError(401, 'Unauthorized')
  const supabase = createServiceClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return jsonError(401, 'Invalid or expired session')
  return { user: data.user, token }
}

export function readUnitId(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const unitId = (body as Record<string, unknown>).unitId
  return typeof unitId === 'string' ? unitId.trim() : ''
}
