'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Autoplay, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import 'swiper/css/pagination'
import { DEFAULT_FILTERS, filterUnits, filtersFromSearchParams, searchParamsFromFilters } from '@/lib/filters'
import { PAYMENT_CANCELLED_TOAST } from '@/lib/reserve'
import type { SearchFilters, SiteMapRecord, Unit, ViewMode } from '@/lib/types'
import { useAuth } from '@/components/auth/auth-provider'
import { useSettings } from '@/components/settings-context'
import { ChatWidget } from '@/components/chat/chat-widget'
import { FilterBar } from '@/components/catalog/filter-bar'
import { SitePlans } from '@/components/catalog/site-plans'
import { UnitCard, UnitListRow } from '@/components/catalog/unit-card'
import { useReserveFlow } from '@/components/catalog/reserve-flow'
import { UnitDialog } from '@/components/unit/unit-dialog'
import { useServerClock } from '@/components/catalog/use-clock'
import { useUnits } from '@/components/catalog/use-units'
import { useWishlist } from '@/components/catalog/use-wishlist'

export function HomePage({ maps }: { maps: SiteMapRecord[] }) {
  const settings = useSettings()
  const { user } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const { units, loading, error } = useUnits()
  const wishlist = useWishlist()
  const offsetMs = useServerClock()
  const { reservingUnitId, reserveUnit } = useReserveFlow('Could not reserve unit.')
  const initial = filtersFromSearchParams(new URLSearchParams(params.toString()))
  const [filters, setFilters] = useState<SearchFilters>(initial.filters)
  const [viewMode, setViewMode] = useState<ViewMode>(initial.viewMode)
  const [plansMounted, setPlansMounted] = useState(initial.viewMode === 'PLANS')
  const [drawer, setDrawer] = useState<'closed' | 'open' | 'closing'>('closed')
  const [toast, setToast] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const wishlistIds = useMemo(() => new Set(wishlist.ids), [wishlist.ids])
  const displayed = useMemo(() => filterUnits(units, filters, wishlistIds), [units, filters, wishlistIds])
  const availableShown = displayed.filter((unit) => unit.status === 'Available').length
  const selected = useMemo(() => units.find((unit) => unit.id === selectedId) ?? null, [units, selectedId])
  const sold = units.filter((unit) => unit.status === 'Sold' || unit.status === 'Reserved').length

  useEffect(() => {
    if (drawer !== 'closing') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = window.matchMedia('(max-width: 639px)').matches
    const id = window.setTimeout(() => setDrawer('closed'), reduce ? 0 : mobile ? 700 : 300)
    return () => window.clearTimeout(id)
  }, [drawer])

  useEffect(() => {
    if (drawer !== 'open') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawer('closing')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer])

  function closeDrawer() {
    setDrawer((current) => (current === 'open' ? 'closing' : current))
  }

  function resetFilters() {
    setFilters({ ...DEFAULT_FILTERS })
    setViewMode('GRID')
  }

  useEffect(() => {
    if (sessionStorage.getItem(PAYMENT_CANCELLED_TOAST)) {
      sessionStorage.removeItem(PAYMENT_CANCELLED_TOAST)
      setToast(true)
    }
  }, [])

  useEffect(() => {
    const next = searchParamsFromFilters(filters, viewMode, new URLSearchParams(params.toString()))
    const current = params.toString()
    if (next.toString() !== current) router.replace(next.toString() ? `/?${next.toString()}` : '/', { scroll: false })
  }, [filters, viewMode, params, router])

  function openUnit(unit: Unit) {
    setSelectedId(unit.id)
  }

  return (
    <div className="min-h-screen">
      {toast ? (
        <div className="fixed bottom-4 right-4 z-[100] max-w-[18rem] rounded-lg border border-amber-400 bg-amber-50 text-amber-900 px-3 py-2 flex items-center gap-2 shadow-lg">
          <p className="text-xs font-medium whitespace-nowrap">Payment cancelled. The unit remains available.</p>
          <button type="button" aria-label="Dismiss" onClick={() => setToast(false)} className="shrink-0 text-amber-600 hover:text-amber-800 transition-colors duration-500 p-0.5">×</button>
        </div>
      ) : null}
      <header className="nav-section dark relative min-h-svh h-svh sm:min-h-screen sm:h-screen overflow-hidden bg-theme-bg">
        <div className="absolute inset-0 z-10">
          <Swiper modules={[Pagination, Autoplay]} className="hero-swiper h-full w-full" pagination={{ clickable: true }} autoplay={{ delay: 5000, disableOnInteraction: false }} loop={settings.heroImageUrls.length > 1} grabCursor speed={500}>
            {settings.heroImageUrls.map((slide, index) => (
              <SwiperSlide key={slide}>
                <div className="relative h-full w-full overflow-hidden bg-zinc-800">
                  <div className="absolute inset-0 z-10 pointer-events-none bg-black/40" aria-hidden="true" />
                  <img src={slide} alt={`Slide ${index + 1}`} className="w-full h-full object-cover ken-burns pointer-events-none select-none" />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
        <div className="relative z-20 flex min-h-full flex-col justify-center items-center px-5 pt-0 pb-0 sm:pt-24 sm:pb-32 sm:px-8 md:px-24 lg:px-40 xl:px-56 pointer-events-none">
          <h1 className="text-center text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight mb-3">Browse Units</h1>
          <p className="text-center text-sm sm:text-base text-zinc-300/90 font-medium mt-1">{loading ? 'APARTMENTS' : `${units.length} ${units.length === 1 ? 'APARTMENT' : 'APARTMENTS'}`}</p>
        </div>
      </header>
      <div className="w-full px-4 sm:px-[15rem] mt-5">
        <button type="button" aria-label="Open filters" onClick={() => setDrawer('open')} className="w-full h-12 rounded-xl text-[12px] font-bold uppercase tracking-widest transition-[background-color,color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] flex items-center justify-center gap-2 shadow-sm bg-white text-[#18181B] hover:bg-[#18181B] hover:text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          Show Filters
        </button>
      </div>
      {drawer !== 'closed' ? (
        <div className="filters-drawer fixed inset-0 z-[3200]" data-state={drawer === 'closing' ? 'closing' : 'open'} role="dialog" aria-modal="true" aria-label="Filter units">
          <div className="mobile-menu-overlay absolute inset-0 bg-black/40" data-state={drawer === 'closing' ? 'closing' : 'open'} onClick={closeDrawer} />
          <div className="filters-drawer-panel pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center sm:inset-x-[10rem] sm:bottom-5">
            <button type="button" className="mobile-menu-close pointer-events-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#18181B]" data-state={drawer === 'closing' ? 'closing' : 'open'} aria-label="Close" onClick={closeDrawer}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M17.658 6.343 6.344 17.657M17.658 17.657 6.344 6.343" /></svg>
            </button>
            <div className="mobile-menu-sheet filters-drawer-scroll pointer-events-auto flex h-[60vh] w-full flex-col overflow-x-hidden overflow-y-auto rounded-t-md bg-white px-6 pb-6 pt-6 sm:h-auto sm:max-h-[75vh] sm:rounded-2xl" data-state={drawer === 'closing' ? 'closing' : 'open'}>
              <FilterBar filters={filters} unitTypes={unique(units.map((unit) => unit.unitType))} floors={unique(units.map((unit) => unit.floor ?? ''))} directions={unique(units.map((unit) => unit.direction ?? ''))} embedded hideClear onChange={setFilters} onClear={resetFilters} />
              <div className="mt-4 flex items-center justify-end sm:justify-between">
                <p className="hidden text-xs font-medium text-zinc-500 sm:block">{availableShown} of {units.length} units</p>
                <button type="button" onClick={resetFilters} className="filter-bar-clear hidden items-center gap-2 text-xs font-medium text-zinc-500 underline underline-offset-2 transition-colors duration-500 hover:text-zinc-300 sm:inline-flex">
                  <svg className="w-[13px] h-[13px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Clear All Filters
                </button>
                <button type="button" onClick={resetFilters} className="inline-flex h-[2.375rem] w-full items-center justify-center rounded-lg bg-[#18181B] px-4 text-xs font-medium text-white transition-colors duration-500 hover:bg-zinc-800 sm:hidden">Reset Filter</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mt-10 mb-[2.5rem] w-full flex justify-center px-2">
        <div className="w-full max-w-lg flex flex-col items-center">
          <div className="text-center mb-[1.25rem]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black">Choose your view</p>
            <p className="mt-1 text-[13px] text-black">Switch how you browse units: <span className="font-semibold">Grid</span>, <span className="font-semibold">List</span>, or <span className="font-semibold">Plans</span>.</p>
          </div>
          <ViewSwitcher mode={viewMode} onChange={(next) => { if (next === 'PLANS') setPlansMounted(true); setViewMode(next) }} />
        </div>
      </div>
      <p className="text-center text-[16px] font-semibold uppercase text-[#18181B] mb-[1.25rem]">{loading ? 'UNITS SOLD' : `${sold} OF ${units.length} UNITS SOLD`}</p>
      <section className="nav-section light w-full px-4 sm:px-[5rem] sm:pb-20">
        {plansMounted ? <div hidden={viewMode !== 'PLANS'}><SitePlans maps={maps} units={units} onSelect={openUnit} /></div> : null}
        <div hidden={viewMode === 'PLANS'}>
        {loading ? <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] gap-[1.25rem]">{Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[3/4] bg-zinc-200 rounded-xl animate-pulse" />)}</div> : null}
        {error ? <p className="text-red-600 text-sm">{error}</p> : null}
        {!loading && !error && displayed.length === 0 ? <div className="text-center py-48 bg-white rounded-xl border border-theme-border"><h3 className="text-2xl md:text-3xl font-black text-zinc-600 uppercase tracking-[0.5em]">No Matches</h3></div> : null}
        {!loading && !error && displayed.length > 0 ? (
          <div className={viewMode === 'GRID' ? 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] gap-[1.25rem]' : 'hidden'}>
            {displayed.map((unit) => <UnitCard key={unit.id} unit={unit} wishlisted={wishlistIds.has(unit.id)} offsetMs={offsetMs} currentUserId={user?.id ?? null} reservingUnitId={reservingUnitId} onSelect={openUnit} onReserve={reserveUnit} onToggleWishlist={wishlist.toggle} />)}
          </div>
        ) : null}
        {!loading && !error && displayed.length > 0 ? (
          <div className={viewMode === 'LIST' ? 'space-y-5 sm:space-y-3' : 'hidden'}>
            {displayed.map((unit) => <UnitListRow key={unit.id} unit={unit} wishlisted={wishlistIds.has(unit.id)} offsetMs={offsetMs} currentUserId={user?.id ?? null} reservingUnitId={reservingUnitId} onSelect={openUnit} onReserve={reserveUnit} onToggleWishlist={wishlist.toggle} />)}
          </div>
        ) : null}
        </div>
      </section>
      <ChatWidget />
      <UnitDialog unit={selected} offsetMs={offsetMs} wishlisted={selected ? wishlistIds.has(selected.id) : false} reservingUnitId={reservingUnitId} onClose={() => setSelectedId(null)} onReserve={reserveUnit} onToggleWishlist={wishlist.toggle} />
    </div>
  )
}

const VIEW_TABS = [
  ['GRID', 'Grid', 'h-4 w-4', 'M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5z'],
  ['LIST', 'List', 'h-4 w-4', 'M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m-3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2m0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2m0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2'],
  ['PLANS', 'Plans', 'h-3.5 w-3.5', 'M14.763.075A.5.5 0 0 1 15 .5v15a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5V14h-1v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V10a.5.5 0 0 1 .342-.474L6 7.64V4.5a.5.5 0 0 1 .276-.447l8-4a.5.5 0 0 1 .487.022M6 8.694 1 10.36V15h5zM7 15h2v-1.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V15h2V1.309l-7 3.5z M2 11h1v1H2zm2 0h1v1H4zm-2 2h1v1H2zm2 0h1v1H4zm4-4h1v1H8zm2 0h1v1h-1zm-2 2h1v1H8zm2 0h1v1h-1zm2-2h1v1h-1zm0 2h1v1h-1zM8 7h1v1H8zm2 0h1v1h-1zm2 0h1v1h-1zM8 5h1v1H8zm2 0h1v1h-1zm2 0h1v1h-1zm0-2h1v1h-1z'],
] as const

function measurePill(container: HTMLElement, mode: ViewMode) {
  const activeBtn = container.querySelector<HTMLElement>(`[data-view-mode="${mode}"]`)
  if (!activeBtn) return null
  const containerRect = container.getBoundingClientRect()
  const buttonRect = activeBtn.getBoundingClientRect()
  const pad = 4
  const left = mode === 'GRID' ? pad : buttonRect.left - containerRect.left - 1
  return {
    left: Math.round(left),
    top: pad,
    width: Math.round(buttonRect.width),
    height: Math.max(0, Math.round(containerRect.height - pad * 2)),
  }
}

function ViewSwitcher({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const delayRef = useRef(0)
  const [highlight, setHighlight] = useState(mode)
  const [pillReady, setPillReady] = useState(false)
  const [pill, setPill] = useState({ left: 4, top: 4, width: 0, height: 0 })

  function place(next: ViewMode) {
    const container = containerRef.current
    if (!container) return
    const nextPill = measurePill(container, next)
    if (nextPill) setPill(nextPill)
  }

  useLayoutEffect(() => {
    place(highlight)
    setPillReady(true)
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => place(highlight))
    observer.observe(container)
    return () => observer.disconnect()
  }, [highlight])

  useEffect(() => {
    setHighlight(mode)
  }, [mode])

  useEffect(() => () => window.clearTimeout(delayRef.current), [])

  function select(next: ViewMode) {
    if (next === highlight) return
    place(next)
    setHighlight(next)
    window.clearTimeout(delayRef.current)
    delayRef.current = window.setTimeout(() => onChange(next), 360)
  }

  return (
    <div ref={containerRef} className="relative inline-flex w-full max-w-[95%] sm:max-w-xl items-center rounded-full bg-white p-1" role="tablist" aria-label="View switcher">
      <div className={`view-switcher-pill absolute z-0 rounded-full will-change-[left,width,height] ${pillReady ? 'transition-[left,width,height] duration-300 ease-out' : ''}`} style={{ left: pill.left, top: pill.top, width: pill.width, height: pill.height, background: 'rgb(24, 24, 27)' }} />
      {VIEW_TABS.map(([value, label, iconClass, path]) => (
        <button key={value} type="button" data-view-mode={value} aria-pressed={highlight === value} onClick={() => select(value)} className={`relative z-10 flex flex-1 min-h-10 sm:min-h-8 items-center justify-center gap-2 rounded-full bg-transparent px-2 py-2 sm:py-1.5 transition-colors duration-500 ${highlight === value ? 'text-white' : 'text-black'}`} style={{ background: 'transparent' }}>
          <svg className={`${iconClass} shrink-0`} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d={path} /></svg>
          <span className="text-[11px] sm:text-xs font-medium leading-none">{label}</span>
        </button>
      ))}
    </div>
  )
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort()
}
