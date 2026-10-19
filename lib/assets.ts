export function normalizeUnitsBucketObjectKey(path: string | null | undefined): string | null {
  if (path == null) return null
  let value = String(path).trim().replace(/\r\n?/g, '').replace(/\n/g, '').trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  value = value.replace(/^\/+/, '')
  return value || null
}

export function resolvePublicUrl(supabaseUrl: string, value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const base = supabaseUrl.replace(/\/$/, '')
  return `${base}/storage/v1/object/public/${trimmed.replace(/^\/+/, '')}`
}

export function resolveUnitsObjectUrl(supabaseUrl: string, path: string | null | undefined): string | null {
  const key = normalizeUnitsBucketObjectKey(path)
  if (!key) return null
  if (/^https?:\/\//i.test(key)) return key
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/units/${key}`
}
