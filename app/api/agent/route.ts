import { NextResponse } from 'next/server'
import { jsonError, requireUser } from '@/lib/api'
import { resolveFromAssignment } from '@/lib/assigned-agent'
import { AgentAssignmentError, createAgentAssignmentStore } from '@/lib/assigned-agent-store'
import { rateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase'
import { readZohoLeadOwnerId } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

function agentError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE })
}

export async function GET(request: Request) {
  const auth = await requireUser(request).catch(() => jsonError(500, 'Server configuration error'))
  if (auth instanceof NextResponse) {
    auth.headers.set('Cache-Control', 'private, no-store')
    return auth
  }

  let supabase
  try {
    supabase = createServiceClient()
  } catch {
    return agentError(500, 'Server configuration error')
  }

  const store = createAgentAssignmentStore(supabase)
  let current
  try {
    current = await store.readAssignment(auth.user.id)
  } catch (error) {
    console.error('assigned agent lookup failed', error instanceof Error ? error.message : error)
    return agentError(500, 'Could not load your agent')
  }

  if (current.agentId || !current.zohoLeadId) {
    return NextResponse.json(
      { agent: current.agentId ? current.agent : null, pending: false },
      { headers: NO_STORE },
    )
  }

  if (!rateLimit(`lead-owner:${auth.user.id}`, 8, 120_000)) {
    return NextResponse.json({ agent: null, pending: true }, { headers: NO_STORE })
  }

  try {
    const result = await resolveFromAssignment(auth.user.id, current, store, readZohoLeadOwnerId)
    return NextResponse.json(result, { headers: NO_STORE })
  } catch (error) {
    console.error('assigned agent owner read failed', error instanceof Error ? error.message : error)
    const status = error instanceof AgentAssignmentError ? 500 : 502
    return agentError(status, 'Could not load your agent')
  }
}
