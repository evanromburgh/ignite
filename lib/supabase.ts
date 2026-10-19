import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { publicEnv, serviceEnv } from '@/lib/env'

let browserClient: SupabaseClient | null = null

export function createAnonClient(): SupabaseClient {
  const { url, anonKey } = publicEnv()
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function createServiceClient(): SupabaseClient {
  const { url, serviceRoleKey } = serviceEnv()
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function browserSupabase(): SupabaseClient {
  if (browserClient) return browserClient
  const { url, anonKey } = publicEnv()
  browserClient = createClient(url, anonKey)
  return browserClient
}
