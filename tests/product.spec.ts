import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolvePublicUrl, resolveUnitsObjectUrl } from '@/lib/assets'
import { DEFAULT_FILTERS, filterUnits } from '@/lib/filters'
import { depositZar, formatClockMss, formatFacingLabel, formatFloorLabel, formatZarInteger } from '@/lib/format'
import { monthlyCosts, reservationChargeCents } from '@/lib/money'
import { rateLimit } from '@/lib/rate-limit'
import { persistReserveSession, resolveReserveAccessToken, shouldWarmAcquireLock } from '@/lib/reserve'
import { approximatePathAnchor } from '@/lib/site-map'
import { insertSortedUnit, mapUnitRow } from '@/lib/units'
import type { Unit, UnitRow } from '@/lib/types'

const ignitePricing = {
  bondRate: 0.01047,
  ratesBase: 850,
  ratesMultiplier: 0.0005,
  levyPerSqm: 24,
  shortTermMultiplier: 1.27,
  longTermMultiplier: 0.86,
}

describe('seeded Ignite pricing', () => {
  it('reproduces the deposit and levy math', () => {
    expect(reservationChargeCents(1_000_000)).toBe(1_000_000)
    expect(depositZar(1_000_000)).toBe(10_000)
    expect(formatZarInteger(10_000)).toBe('10 000')
    const costs = monthlyCosts({ price: 1_814_000, sizeSqm: 75 }, ignitePricing)
    expect(costs.levies).toBe(Math.round(75 * 24))
    expect(costs.rates).toBe(Math.round(850 + 1_814_000 * 0.0005))
    expect(costs.bond).toBe(Math.round(1_814_000 * 0.01047))
  })

  it('rejects a missing deposit instead of using a browser amount', () => {
    expect(() => reservationChargeCents(0)).toThrow(/deposit/i)
  })
})

describe('catalog helpers', () => {
  const unit = (patch: Partial<Unit>): Unit => ({
    id: patch.id ?? '1',
    unitNumber: patch.unitNumber ?? '801',
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    sizeSqm: 65,
    price: patch.price ?? 1_600_000,
    status: patch.status ?? 'Available',
    unitType: patch.unitType ?? 'A1',
    floor: 'Ground',
    direction: 'North',
    imageUrl: '',
    imageUrl2: null,
    imageUrl3: null,
    floorplanUrl: null,
    viewers: {},
    wishlistCount: 0,
    ...patch,
  })

  it('filters with a wishlist set and keeps unit-number order', () => {
    const units = [unit({ id: 'b', unitNumber: '802', price: 2_000_000 }), unit({ id: 'a', unitNumber: '801' })]
    const shown = filterUnits(units, { ...DEFAULT_FILTERS, maxPrice: 1_700_000 }, new Set())
    expect(shown.map((item) => item.unitNumber)).toEqual(['801'])
  })

  it('inserts realtime units in unit-number order', () => {
    const start = [unit({ unitNumber: '801' }), unit({ unitNumber: '803' })]
    expect(insertSortedUnit(start, unit({ unitNumber: '802' })).map((item) => item.unitNumber)).toEqual(['801', '802', '803'])
  })

  it('drops stale viewers using the presence TTL', () => {
    const row: UnitRow = {
      id: '1',
      unit_number: '801',
      bedrooms: 2,
      bathrooms: 1,
      parking: 1,
      size_sqm: 65,
      price: 100,
      status: 'Available',
      unit_type: 'A1',
      viewers: { fresh: 20_000, stale: 0 },
      wishlist_count: 4,
      image_key_1: 'gallery/unit_image_1.webp',
    }
    const mapped = mapUnitRow(row, 'https://example.supabase.co', 12_000, 20_000)
    expect(mapped.viewers).toEqual({ fresh: 20_000 })
    expect(mapped.wishlistCount).toBe(4)
    expect(mapped.imageUrl).toBe('https://example.supabase.co/storage/v1/object/public/units/gallery/unit_image_1.webp')
  })
})

