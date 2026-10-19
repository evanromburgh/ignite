'use client'

import type { ReactNode } from 'react'
import { formatFacingLabel, formatFloorLabel, formatZarInteger } from '@/lib/format'
import type { Unit } from '@/lib/types'
import { IconBath, IconBed, IconCar, IconHeart, IconLayout, IconSize } from '@/components/icons'
import { useLockCountdown } from '@/components/catalog/use-clock'

type CardProps = {
  unit: Unit
  wishlisted: boolean
  offsetMs: number
  currentUserId: string | null
  reservingUnitId: string | null
  myUnits?: boolean
  onSelect: (unit: Unit) => void
  onReserve: (unit: Unit) => void
  onToggleWishlist: (unitId: string) => void
}

function availability(unit: Unit, timeLeft: number, currentUserId: string | null) {
  const lockedByOther = Boolean(unit.lockedBy && unit.lockExpiresAt && unit.lockedBy !== currentUserId && timeLeft > 0)
  const isLocked = timeLeft > 0 && unit.status === 'Available' && lockedByOther
  const isAvailable = unit.status === 'Available' && !isLocked
  return { isLocked, isAvailable }
}

export function UnitCard(props: CardProps) {
  const timeLeft = useLockCountdown(props.unit.lockExpiresAt, props.offsetMs)
  const { isLocked, isAvailable } = availability(props.unit, timeLeft, props.currentUserId)
  const showOverlay = !props.myUnits && (props.unit.status !== 'Available' || isLocked)
  const image = props.unit.floorplanUrl || props.unit.imageUrl
  const reserving = props.reservingUnitId === props.unit.id

  return (
    <div className={`group relative grid h-full grid-rows-[repeat(2,minmax(0,1fr))] overflow-hidden select-none cursor-default bg-white border border-zinc-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 rounded-[0.5rem] ${isAvailable ? 'hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : ''}`}>
      <div className="relative col-start-1 row-start-1 min-h-0 h-full w-full overflow-hidden bg-[#fbfcfd]">
        {image ? <img src={image} alt={`Unit ${props.unit.unitNumber}`} className={`absolute inset-0 object-cover w-full h-full transition-all duration-500 ease-out scale-[0.85] origin-center ${isAvailable ? 'group-hover:scale-95' : 'opacity-70'}`} /> : null}
        <div className="absolute inset-0 flex items-start justify-between p-4 sm:p-5 pointer-events-none">
          <span className="pointer-events-auto text-lg font-bold text-zinc-900 tracking-tight leading-none drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]">{props.unit.unitNumber}</span>
          {props.myUnits ? (
            <span className="pointer-events-none inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold uppercase tracking-widest shadow-sm">Reserved</span>
          ) : (
            <button type="button" disabled={!isAvailable} onClick={() => props.onToggleWishlist(props.unit.id)} className={`pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest shadow-sm transition-[background-color,color,border-color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:pointer-events-none disabled:text-zinc-400 disabled:hover:bg-white/95 disabled:hover:text-zinc-400 disabled:hover:border-zinc-300 ${props.wishlisted ? 'border-red-600 bg-red-600 text-white' : 'border-zinc-300 bg-white/95 text-zinc-600 hover:bg-red-600 hover:text-white hover:border-red-600'}`}>
              <IconHeart className="w-3.5 h-3.5" filled={props.wishlisted} />
              Wishlist
            </button>
          )}
        </div>
      </div>
      {showOverlay ? (
        <>
          <div className="absolute inset-0 col-start-1 row-start-1 row-end-[-1] bg-black/25 backdrop-blur-[2px] pointer-events-auto z-[4]" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
            <span className="px-9 py-3 rounded-full bg-zinc-900 text-white text-[12px] font-black uppercase tracking-[0.2em]">{isLocked ? 'Reservation In Progress' : props.unit.status}</span>
          </div>
        </>
      ) : null}
      <div className="col-start-1 row-start-2 flex min-h-0 min-w-0 flex-col overflow-y-auto">
        <div className="px-4 sm:px-[1.25rem]">
          <div className="flex justify-between items-start gap-4 py-8">
            <div className="min-w-0">
              {props.unit.floor ? <p className="text-[12px] sm:text-[14px] font-bold text-zinc-900 uppercase tracking-wide leading-tight">{props.unit.floor.toUpperCase()} FLOOR</p> : null}
              {props.unit.direction ? <p className="text-[12px] text-zinc-700 mt-0.5 leading-tight">{props.unit.direction} Facing</p> : null}
            </div>
            <span className="text-[20px] sm:text-[26px] font-bold leading-none block text-zinc-900">R {formatZarInteger(props.unit.price)}</span>
          </div>
          <div className="flex items-center justify-evenly gap-4 border-t border-b border-zinc-200/80 py-8 text-[11px] text-zinc-700">
            <Stat icon={<IconBed className="w-4 h-4" />} label="Bedrooms" value={props.unit.bedrooms} />
            <Stat icon={<IconBath className="w-4 h-4" />} label="Bathrooms" value={props.unit.bathrooms} />
            <Stat icon={<IconCar className="w-4 h-4" />} label="Parking" value={props.unit.parking} />
            <Stat icon={<IconLayout className="w-4 h-4" />} label="Unit Type" value={props.unit.unitType || '—'} />
            <Stat icon={<IconSize className="w-4 h-4" />} label="Unit Size" value={`${props.unit.sizeSqm}m²`} />
          </div>
        </div>
        <div className={props.myUnits ? '' : 'grid grid-cols-2 border-zinc-200/80'}>
          <button type="button" disabled={!props.myUnits && !isAvailable} onClick={() => props.onSelect(props.unit)} className="-mt-px pt-[calc(1.25rem+1px)] pb-5 text-[12px] font-bold uppercase tracking-widest bg-transparent text-zinc-900 hover:bg-[#18181B] hover:text-white transition-[background-color,color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:pointer-events-none disabled:text-zinc-500 disabled:hover:bg-transparent text-center w-full">View Details</button>
          {props.myUnits ? null : (
            <button type="button" disabled={!isAvailable || reserving} onClick={() => props.onReserve(props.unit)} className="-mt-px -ml-px pl-px border-l border-zinc-200/80 pt-[calc(1.25rem+1px)] pb-5 text-[12px] font-bold uppercase tracking-widest bg-transparent text-zinc-900 hover:bg-[#18181B] hover:text-white transition-[background-color,color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:pointer-events-none disabled:text-zinc-500 disabled:hover:bg-transparent text-center">{reserving ? 'Securing...' : 'Reserve Now'}</button>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="group/tip relative inline-flex flex-col items-center gap-1 cursor-help">
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-zinc-800 text-white text-[11px] rounded opacity-0 pointer-events-none transition-opacity z-20 whitespace-nowrap group-hover/tip:opacity-100">{label}</span>
      {icon}
      <span>{value}</span>
    </div>
  )
}

export function UnitListRow(props: CardProps) {
  const timeLeft = useLockCountdown(props.unit.lockExpiresAt, props.offsetMs)
  const { isLocked, isAvailable } = availability(props.unit, timeLeft, props.currentUserId)
  const reserving = props.reservingUnitId === props.unit.id
  const showOverlay = !props.myUnits && (props.unit.status !== 'Available' || isLocked)
  const floor = formatFloorLabel(props.unit.floor)
  const facing = formatFacingLabel(props.unit.direction)
  const price = formatZarInteger(props.unit.price)
  return (
    <div className={`group relative w-full overflow-hidden select-none cursor-default bg-white border border-zinc-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 rounded-[0.75rem] ${isAvailable ? 'hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)]' : ''}`}>
      <div className="sm:hidden">
        <div className="flex items-start justify-between px-5 py-5">
          <span className="text-[20px] font-semibold text-[#18181B] tracking-tight leading-none">{props.unit.unitNumber}</span>
          <span className="text-[20px] font-bold text-[#18181B] tracking-tight leading-none">R {price}</span>
        </div>
        <div className="px-5">
          <div className="border-t border-zinc-200/80 py-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <MobileFact label="Bedrooms" value={props.unit.bedrooms} />
              <MobileFact label="Bathrooms" value={props.unit.bathrooms} />
              <MobileFact label="Parking" value={props.unit.parking} />
              <MobileFact label="Type" value={props.unit.unitType || '—'} />
              <MobileFact label="Unit Size" value={`${props.unit.sizeSqm}m²`} />
              <MobileFact label="Direction" value={facing || '—'} />
            </div>
          </div>
        </div>
        <div className="px-5 pb-5">
          <button type="button" disabled={!isAvailable && !props.myUnits} onClick={() => props.onSelect(props.unit)} className="h-10 w-full px-8 text-[12px] font-bold uppercase tracking-widest bg-[#18181B] text-white rounded-md transition-[background-color,color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:pointer-events-none disabled:text-zinc-400 disabled:bg-zinc-800 text-center">View Details</button>
        </div>
      </div>
      <div className="hidden sm:grid sm:grid-cols-3 sm:items-center gap-4 sm:gap-0 px-4 sm:px-6 py-6">
        <div className="min-w-0 flex flex-col gap-2 flex-shrink-0 sm:pr-6">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0 leading-tight">
            <span className="text-[14px] font-extrabold tracking-[0.22em] uppercase text-zinc-900">Unit {props.unit.unitNumber}</span>
            <span className="inline-flex items-baseline gap-x-1 text-[12px]">
              {floor ? <span className="font-semibold text-zinc-600">{floor}</span> : null}
              {floor && facing ? <span className="text-zinc-300" aria-hidden="true">•</span> : null}
              {facing ? <span className="font-semibold text-zinc-600">{facing}</span> : null}
            </span>
          </div>
          <p className="text-[20px] sm:text-[24px] font-bold leading-none text-zinc-900">R {price}</p>
        </div>
        <div className="flex items-center justify-center gap-6 sm:gap-14 border-t sm:border-t-0 border-zinc-200/80 pt-4 sm:pt-0 sm:px-6 min-w-0">
          <ListTip icon={<IconBed className="w-4 h-4 text-zinc-700 flex-shrink-0" />} label="Bedrooms" value={props.unit.bedrooms} />
          <ListTip icon={<IconBath className="w-4 h-4 text-zinc-700 flex-shrink-0" />} label="Bathrooms" value={props.unit.bathrooms} />
          <ListTip icon={<IconCar className="w-4 h-4 text-zinc-700 flex-shrink-0" />} label="Parking" value={props.unit.parking} />
          <ListTip icon={<IconLayout className="w-4 h-4 text-zinc-700 flex-shrink-0" />} label="Unit Type" value={props.unit.unitType || '—'} />
          <ListTip icon={<IconSize className="w-4 h-4 text-zinc-700 flex-shrink-0" />} label="Unit Size" value={`${props.unit.sizeSqm}m²`} />
        </div>
        <div className="flex items-center justify-end gap-3 sm:gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0 flex-shrink-0 sm:pl-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <button type="button" disabled={!isAvailable && !props.myUnits} onClick={() => props.onSelect(props.unit)} className="h-[46px] min-w-[140px] px-6 text-[12px] font-bold uppercase tracking-widest bg-transparent text-zinc-900 rounded-lg hover:bg-[#18181B] hover:text-white hover:rounded-lg transition-[background-color,color,border-radius] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:pointer-events-none disabled:text-zinc-500 disabled:hover:bg-transparent text-center">View Details</button>
            {props.myUnits ? null : (
              <>
                <span className="h-5 w-px bg-zinc-200/80" aria-hidden="true" />
                <button type="button" disabled={!isAvailable || reserving} onClick={() => props.onReserve(props.unit)} className="h-[46px] min-w-[150px] px-6 text-[12px] font-bold uppercase tracking-widest bg-transparent text-zinc-900 rounded-lg hover:bg-[#18181B] hover:text-white hover:rounded-lg transition-[background-color,color,border-radius] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:pointer-events-none disabled:text-zinc-500 disabled:hover:bg-transparent text-center">{reserving ? 'Securing...' : 'Reserve Now'}</button>
              </>
            )}
            <button type="button" disabled={!isAvailable} onClick={() => props.onToggleWishlist(props.unit.id)} className={`hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-white/95 text-zinc-600 transition-[background-color,color,border-color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-red-600 hover:text-white hover:border-red-600 disabled:opacity-50 disabled:pointer-events-none disabled:text-zinc-400 disabled:hover:bg-white/95 disabled:hover:text-zinc-400 disabled:hover:border-zinc-300 ${props.wishlisted ? '!border-red-600 !bg-red-600 !text-white' : ''}`} aria-label="Toggle wishlist">
              <IconHeart className="w-4 h-4" filled={props.wishlisted} />
            </button>
          </div>
        </div>
      </div>
      {showOverlay ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/25 backdrop-blur-[2px]">
          <span className="px-7 py-2 rounded-full bg-zinc-900 text-white text-[11px] font-black uppercase tracking-[0.2em]">{isLocked ? 'Reservation In Progress' : props.unit.status}</span>
        </div>
      ) : null}
    </div>
  )
}

function MobileFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[12px] text-[#18181B] leading-tight">{label}</p>
      <p className="text-[12px] font-semibold text-[#18181B] leading-tight">{value}</p>
    </div>
  )
}

function ListTip({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="group/tip relative inline-flex items-center gap-2 cursor-help text-[12px] text-zinc-700">
      <span className="sr-only">{label}</span>
      {icon}
      <span className="font-semibold">{value}</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-zinc-800 text-white text-[11px] rounded opacity-0 pointer-events-none transition-opacity z-20 whitespace-nowrap group-hover/tip:opacity-100">
        {label}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-zinc-800" aria-hidden="true" />
      </span>
    </div>
  )
}
