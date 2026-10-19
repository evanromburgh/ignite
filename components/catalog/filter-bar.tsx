'use client'

import { formatFacingLabel, formatFloorLabel } from '@/lib/format'
import type { SearchFilters } from '@/lib/types'
import { IconCar, IconLayout } from '@/components/icons'
import { useSettings } from '@/components/settings-context'

const control = 'h-[2.375rem] w-full bg-theme-input-bg border border-theme-border rounded-lg px-4 text-zinc-300 text-[12px] font-medium capitalize appearance-none cursor-pointer focus:border-zinc-500 focus:outline-none'
const labelClass = 'flex items-center gap-2 text-xs font-medium text-zinc-500 capitalize mb-2'
const iconClass = 'w-[13px] h-[13px] text-zinc-500 flex-shrink-0'

function priceShort(price: number) {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1)}M`
  if (price >= 1_000) return `${(price / 1_000).toFixed(0)}K`
  return String(price)
}

export function FilterBar({
  filters,
  unitTypes,
  floors,
  directions,
  embedded,
  hideClear,
  onChange,
  onClear,
}: {
  filters: SearchFilters
  unitTypes: string[]
  floors: string[]
  directions: string[]
  embedded?: boolean
  hideClear?: boolean
  onChange: (next: SearchFilters) => void
  onClear: () => void
}) {
  const settings = useSettings()
  const min = settings.priceFilterMin
  const max = settings.priceFilterMax
  const step = settings.priceFilterStep
  const priceMin = filters.minPrice === 'all' ? min : Math.max(min, Math.min(max, Number(filters.minPrice)))
  const priceMax = filters.maxPrice === 'all' ? max : Math.max(min, Math.min(max, Number(filters.maxPrice)))
  const span = Math.max(1, max - min)
  const minPercent = ((priceMin - min) / span) * 100
  const maxPercent = ((priceMax - min) / span) * 100

  return (
    <div className={`filter-bar filter-bar--light ${embedded ? 'filter-bar--embedded p-5' : 'rounded-lg p-5'}`}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 items-end gap-4 lg:grid-cols-5">
          <div className="order-1 col-span-1 lg:order-none lg:col-span-1">
            <label className={labelClass}>
              <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              Search Unit
            </label>
            <input type="text" placeholder="e.g. 701, 848" className="w-full h-[2.375rem] bg-theme-input-bg border border-theme-border rounded-lg pl-4 pr-4 text-zinc-300 placeholder:text-zinc-500 placeholder:normal-case text-[12px] font-medium capitalize focus:border-zinc-500 focus:outline-none transition-colors" value={filters.searchQuery ?? ''} onChange={(event) => onChange({ ...filters, searchQuery: event.target.value })} />
          </div>
          <div className="order-2 lg:order-none lg:col-span-1">
            <label className={labelClass}>
              <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
              Order By
            </label>
            <select className={control} value={filters.orderBy ?? 'unitNumber'} onChange={(event) => onChange({ ...filters, orderBy: event.target.value as SearchFilters['orderBy'] })}>
              <option value="unitNumber">Unit Number</option>
              <option value="price">Price</option>
              <option value="bedrooms">Beds</option>
            </select>
          </div>
          <div className="order-3 col-span-1 lg:order-none lg:col-span-1">
            <label className={labelClass}>Sort</label>
            <button type="button" aria-pressed={(filters.orderDir ?? 'asc') === 'desc'} aria-label="Sort order" className="flex h-[2.375rem] w-full cursor-pointer items-center justify-center rounded-lg border border-theme-border bg-theme-input-bg px-4 text-[12px] font-medium capitalize text-zinc-300 transition-colors duration-500 hover:bg-theme-input-bg focus:border-zinc-500 focus:outline-none" onClick={() => onChange({ ...filters, orderDir: (filters.orderDir ?? 'asc') === 'asc' ? 'desc' : 'asc' })}>
              {(filters.orderDir ?? 'asc') === 'asc' ? 'ASC ↑' : 'DESC ↓'}
            </button>
          </div>
          <div className="order-5 col-span-2 flex min-h-[4.125rem] flex-col justify-end overflow-visible lg:order-none lg:col-span-2">
            <label htmlFor="price-slider" className="mb-2 mt-1 flex shrink-0 items-center justify-center text-center text-xs font-medium text-zinc-500">Price Range</label>
            <div id="price-slider" className="price-slider slider-target slider-horizontal relative -mt-[1.25rem] mt-2 flex min-h-0 w-full flex-1 flex-col justify-end px-[1.8rem] pb-0">
              <div className="slider-base relative h-3 w-full shrink-0 overflow-visible">
                <div className="slider-connects pointer-events-none absolute inset-0">
                  <div className="slider-connect absolute top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-theme-border" style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }} />
                </div>
                <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-theme-input-bg" aria-hidden="true" />
                <input type="range" min={min} max={max} step={step} value={priceMin} aria-label="Minimum price" aria-valuemin={min} aria-valuemax={priceMax} aria-valuenow={priceMin} aria-valuetext={`R${priceShort(priceMin)}`} className="price-range-input price-range-input-min" onChange={(event) => onChange({ ...filters, minPrice: Number(event.target.value), maxPrice: Math.max(priceMax, Number(event.target.value)) })} />
                <input type="range" min={min} max={max} step={step} value={priceMax} aria-label="Maximum price" aria-valuemin={priceMin} aria-valuemax={max} aria-valuenow={priceMax} aria-valuetext={`R${priceShort(priceMax)}`} className="price-range-input price-range-input-max" onChange={(event) => onChange({ ...filters, maxPrice: Number(event.target.value), minPrice: Math.min(priceMin, Number(event.target.value)) })} />
                <Handle percent={minPercent} label={priceShort(priceMin)} lower />
                <Handle percent={maxPercent} label={priceShort(priceMax)} />
              </div>
            </div>
          </div>
          <div className="order-4 lg:order-none lg:col-span-1">
            <label className={labelClass}>
              <svg className={iconClass} fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 0 1 8.25-4.764.5.5 0 0 0 .5-.866A6.5 6.5 0 1 0 14.5 8a.5.5 0 0 0-1 0 5.5 5.5 0 1 1-11 0" /><path d="M15.354 3.354a.5.5 0 0 0-.708-.708L8 9.293 5.354 6.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0z" /></svg>
              Status
            </label>
            <select className={control} value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
              <option value="all">All</option>
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="Sold">Sold</option>
              <option value="Held by Developer">Held by Developer</option>
            </select>
          </div>
          <div className="order-6 lg:order-none lg:col-span-1">
            <label className={labelClass}><IconLayout className={iconClass} />Layout</label>
            <select className={control} value={filters.layout ?? 'any'} onChange={(event) => onChange({ ...filters, layout: event.target.value })}>
              <option value="any">Any</option>
              {unitTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="order-7 lg:order-none lg:col-span-1">
            <label className={labelClass}>
              <svg className={iconClass} fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M8.235 1.559a.5.5 0 0 0-.47 0l-7.5 4a.5.5 0 0 0 0 .882L3.188 8 .264 9.559a.5.5 0 0 0 0 .882l7.5 4a.5.5 0 0 0 .47 0l7.5-4a.5.5 0 0 0 0-.882L12.813 8l2.922-1.559a.5.5 0 0 0 0-.882zm3.515 7.008L14.438 10 8 13.433 1.562 10 4.25 8.567l3.515 1.874a.5.5 0 0 0 .47 0zM8 9.433 1.562 6 8 2.567 14.438 6z" /></svg>
              Floor
            </label>
            <select className={control} value={filters.floor ?? 'any'} onChange={(event) => onChange({ ...filters, floor: event.target.value })}>
              <option value="any">Any</option>
              {floors.map((floor) => <option key={floor} value={floor}>{formatFloorLabel(floor)}</option>)}
            </select>
          </div>
          <div className="order-8 lg:order-none lg:col-span-1">
            <label className={labelClass}>
              <svg className={iconClass} fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 16.016a7.5 7.5 0 0 0 1.962-14.74A1 1 0 0 0 9 0H7a1 1 0 0 0-.962 1.276A7.5 7.5 0 0 0 8 16.016m6.5-7.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0" /><path d="m6.94 7.44 4.95-2.83-2.83 4.95-4.949 2.83 2.828-4.95z" /></svg>
              Direction
            </label>
            <select className={control} value={filters.direction ?? 'any'} onChange={(event) => onChange({ ...filters, direction: event.target.value })}>
              <option value="any">Any</option>
              {directions.map((direction) => <option key={direction} value={direction}>{formatFacingLabel(direction)}</option>)}
            </select>
          </div>
          <div className="order-9 lg:order-none lg:col-span-1">
            <label className={labelClass}><IconCar className={iconClass} />Parking</label>
            <select className={control} value={filters.parking ?? 'any'} onChange={(event) => onChange({ ...filters, parking: event.target.value })}>
              <option value="any">Any</option>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </div>
          {hideClear ? null : <div className="hidden lg:col-span-4 lg:block" aria-hidden="true" />}
          {hideClear ? null : (
            <div className="order-10 col-span-2 flex items-end justify-start lg:order-none lg:col-span-1 lg:justify-end">
              <button type="button" onClick={onClear} className="filter-bar-clear filter-bar-clear--danger inline-flex h-[2.375rem] w-full items-center justify-center gap-2 rounded-lg px-4 text-[12px] font-medium capitalize transition-colors duration-500">
                <svg className="h-[13px] w-[13px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Handle({ percent, label, lower }: { percent: number; label: string; lower?: boolean }) {
  return (
    <div className="slider-origin pointer-events-none absolute top-1/2 z-0" style={{ left: `${percent}%`, transform: 'translate(-50%, -50%)' }}>
      <div className={`slider-handle flex h-3.5 w-3.5 flex-col items-center rounded-full bg-theme-border shadow-sm ${lower ? 'slider-handle-lower' : 'slider-handle-upper'}`} role="presentation">
        <div className="slider-tooltip slider-tooltip-top absolute bottom-full left-1/2 mb-1 flex -translate-x-1/2 flex-col items-center">
          <span className="slider-tooltip-pill whitespace-nowrap rounded-[0.35rem] bg-theme-surface-elevated px-2 py-1 text-[11px] font-bold text-theme-text-primary shadow-sm">R{label}</span>
          <span className="slider-tooltip-arrow -mt-px h-0 w-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-theme-border" />
        </div>
      </div>
    </div>
  )
}
