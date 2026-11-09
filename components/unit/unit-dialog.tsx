'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Autoplay } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import type { Swiper as SwiperInstance } from 'swiper'
import 'swiper/css'
import { formatZarInteger } from '@/lib/format'
import { monthlyCosts } from '@/lib/money'
import type { Unit } from '@/lib/types'
import { useAuth } from '@/components/auth/auth-provider'
import { useLockCountdown } from '@/components/catalog/use-clock'
import { IconBath, IconBed, IconCar, IconHeart, IconLayout, IconSize } from '@/components/icons'
import { useSettings } from '@/components/settings-context'

type UnitDialogProps = {
  unit: Unit | null
  offsetMs: number
  wishlisted: boolean
  reservingUnitId: string | null
  onClose: () => void
  onReserve: (unit: Unit) => void
  onToggleWishlist: (unitId: string) => void
}

export function UnitDialog({ unit, offsetMs, wishlisted, reservingUnitId, onClose, onReserve, onToggleWishlist }: UnitDialogProps) {
  const [mounted, setMounted] = useState(false)
  const [shown, setShown] = useState<Unit | null>(null)
  const [phase, setPhase] = useState<'open' | 'closing'>('open')
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (unit) {
      setShown(unit)
      setPhase('open')
      return
    }
    setPhase('closing')
  }, [unit])
  useEffect(() => {
    if (!shown) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [shown?.id])
  useEffect(() => {
    if (phase !== 'closing') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = window.matchMedia('(max-width: 639px)').matches
    const id = window.setTimeout(() => setShown(null), reduce ? 0 : mobile ? 700 : 300)
    return () => window.clearTimeout(id)
  }, [phase])
  if (!mounted || !shown) return null
  return createPortal(
    <UnitDialogPanel key={shown.id} unit={shown} phase={phase} offsetMs={offsetMs} wishlisted={wishlisted} reservingUnitId={reservingUnitId} onClose={onClose} onReserve={onReserve} onToggleWishlist={onToggleWishlist} />,
    document.body,
  )
}

