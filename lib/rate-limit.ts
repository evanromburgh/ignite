const hits = new Map<string, number[]>()

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs)
  if (recent.length >= limit) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

export function clientIp(header: string | null): string {
  const first = header?.split(',')[0]?.trim()
  return first || 'unknown'
}
