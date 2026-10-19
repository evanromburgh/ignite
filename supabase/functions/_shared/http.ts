import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBearerToken } from './auth.ts'

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

export function jsonOk() {
  return new Response('OK', { status: 200, headers: CORS_HEADERS })
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export function createServiceRoleClient() {
  const supabaseUrl = String(Deno.env.get('SUPABASE_URL') ?? '').trim()
  const serviceRole = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
  if (!supabaseUrl || !serviceRole) {
    throw new Error('Supabase service role configuration is missing')
  }
  return createClient(supabaseUrl, serviceRole)
}

export async function getUserFromBearerToken(req: Request, supabase: any) {
  const token = extractBearerToken(req.headers.get('Authorization'))
  if (!token) return null
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) return null
  return authData.user
}
