'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Unit } from '@/lib/types'
import { useAuth } from '@/components/auth/auth-provider'
import { useReserveFlow } from '@/components/catalog/reserve-flow'
import { UnitCard } from '@/components/catalog/unit-card'
import { useServerClock } from '@/components/catalog/use-clock'
import { useReservedUnitIds } from '@/components/catalog/use-reserved'
import { useUnits } from '@/components/catalog/use-units'
import { useWishlist } from '@/components/catalog/use-wishlist'
import { UnitDialog } from '@/components/unit/unit-dialog'

export function WishlistPage() {
  const { user } = useAuth()
  const { units, loading, error } = useUnits()
  const wishlist = useWishlist()
  const offsetMs = useServerClock()
  const { reservingUnitId, reserveUnit } = useReserveFlow('Could not reserve unit.')
  const listed = useMemo(() => units.filter((unit) => wishlist.ids.includes(unit.id)), [units, wishlist.ids])
  return (
    <Collection
      title="Wishlist"
      empty="No wishlisted units"
      units={listed}
      loading={loading || wishlist.loading}
      error={error ?? wishlist.error}
      offsetMs={offsetMs}
      currentUserId={user?.id ?? null}
      reservingUnitId={reservingUnitId}
      onReserve={reserveUnit}
      onToggleWishlist={wishlist.toggle}
      wishlisted={(unitId) => wishlist.ids.includes(unitId)}
    />
  )
}

export function ReservationsPage() {
  const { user } = useAuth()
  const wishlist = useWishlist()
  const { reservingUnitId, reserveUnit } = useReserveFlow('Could not reserve unit.')
  const { units, loading, error } = useUnits()
  const reserved = useReservedUnitIds()
  const offsetMs = useServerClock()
  const listed = useMemo(() => units.filter((unit) => reserved.ids.includes(unit.id)), [units, reserved.ids])
  return (
    <Collection
      title="My Units"
      empty="No reserved units"
      units={listed}
      loading={loading || reserved.loading}
      error={error ?? reserved.error}
      offsetMs={offsetMs}
      currentUserId={user?.id ?? null}
      reservingUnitId={reservingUnitId}
      myUnits
      onReserve={reserveUnit}
      onToggleWishlist={wishlist.toggle}
      wishlisted={(unitId) => wishlist.ids.includes(unitId)}
    />
  )
}

function Collection({
  title,
  empty,
  units,
  loading,
  error,
  offsetMs,
  currentUserId,
  reservingUnitId,
  myUnits,
  onReserve,
  onToggleWishlist,
  wishlisted,
}: {
  title: string
  empty: string
  units: Unit[]
  loading: boolean
  error: string | null
  offsetMs: number
  currentUserId: string | null
  reservingUnitId: string | null
  myUnits?: boolean
  onReserve: (unit: Unit) => void
  onToggleWishlist: (unitId: string) => void
  wishlisted: (unitId: string) => boolean
}) {
  const [selected, setSelected] = useState<Unit | null>(null)
  const openUnit = useMemo(() => {
    if (!selected) return null
    return units.find((unit) => unit.id === selected.id) ?? selected
  }, [units, selected])
  return (
    <section className="px-4 sm:px-[5rem] pt-28 sm:pt-36 pb-20">
      <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-8">{title}</h1>
      {loading ? <p className="text-sm text-zinc-500">Loading units...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && !error && units.length === 0 ? (
        <div className="text-center py-48 bg-theme-surface backdrop-blur-3xl rounded-xl border border-theme-border shadow-inner">
          <h3 className="text-2xl md:text-3xl font-black text-zinc-300 uppercase tracking-[0.3em] mb-4">{empty}</h3>
          <Link href="/" className="inline-flex items-center justify-center h-12 px-6 rounded-lg bg-white text-black text-sm font-black uppercase tracking-wider hover:bg-zinc-100 transition-[background-color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">Browse Units</Link>
        </div>
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] gap-[1.25rem]">
        {units.map((unit) => (
          <UnitCard key={unit.id} unit={unit} wishlisted={wishlisted(unit.id)} offsetMs={offsetMs} currentUserId={currentUserId} reservingUnitId={reservingUnitId} myUnits={myUnits} onSelect={setSelected} onReserve={onReserve} onToggleWishlist={onToggleWishlist} />
        ))}
      </div>
      <UnitDialog unit={openUnit} offsetMs={offsetMs} wishlisted={openUnit ? wishlisted(openUnit.id) : false} reservingUnitId={reservingUnitId} onClose={() => setSelected(null)} onReserve={onReserve} onToggleWishlist={onToggleWishlist} />
    </section>
  )
}
