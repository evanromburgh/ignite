export function formatZarInteger(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    .format(Math.round(value))
    .replace(/,/g, ' ')
}

export function formatClockMss(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatFloorLabel(floor: string | null | undefined): string {
  const raw = (floor ?? '').trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  const withFloor = lower.includes('floor') ? lower : `${lower} floor`
  return withFloor.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatFacingLabel(direction: string | null | undefined): string {
  const raw = (direction ?? '').trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  const withFacing = lower.includes('facing') ? lower : `${lower} facing`
  return withFacing.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function initialsFromName(name: string, maxChars?: number): string {
  const raw = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  if (maxChars !== undefined && maxChars > 0) return raw.slice(0, maxChars)
  return raw
}

export function depositZar(cents: number): number {
  return cents / 100
}

export function withBrand(template: string, brandName: string): string {
  return template.replaceAll('{brand}', brandName)
}
