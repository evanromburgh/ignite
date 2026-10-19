'use client'

import { useEffect, useId, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { approximatePathAnchor, approximatePathPinAbove } from '@/lib/site-map'
import type { SiteMapRecord, SiteMapShape, Unit } from '@/lib/types'
import { useSettings } from '@/components/settings-context'

type BadgeKind = 'available' | 'locked' | 'heldByDeveloper' | 'sold' | 'unknown'
type FacingPosition = 'top' | 'right' | 'bottom' | 'left'

const FACING_POSITIONS: FacingPosition[] = ['top', 'right', 'bottom', 'left']

function planPrice(price: number): string {
  if (price >= 1_000_000) return `R${(price / 1_000_000).toFixed(2)}m`
  if (price >= 1_000) return `R${Math.round(price / 1_000)}k`
  return `R${Math.round(price)}`
}

function viewBoxBox(viewBox: string) {
  const parts = viewBox.trim().split(/[\s,]+/).map(Number)
  return { x: parts[0] || 0, y: parts[1] || 0, width: parts[2] || 1, height: parts[3] || 1 }
}

function isLockActive(unit: Unit | undefined, nowMs: number) {
  if (!unit?.lockExpiresAt || !unit.lockedBy) return false
  return unit.lockExpiresAt > nowMs
}

function badgeKind(unit: Unit | undefined, nowMs: number): BadgeKind {
  if (!unit) return 'unknown'
  if (isLockActive(unit, nowMs)) return 'locked'
  if (unit.status === 'Available') return 'available'
  if (unit.status === 'Held by Developer') return 'heldByDeveloper'
  return 'sold'
}

function isClickable(unit: Unit | undefined, nowMs: number) {
  if (!unit) return true
  if (isLockActive(unit, nowMs)) return false
  return unit.status === 'Available'
}

function staticFill(unit: Unit | undefined, nowMs: number) {
  const kind = badgeKind(unit, nowMs)
  if (kind === 'locked') return 'rgba(161, 98, 7, 0.12)'
  if (kind === 'sold') return 'rgba(143, 36, 36, 0.12)'
  return 'rgba(113, 113, 122, 0.05)'
}

function statusLine(unit: Unit | undefined, nowMs: number) {
  if (!unit) return '—'
  if (isLockActive(unit, nowMs)) return 'LOCK'
  if (unit.status === 'Held by Developer') return 'HELD'
  if (unit.status === 'Reserved' || unit.status === 'Sold') return 'SOLD'
  return unit.status.toUpperCase()
}

function badgeFaceStyle(hovered: boolean, unit: Unit | undefined, nowMs: number): CSSProperties {
  const kind = badgeKind(unit, nowMs)
  if (kind === 'available') {
    return { backgroundColor: hovered ? '#047857' : '#18181B', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
  }
  if (kind === 'locked') return { backgroundColor: '#a16207', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
  if (kind === 'sold') return { backgroundColor: '#8f2424', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
  if (kind === 'heldByDeveloper') {
    return { backgroundColor: '#ffffff', border: '1px solid #d4d4d8', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
  }
  return { backgroundColor: '#ffffff', border: '1px solid #e4e4e7' }
}

function rotatePoint(x: number, y: number, quarterTurns: number) {
  let rx = x
  let ry = y
  const turns = ((quarterTurns % 4) + 4) % 4
  for (let i = 0; i < turns; i += 1) {
    const nextX = 1 - ry
    const nextY = rx
    rx = nextX
    ry = nextY
  }
  return { x: rx, y: ry }
}

function rotateFacing(position: FacingPosition, quarterTurns: number): FacingPosition {
  const index = FACING_POSITIONS.indexOf(position)
  const turns = ((quarterTurns % 4) + 4) % 4
  return FACING_POSITIONS[(index + turns) % 4]
}

function scrollToFloorPlans() {
  const el = document.getElementById('site-map-floor-plans-top')
  if (!el) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const nav = document.querySelector<HTMLElement>('nav.fixed') ?? document.querySelector<HTMLElement>('nav')
  const navHeight = nav?.getBoundingClientRect().height ?? 0
  const marginTop = Number.parseFloat(window.getComputedStyle(el).marginTop || '0') || 0
  const top = window.scrollY + el.getBoundingClientRect().top - navHeight - marginTop
  window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })
}

export function SitePlans({ maps, units, onSelect }: { maps: SiteMapRecord[]; units: Unit[]; onSelect: (unit: Unit) => void }) {
  const settings = useSettings()
  const maskId = `master-dim-${useId().replace(/:/g, '')}`
  const master = maps.find((map) => map.kind === 'master')
  const floors = maps.filter((map) => map.kind === 'floor')
  const [floorIndex, setFloorIndex] = useState(0)
  const [spotlit, setSpotlit] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [activeBadge, setActiveBadge] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const floor = floors[Math.min(floorIndex, Math.max(floors.length - 1, 0))]
  const unitsByNumber = new Map(units.map((unit) => [unit.unitNumber, unit]))
  const buildings = master?.shapes.filter((shape) => shape.shapeKind === 'building') ?? master?.shapes ?? []

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)')
    const apply = () => setMobile(query.matches)
    apply()
    query.addEventListener('change', apply)
    const ticker = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => {
      query.removeEventListener('change', apply)
      window.clearInterval(ticker)
    }
  }, [])

  function activateBuilding() {
    setFloorIndex(0)
    scrollToFloorPlans()
  }

  return (
    <div className="space-y-4 sm:space-y-8">
      {master ? (
        <div className="relative w-full overflow-hidden rounded-xl">
          <div className="relative max-sm:left-1/2 max-sm:w-[160%] max-sm:-translate-x-1/2">
            <img src={master.imageUrl} alt="" className="pointer-events-none block h-auto w-full select-none" />
            <svg className="absolute inset-0 z-[1] h-full w-full" viewBox={master.viewBox} preserveAspectRatio="none">
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse">
                  <rect {...viewBoxBox(master.viewBox)} fill="white" />
                  {buildings.map((shape) => <path key={shape.pathD} d={shape.pathD} fill="black" />)}
                </mask>
              </defs>
              <rect
                {...viewBoxBox(master.viewBox)}
                fill="black"
                mask={`url(#${maskId})`}
                className={`pointer-events-none transition-opacity duration-200 ease-out ${spotlit ? 'opacity-[0.28]' : 'opacity-0'}`}
              />
              {buildings.map((shape) => (
                <path
                  key={shape.pathD}
                  d={shape.pathD}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${shape.label ?? 'Building'}: go to floor plans`}
                  className="master-building-hit cursor-pointer outline-none stroke-white stroke-[2px] sm:stroke-[3px] transition-[stroke-width] duration-200 [stroke-dasharray:4px_3px] sm:[stroke-dasharray:7px_5px] [stroke-linecap:butt] [stroke-linejoin:miter] [vector-effect:non-scaling-stroke] [paint-order:stroke_fill] hover:stroke-0 focus-visible:stroke-0"
                  onMouseEnter={() => setSpotlit(true)}
                  onMouseLeave={() => setSpotlit(false)}
                  onFocus={() => setSpotlit(true)}
                  onBlur={() => setSpotlit(false)}
                  onClick={activateBuilding}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      activateBuilding()
                    }
                  }}
                />
              ))}
            </svg>
            {buildings[0] ? <PlanPin pathD={buildings[0].pathD} label={buildings[0].label ?? master.label} faviconUrl={settings.faviconUrl} /> : null}
          </div>
        </div>
      ) : null}

      {floors.length ? (
        <div id="site-map-floor-plans-top" className="scroll-mt-0 rounded-xl bg-[#18181B] p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-left max-sm:text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-50">Interactive plans by floor</p>
              <p className="mt-1 text-[12px] leading-snug text-zinc-300 whitespace-normal sm:whitespace-nowrap">
                Hover a unit to highlight it, click to view details. Switch floors using the arrows or number buttons.
              </p>
            </div>
            <div className="flex items-center justify-end gap-1 max-sm:justify-center">
              <button type="button" aria-label="Previous floor" disabled={floorIndex <= 0} onClick={() => setFloorIndex((index) => Math.max(0, index - 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-zinc-50 transition-colors duration-500 hover:bg-transparent disabled:pointer-events-none disabled:opacity-40">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <div className="flex items-center gap-2 p-1">
                {floors.map((item, index) => (
                  <button key={item.id} type="button" aria-pressed={index === floorIndex} onClick={() => setFloorIndex(index)} className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-[background-color,color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${index === floorIndex ? 'bg-white text-[#18181B]' : 'bg-zinc-700 text-zinc-50 hover:bg-zinc-600'}`}>
                    {index + 1}
                  </button>
                ))}
              </div>
              <button type="button" aria-label="Next floor" disabled={floorIndex >= floors.length - 1} onClick={() => setFloorIndex((index) => Math.min(floors.length - 1, index + 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-zinc-50 transition-colors duration-500 hover:bg-transparent disabled:pointer-events-none disabled:opacity-40">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {floor ? <FloorPlan floor={floor} mobile={mobile} unitsByNumber={unitsByNumber} nowMs={nowMs} activeBadge={activeBadge} setActiveBadge={setActiveBadge} onSelect={onSelect} /> : null}
    </div>
  )
}

function FloorPlan({
  floor,
  mobile,
  unitsByNumber,
  nowMs,
  activeBadge,
  setActiveBadge,
  onSelect,
}: {
  floor: SiteMapRecord
  mobile: boolean
  unitsByNumber: Map<string, Unit>
  nowMs: number
  activeBadge: string | null
  setActiveBadge: Dispatch<SetStateAction<string | null>>
  onSelect: (unit: Unit) => void
}) {
  const rotate = Boolean(mobile && floor.mobileImageUrl && floor.rotateHotspotsClockwiseOnMobile)
  const turns = rotate ? 1 : 0
  const facing = (position: FacingPosition) => {
    const source = rotateFacing(position, turns)
    if (source === 'top') return floor.facingTop
    if (source === 'bottom') return floor.facingBottom
    if (source === 'left') return floor.facingLeft
    return floor.facingRight
  }
  const image = mobile && floor.mobileImageUrl ? floor.mobileImageUrl : floor.imageUrl
  const northRotation = 90 + turns * 90

  return (
    <div id="site-map-floor-plans" className="scroll-mt-24 space-y-6 outline-none sm:scroll-mt-28" tabIndex={-1}>
      <section className="scroll-mt-24 rounded-2xl bg-white p-6 sm:p-12" aria-labelledby={`plan-frame-heading-${floor.id}`}>
      <div className="relative grid w-full grid-rows-[auto_minmax(0,1fr)_auto]">
        <header className="pointer-events-auto relative z-10 mb-6 max-w-[min(100%,20rem)] text-left sm:absolute sm:left-0 sm:top-0 sm:mb-0 sm:max-w-[min(100%,24rem)]">
          <div id={`plan-frame-heading-${floor.id}`}>
            <p className="font-sans text-2xl font-semibold uppercase leading-tight tracking-wide text-zinc-900 sm:text-3xl">{floor.frameBuildingTitle}</p>
            <p className="font-sans text-sm font-medium capitalize leading-snug text-zinc-700 sm:text-base">{floor.label}</p>
          </div>
        </header>
        <div className="mb-0 flex shrink-0 justify-center sm:absolute sm:left-1/2 sm:top-0 sm:z-10 sm:w-max sm:-translate-x-1/2">
          <p className="text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-zinc-800 sm:text-xs md:text-sm">{facing('top')}</p>
        </div>
        <div className="flex w-full min-w-0 max-w-full items-center justify-center self-center py-0 sm:py-16">
        <div className="relative grid w-full max-w-full grid-cols-[auto_minmax(0,10fr)_auto] items-center gap-x-4 gap-y-3 sm:gap-x-2 sm:gap-y-2">
          <p className="absolute left-0 top-1/2 z-10 min-w-0 max-w-full -translate-y-1/2 whitespace-nowrap text-start text-[10px] font-semibold uppercase leading-tight tracking-wide text-zinc-800 [writing-mode:vertical-rl] rotate-180 sm:text-xs md:text-sm">
            {facing('right')}
          </p>
          <div className="col-start-2 min-w-0">
          <div className="relative mx-auto box-border w-full max-w-full overflow-x-hidden overflow-y-visible bg-transparent max-sm:overflow-hidden max-sm:px-3 sm:w-[60%] sm:overflow-hidden">
            <div className="relative w-full max-sm:my-4">
              <img src={image} alt={`${floor.frameBuildingTitle ?? ''} ${floor.label} plan`} className="pointer-events-none block h-auto w-full select-none" draggable={false} />
              <svg className="pointer-events-auto absolute inset-0 z-[1] h-full w-full" viewBox={floor.viewBox} preserveAspectRatio="none">
                <g transform={rotate ? 'rotate(90 0.5 0.5)' : undefined}>
                  {floor.shapes.filter((shape) => shape.shapeKind === 'unit' && shape.unitNumber).map((shape) => (
                    <UnitPath
                      key={`${floor.id}-${shape.unitNumber}`}
                      floorId={floor.id}
                      shape={shape}
                      unit={unitsByNumber.get(shape.unitNumber!)}
                      nowMs={nowMs}
                      setActiveBadge={setActiveBadge}
                      onSelect={onSelect}
                    />
                  ))}
                </g>
              </svg>
              <div className="pointer-events-none absolute inset-0 z-10">
                {floor.shapes.filter((shape) => shape.shapeKind === 'unit' && shape.unitNumber).map((shape) => {
                  const unit = unitsByNumber.get(shape.unitNumber!)
                  const anchor = approximatePathAnchor(shape.pathD)
                  const point = turns ? rotatePoint(anchor.x, anchor.y, turns) : anchor
                  const kind = badgeKind(unit, nowMs)
                  const hovered = activeBadge === `${floor.id}:${shape.unitNumber}`
                  return (
                    <div
                      key={`badge-${floor.id}-${shape.unitNumber}`}
                      className="plan-html-badge pointer-events-none absolute box-border"
                      style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, transform: 'translate(-50%, -50%)', zIndex: 5 }}
                    >
                      <div
                        className="plan-html-badge-face flex aspect-square h-auto w-[clamp(1.6rem,6.2vmin,2.8rem)] min-h-0 min-w-0 shrink-0 origin-center flex-col items-center justify-center rounded-full px-0.5 py-px text-center font-sans transition-[background-color] duration-150 ease-out motion-reduce:transition-none sm:w-[clamp(2.125rem,11vmin,3.75rem)] sm:px-2 sm:py-0.5"
                        style={badgeFaceStyle(hovered, unit, nowMs)}
                      >
                        <BadgeCopy kind={kind} unitNumber={shape.unitNumber!} unit={unit} nowMs={nowMs} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          </div>
          <p className="absolute right-0 top-1/2 z-10 min-w-0 max-w-full -translate-y-1/2 whitespace-nowrap text-end text-[10px] font-semibold uppercase leading-tight tracking-wide text-zinc-800 [writing-mode:vertical-rl] sm:text-xs md:text-sm">
            {facing('left')}
          </p>
        </div>
        </div>
        <div className="shrink-0 sm:absolute sm:bottom-0 sm:left-1/2 sm:z-10 sm:mt-0 sm:w-max sm:-translate-x-1/2">
          <p className="min-w-0 text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-zinc-800 sm:text-xs md:text-sm">{facing('bottom')}</p>
        </div>
        <div className="pointer-events-none absolute right-0 top-0 z-[1] flex min-w-0 items-start justify-end pt-0.5" role="img" aria-label="North orientation">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380.701 338.056" className="h-8 w-auto max-w-[min(4rem,18vw)] shrink-0 select-none text-zinc-900 sm:h-10 md:h-12" style={{ transform: `rotate(${northRotation}deg)`, ['--north-letter-rotation' as string]: `${-northRotation}deg` }} aria-hidden="true" focusable="false">
            <polygon fill="currentColor" points="117.991 185.588 154.855 253.166 0 206.302 129.465 109.42 117.991 185.588" />
            <path fill="currentColor" d="M44.654,142.958l19.425-14.536c4.598-16.667,12.07-32.6,22.284-47.18,23.449-33.472,58.528-55.808,98.777-62.895s80.848,1.923,114.319,25.372c33.472,23.449,55.808,58.528,62.896,98.777,7.087,40.249-1.923,80.848-25.372,114.319-23.449,33.472-58.528,55.808-98.777,62.896-40.249,7.087-80.848-1.923-114.319-25.372-14.591-10.222-27.064-22.655-37.082-36.761l-23.216-7.026c33.901,61.593,104.291,97.789,177.392,84.917,91.922-16.186,153.318-103.826,137.131-195.747C361.926,47.798,274.287-13.597,182.365,2.589,109.275,15.459,55.49,73.505,44.654,142.958Z" />
            <path className="north-arrow-letter" fill="currentColor" d="M273.73,113.547l15.227,86.475-13.218,2.328-57.996-50.159,10.311,58.556-15.936,2.806-15.227-86.475,13.218-2.328,57.996,50.159-10.311-58.556,15.936-2.806Z" />
          </svg>
        </div>
      </div>
      </section>
    </div>
  )
}

function BadgeCopy({ kind, unitNumber, unit, nowMs }: { kind: BadgeKind; unitNumber: string; unit: Unit | undefined; nowMs: number }) {
  const numberClass = 'max-w-[95%] truncate text-[clamp(0.4rem,1.75vmin,0.65rem)] font-bold leading-none tracking-tight sm:text-[clamp(0.65rem,3.4vmin,0.9375rem)]'
  const lineClass = 'mt-px max-w-[95%] text-center text-[clamp(0.3rem,1.25vmin,0.5rem)] font-semibold leading-[1.05] [overflow-wrap:anywhere] sm:mt-0.5 sm:text-[clamp(0.42rem,2vmin,0.625rem)]'
  if (kind === 'available') {
    return (
      <>
        <span className={`${numberClass} text-white`}>{unitNumber}</span>
        <span className="mt-px max-w-[95%] truncate text-[clamp(0.32rem,1.35vmin,0.52rem)] font-semibold leading-none text-white/95 sm:mt-0.5 sm:text-[clamp(0.5rem,2.3vmin,0.625rem)]">{planPrice(unit?.price ?? 0)}</span>
      </>
    )
  }
  if (kind === 'locked' || kind === 'sold') {
    return (
      <>
        <span className={`${numberClass} text-white`}>{unitNumber}</span>
        <span className={`${lineClass} text-white/95`}>{statusLine(unit, nowMs)}</span>
      </>
    )
  }
  if (kind === 'heldByDeveloper') {
    return (
      <>
        <span className={`${numberClass} text-zinc-900`}>{unitNumber}</span>
        <span className={`${lineClass} text-zinc-500`}>{statusLine(unit, nowMs)}</span>
      </>
    )
  }
  return (
    <>
      <span className={`${numberClass} text-zinc-900`}>{unitNumber}</span>
      <span className="mt-px text-[clamp(0.32rem,1.35vmin,0.52rem)] font-medium leading-none text-zinc-400 sm:mt-0.5 sm:text-[clamp(0.5rem,2.3vmin,0.625rem)]">—</span>
    </>
  )
}

function UnitPath({
  floorId,
  shape,
  unit,
  nowMs,
  setActiveBadge,
  onSelect,
}: {
  floorId: string
  shape: SiteMapShape
  unit: Unit | undefined
  nowMs: number
  setActiveBadge: Dispatch<SetStateAction<string | null>>
  onSelect: (unit: Unit) => void
}) {
  const key = `${floorId}:${shape.unitNumber}`
  const enter = () => setActiveBadge(key)
  const leave = () => setActiveBadge((current) => (current === key ? null : current))
  if (!isClickable(unit, nowMs) || !shape.unitNumber) {
    return <path d={shape.pathD} fill={staticFill(unit, nowMs)} stroke="none" className="pointer-events-none" />
  }
  return (
    <a
      href={`/unit/${encodeURIComponent(shape.unitNumber)}`}
      className="plan-unit-hit cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600/70"
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return
        event.preventDefault()
        if (unit) onSelect(unit)
      }}
    >
      <path d={shape.pathD} stroke="none" className="plan-unit-hit-fill pointer-events-auto" />
    </a>
  )
}

function PlanPin({ pathD, label, faviconUrl }: { pathD: string; label: string; faviconUrl: string }) {
  const pin = approximatePathPinAbove(pathD, 0.016)
  return (
    <div className="site-map-master-pin pointer-events-none absolute flex flex-col items-center" style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%`, transform: 'translate(-50%, -100%)' }}>
      <div className="site-map-master-pin-bob flex flex-col items-center">
        <div className="site-map-master-pin-bubble flex w-[clamp(4rem,17vw,5.5rem)] flex-col items-center rounded-[999px] rounded-b-md bg-white px-2 pb-2 pt-2 font-sans shadow-[0_6px_18px_rgba(0,0,0,0.2)] sm:w-[5.5rem] sm:px-2.5 sm:pb-2.5 sm:pt-2.5">
          {faviconUrl ? <img src={faviconUrl} alt="" className="h-8 w-auto object-contain" /> : null}
          <span className="mt-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide text-zinc-900 sm:text-[11px]">{label}</span>
        </div>
        <div className="site-map-master-pin-pointer -mt-px h-0 w-0 border-x-[clamp(0.55rem,2.4vw,0.7rem)] border-t-[clamp(0.7rem,3vmin,0.9rem)] border-x-transparent border-t-white sm:border-x-[0.7rem] sm:border-t-[0.9rem]" />
      </div>
    </div>
  )
}