function UnitDialogPanel({ unit, phase, offsetMs, wishlisted, reservingUnitId, onClose, onReserve, onToggleWishlist }: UnitDialogProps & { unit: Unit; phase: 'open' | 'closing' }) {
  const settings = useSettings()
  const { user } = useAuth()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const [active, setActive] = useState(0)
  const [swiper, setSwiper] = useState<SwiperInstance | null>(null)
  const [lightbox, setLightbox] = useState(false)
  const timeLeft = useLockCountdown(unit.lockExpiresAt, offsetMs)
  const images = useMemo(() => {
    const photos = [unit.imageUrl, unit.imageUrl2, unit.imageUrl3].filter((url): url is string => Boolean(url))
    return unit.floorplanUrl ? [...photos, unit.floorplanUrl] : photos
  }, [unit])
  const costs = monthlyCosts(unit, settings)
  const floorplanIndex = unit.floorplanUrl ? images.length - 1 : -1
  const lockedByOther = Boolean(unit.lockedBy && unit.lockExpiresAt && unit.lockedBy !== user?.id && timeLeft > 0)
  const available = unit.status === 'Available' && !lockedByOther
  const others = Math.max(0, unit.wishlistCount - (wishlisted ? 1 : 0))
  onCloseRef.current = onClose

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus()
    return () => {
      previouslyFocused?.focus()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (lightbox) setLightbox(false)
        else onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((node) => !node.hasAttribute('disabled'))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [lightbox])

  const state = phase === 'closing' ? 'closing' : 'open'

  return (
    <div className="unit-dialog fixed inset-0 z-[4000] flex items-stretch justify-center sm:items-center sm:p-6" data-state={state}>
      <div className="mobile-menu-overlay absolute inset-0 bg-black/50" data-state={state} />
      <button type="button" tabIndex={-1} className="absolute inset-0 cursor-default" aria-label="Close unit details" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="unit-dialog-title" tabIndex={-1} className="unit-dialog-panel relative h-full w-full overflow-x-hidden overflow-y-auto bg-theme-bg outline-none sm:h-auto sm:max-h-[92vh] sm:max-w-7xl sm:rounded-[0.5rem] sm:shadow-2xl" data-state={state} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="absolute right-5 top-5 z-10 flex h-8 w-8 items-start justify-end text-zinc-500 transition-colors duration-500 hover:text-zinc-900 sm:right-12 sm:top-12" aria-label="Close" onClick={onClose}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6l-12 12" /></svg>
        </button>
        {others > 0 ? (
          <p className="pointer-events-none absolute inset-x-12 bottom-12 z-10 hidden text-center text-[11px] text-zinc-500 md:flex md:flex-row-reverse md:gap-12">
            <span className="md:flex-1">Wishlisted by {others} {others === 1 ? 'other' : 'others'}</span>
            <span className="hidden md:block md:flex-1" aria-hidden="true" />
          </p>
        ) : null}
        <div inert={lightbox || undefined} className="p-5 pt-14 sm:p-12">
          <div className="flex w-full min-w-0 flex-col gap-8 md:flex-row-reverse md:items-center md:gap-12">
            <div className="contents md:flex md:min-w-0 md:w-auto md:flex-1 md:flex-col">
              <div className="order-1 md:order-none">
                {unit.status !== 'Available' ? <span className={`mb-4 inline-flex text-[10px] font-bold uppercase px-3 py-1 rounded-full ${unit.status === 'Sold' ? 'border border-red-500 text-red-400' : 'bg-orange-500 text-white'}`}>{unit.status}</span> : null}
                <p id="unit-dialog-title" className="text-[1.5rem] font-black leading-none tracking-tight text-theme-text-primary">Unit {unit.unitNumber}</p>
                <p className="mt-3 max-w-full text-4xl sm:text-5xl lg:text-6xl font-black text-theme-text-primary leading-none">R {formatZarInteger(unit.price)}</p>
                {unit.floor || unit.direction ? <p className="mt-3 text-sm text-zinc-500">{[unit.floor ? `${unit.floor} floor` : null, unit.direction ? `${unit.direction} facing` : null].filter(Boolean).join(' · ')}</p> : null}
              </div>
              <div className="order-3 md:order-none">
              <div className="border border-theme-border rounded-2xl bg-theme-surface/60 py-5 sm:py-8 md:mt-8">
                <div className="flex w-full items-center justify-evenly">
                  <Tip icon={<IconBed className="w-4 h-4 text-zinc-700" />} label="Bedrooms" value={unit.bedrooms} />
                  <Tip icon={<IconBath className="w-4 h-4 text-zinc-700" />} label="Bathrooms" value={unit.bathrooms} />
                  <Tip icon={<IconCar className="w-4 h-4 text-zinc-700" />} label="Parking" value={unit.parking || 1} />
                  <Tip icon={<IconLayout className="w-4 h-4 text-zinc-700" />} label="Unit Type" value={unit.unitType || '—'} />
                  <Tip icon={<IconSize className="w-4 h-4 text-zinc-700" />} label="Unit Size" value={`${unit.sizeSqm}m²`} />
                </div>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4 text-center sm:grid-cols-3 sm:gap-6">
                <Estimate label="Est. bond cost" value={costs.bond} />
                <Estimate label="Est. transfer cost" value={costs.longTerm} monthly={false} />
                <Estimate label="Est. levies" value={costs.levies} />
                <Estimate label="Est. rates" value={costs.rates} />
                <Estimate label="Est. rental" value={costs.shortTerm} />
              </div>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-6">
                  <button type="button" disabled={!available || reservingUnitId === unit.id} onClick={() => onReserve(unit)} className="w-full sm:w-auto sm:flex-[0.65] sm:min-w-[130px] h-12 flex items-center justify-center bg-[#18181B] text-white font-black text-[11px] uppercase tracking-wider rounded-lg hover:bg-[#27272a] transition-[background-color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:cursor-not-allowed">{lockedByOther ? 'Reservation in Progress' : reservingUnitId === unit.id ? 'Securing...' : 'Reserve unit'}</button>
                  <button type="button" disabled={!available} onClick={() => onToggleWishlist(unit.id)} className={`w-full sm:w-auto sm:flex-[0.35] sm:min-w-[170px] h-12 inline-flex items-center justify-center gap-1.5 border font-black text-[11px] uppercase tracking-wider rounded-lg shadow-sm transition-[background-color,color,border-color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:cursor-not-allowed ${wishlisted ? 'border-red-600 bg-red-600 text-white' : 'bg-theme-bg border-zinc-300 text-zinc-600 hover:bg-red-600 hover:text-white hover:border-red-600 disabled:hover:bg-theme-bg disabled:hover:text-zinc-600 disabled:hover:border-zinc-300'}`}>
                    <IconHeart className="w-3.5 h-3.5" filled={wishlisted} />
                    Wishlist
                  </button>
                </div>
                {others > 0 ? <p className="mt-3 text-center text-[11px] text-zinc-500 md:hidden">Wishlisted by {others} {others === 1 ? 'other' : 'others'}</p> : null}
              </div>
            </div>
            <div className="order-2 min-w-0 w-full space-y-4 md:order-none md:w-auto md:flex-1">
              <div className="relative aspect-[3/2] w-full max-w-full overflow-hidden rounded-[0.5rem] bg-theme-bg">
                {images.length > 0 ? (
                  <Swiper modules={[Autoplay]} className="h-full w-full" slidesPerView={1} autoplay={images.length > 1 ? { delay: 5000, disableOnInteraction: false } : false} onSwiper={setSwiper} onSlideChange={(instance) => setActive(instance.realIndex)}>
                    {images.map((image, index) => (
                      <SwiperSlide key={`${image}-${index}`} className="!h-full">
                        <div className={`h-full w-full overflow-hidden flex items-center justify-center ${index === floorplanIndex ? 'bg-zinc-900' : 'bg-theme-bg'}`}>
                          <img src={image} alt={`Unit ${unit.unitNumber} image ${index + 1}`} className={`cursor-zoom-in ${index === floorplanIndex ? 'max-h-full max-w-full object-contain' : 'w-full h-full object-cover'}`} onClick={() => { setActive(index); setLightbox(true) }} />
                        </div>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500">No images yet</div>
                )}
                {images.length > 1 ? (
                  <>
                    <button type="button" className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-10 text-white hover:text-zinc-200 transition-colors duration-500" aria-label="Previous image" onClick={() => swiper?.slidePrev()}><svg className="w-8 h-8 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M15 5l-7 7 7 7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                    <button type="button" className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-10 text-white hover:text-zinc-200 transition-colors duration-500" aria-label="Next image" onClick={() => swiper?.slideNext()}><svg className="w-8 h-8 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M9 5l7 7-7 7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                  </>
                ) : null}
              </div>
              <p className="text-[11px] text-zinc-400 italic text-center">All imagery is illustrative and subject to final design.</p>
              {images.length > 1 ? (
                <div className="grid grid-cols-4 gap-4 w-full">
                  {images.map((image, index) => (
                    <button key={`${image}-${index}`} type="button" className={`aspect-square overflow-hidden rounded-lg transition-opacity duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] hover:opacity-100 ${active === index ? 'opacity-100' : 'opacity-25'} ${index === floorplanIndex ? 'border border-theme-border' : ''}`} onClick={() => swiper?.slideTo(index)}>
                      <img src={image} alt="" className={index === floorplanIndex ? 'max-w-full max-h-full object-contain' : 'w-full h-full object-cover'} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {lightbox && images[active] ? (
          <div className="fixed inset-0 z-[4100] bg-black/90 flex flex-col" onClick={() => setLightbox(false)}>
            <button type="button" className="absolute top-4 right-4 z-[4110] flex items-center justify-center text-white hover:text-zinc-200 transition-colors duration-500" aria-label="Close image" onClick={(event) => { event.stopPropagation(); setLightbox(false) }}><svg className="w-8 h-8 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M6 6l12 12M18 6l-12 12" strokeWidth="1.8" strokeLinecap="round" /></svg></button>
            {images.length > 1 ? (
              <>
                <button type="button" className="absolute left-4 top-1/2 -translate-y-1/2 z-[4110] flex items-center justify-center text-white hover:text-zinc-200 transition-colors duration-500" aria-label="Previous image" onClick={(event) => { event.stopPropagation(); const next = (active - 1 + images.length) % images.length; setActive(next); swiper?.slideTo(next) }}><svg className="w-8 h-8 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M15 5l-7 7 7 7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 z-[4110] flex items-center justify-center text-white hover:text-zinc-200 transition-colors duration-500" aria-label="Next image" onClick={(event) => { event.stopPropagation(); const next = (active + 1) % images.length; setActive(next); swiper?.slideTo(next) }}><svg className="w-8 h-8 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M9 5l7 7-7 7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
              </>
            ) : null}
            <img src={images[active]} alt="" className="m-auto max-h-[90vh] max-w-[90vw] object-contain" onClick={(event) => event.stopPropagation()} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Estimate({ label, value, monthly = true }: { label: string; value: number; monthly?: boolean }) {
  return (
    <div>
      <p className="text-[9px] uppercase font-bold text-zinc-500 mb-1">{label}</p>
      <p className="text-sm sm:text-base font-semibold text-theme-text-primary">R {formatZarInteger(value)}{monthly ? <span className="text-[10px] text-zinc-500 ml-1">pm</span> : null}</p>
    </div>
  )
}

function Tip({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="group/tip relative inline-flex flex-col items-center gap-1 cursor-help text-[11px] text-zinc-700">
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-zinc-800 text-white text-[11px] rounded opacity-0 pointer-events-none group-hover/tip:opacity-100 whitespace-nowrap z-20">{label}</span>
      {icon}
      <span className="font-semibold text-theme-text-primary">{value}</span>
    </div>
  )
}
