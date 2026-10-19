import { resolveUnitsObjectUrl } from '@/lib/assets'
import type { Unit, UnitRow } from '@/lib/types'

export function sortUnitsByUnitNumber(a: Unit, b: Unit): number {
  return a.unitNumber.localeCompare(b.unitNumber)
}

export function insertSortedUnit(list: Unit[], nextUnit: Unit): Unit[] {
  const next = [...list]
  let low = 0
  let high = next.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (sortUnitsByUnitNumber(next[mid], nextUnit) <= 0) low = mid + 1
    else high = mid
  }
  next.splice(low, 0, nextUnit)
  return next
}

function parseLockExpiresAt(raw: unknown): number | undefined {
  if (raw == null) return undefined
  const ms = new Date(raw as string).getTime()
  return Number.isNaN(ms) ? undefined : ms
}

export function filterViewersByPresenceTtl(
  rawViewers: Record<string, number | string>,
  nowMs: number,
  ttlMs: number,
): Record<string, number> {
  const viewers: Record<string, number> = {}
  for (const [key, value] of Object.entries(rawViewers)) {
    const timestamp = typeof value === 'number' ? value : Number(value)
    if (!Number.isNaN(timestamp) && nowMs - timestamp <= ttlMs) viewers[key] = timestamp
  }
  return viewers
}

export function mapUnitRow(
  row: UnitRow,
  supabaseUrl: string,
  presenceTtlMs: number,
  nowMs = Date.now(),
): Unit {
  return {
    id: row.id,
    unitNumber: row.unit_number,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    parking: row.parking,
    sizeSqm: Number(row.size_sqm),
    price: Number(row.price),
    status: row.status,
    unitType: row.unit_type,
    floor: row.floor ?? null,
    direction: row.direction ?? null,
    imageUrl: resolveUnitsObjectUrl(supabaseUrl, row.image_key_1 ?? row.image_url) ?? '',
    imageUrl2: resolveUnitsObjectUrl(supabaseUrl, row.image_key_2),
    imageUrl3: resolveUnitsObjectUrl(supabaseUrl, row.image_key_3),
    floorplanUrl: resolveUnitsObjectUrl(supabaseUrl, row.floorplan_key),
    viewers: filterViewersByPresenceTtl(row.viewers ?? {}, nowMs, presenceTtlMs),
    lockExpiresAt: parseLockExpiresAt(row.lock_expires_at),
    lockedBy: row.locked_by ?? undefined,
  }
}
