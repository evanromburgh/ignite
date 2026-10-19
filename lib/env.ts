export function publicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return { url: url.replace(/\/$/, ''), anonKey }
}

export function serviceEnv(): { url: string; serviceRoleKey: string } {
  const { url } = publicEnv()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''
  if (!serviceRoleKey) {
    throw new Error('Server configuration error')
  }
  return { url, serviceRoleKey }
}