describe('formatting and assets', () => {
  it('formats labels and clocks', () => {
    expect(formatZarInteger(1_500_000.6)).toBe('1 500 001')
    expect(formatClockMss(65)).toBe('1:05')
    expect(formatFloorLabel('ground floor')).toBe('Ground Floor')
    expect(formatFacingLabel('north')).toBe('North Facing')
  })

  it('resolves storage paths without embedding a project URL', () => {
    expect(resolvePublicUrl('https://new.supabase.co/', 'downloads/plan.pdf')).toBe(
      'https://new.supabase.co/storage/v1/object/public/downloads/plan.pdf',
    )
    expect(resolveUnitsObjectUrl('https://new.supabase.co', 'https://cdn.example/a.webp')).toBe('https://cdn.example/a.webp')
    expect(approximatePathAnchor('M 0 0 L 1 1')).toEqual({ x: 0.5, y: 0.5 })
  })
})

describe('reserve session', () => {
  it('prefers the cached token and writes the lock keys', () => {
    expect(resolveReserveAccessToken('cache', 'session', 'hydrated')).toBe('cache')
    expect(shouldWarmAcquireLock(true, false, 'tok')).toBe(true)
    const setItem = viFn()
    persistReserveSession({ setItem }, { unitId: 'u', token: 't', lockExpiresAt: 'soon' })
    setItem.toHaveBeenCalledWith('ignite_reserve_unitId', 'u')
  })
})

describe('email check rate limit', () => {
  it('stops after the limit inside the window', () => {
    expect(rateLimit('email-test', 2, 1_000, 0)).toBe(true)
    expect(rateLimit('email-test', 2, 1_000, 10)).toBe(true)
    expect(rateLimit('email-test', 2, 1_000, 20)).toBe(false)
  })
})

describe('security migrations', () => {
  const schema = fs.readFileSync('supabase/migrations/20261012120000_schema.sql', 'utf8')
  const submit = fs.readFileSync('lib/checkout.ts', 'utf8')
  const seed = fs.readFileSync('supabase/migrations/20261012120400_seed_content.sql', 'utf8')

  it('does not copy the open units update policy', () => {
    expect(schema).not.toMatch(/ON public\.units FOR UPDATE/)
    expect(schema).toContain('auth_user_exists')
    expect(schema).toContain('REVOKE ALL ON FUNCTION public.auth_user_exists')
  })

  it('charges the settings deposit and ignores a browser amount', () => {
    expect(submit).toContain('reservation_deposit_cents')
    expect(submit).not.toContain('amountInZar')
    expect(fs.readFileSync('lib/paystack.ts', 'utf8')).toContain('transaction/initialize')
  })

  it('allows one active unit lock per user', () => {
    const lock = fs.readFileSync('supabase/migrations/20261106104500_one_active_lock_per_user.sql', 'utf8')
    const route = fs.readFileSync('app/api/units/acquire-lock/route.ts', 'utf8')
    expect(lock).toContain('pg_advisory_xact_lock')
    expect(lock).toContain("status = 'payment_pending'")
    expect(lock).toContain('lock_expires_at > p_now')
    expect(lock).toContain('locked_by = NULL')
    expect(lock).toContain('GRANT EXECUTE ON FUNCTION public.acquire_unit_lock(uuid, uuid, timestamptz) TO service_role')
    expect(lock).toContain('p_now + make_interval')
    expect(route).toContain("rpc('acquire_unit_lock'")
    expect(route).toContain('p_now:')
    expect(fs.readFileSync('app/api/server-time/route.ts', 'utf8')).not.toContain('database_now_ms')
    expect(submit).toContain('Your hold on this unit has ended.')
    expect(submit).toContain('You already have a reservation in progress.')
  })

  it('seeds the current documents and a site-plan hotspot', () => {
    expect(seed).toContain('1000000')
    expect(seed).toContain('Site Development Plan')
    expect(seed).toContain('downloads/conduct-rules.pdf')
    expect(seed).toContain("'812'")
    expect(seed).toContain('M 0.0007 0.078')
    expect(seed).not.toContain('cludixdjfecrzdbadynf')
  })
})

function viFn() {
  const calls: unknown[][] = []
  const fn = (...args: unknown[]) => {
    calls.push(args)
  }
  fn.toHaveBeenCalledWith = (...expected: unknown[]) => {
    expect(calls).toContainEqual(expected)
  }
  return fn as ((...args: unknown[]) => void) & { toHaveBeenCalledWith: (...expected: unknown[]) => void }
}
