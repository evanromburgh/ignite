import type { SearchFilters, Unit, ViewMode } from '@/lib/types'

export const DEFAULT_FILTERS: SearchFilters = {
  maxPrice: 'all',
  minPrice: 'all',
  bedrooms: 'all',
  bathrooms: 'all',
  status: 'all',
  searchQuery: '',
  orderBy: 'unitNumber',
  orderDir: 'asc',
  layout: 'any',
  floor: 'any',
  direction: 'any',
  parking: 'any',
  wishlistFilter: 'all',
}

const FILTER_KEYS = [
  'q', 'orderBy', 'orderDir', 'status', 'layout', 'floor', 'direction', 'parking',
  'minPrice', 'maxPrice', 'bedrooms', 'bathrooms', 'wishlist', 'view',
] as const

export function filtersFromSearchParams(params: URLSearchParams): { filters: SearchFilters; viewMode: ViewMode } {
  const filters: SearchFilters = { ...DEFAULT_FILTERS }
  const q = params.get('q')
  const orderBy = params.get('orderBy')
  const orderDir = params.get('orderDir')
  if (q) filters.searchQuery = q
  if (params.get('status')) filters.status = params.get('status') as string
  if (params.get('layout')) filters.layout = params.get('layout') as string
  if (params.get('floor')) filters.floor = params.get('floor') as string
  if (params.get('direction')) filters.direction = params.get('direction') as string
  if (params.get('parking')) filters.parking = params.get('parking') as string
  if (params.get('bedrooms')) filters.bedrooms = params.get('bedrooms') as string
  if (params.get('bathrooms')) filters.bathrooms = params.get('bathrooms') as string
  const wishlist = params.get('wishlist')
  if (wishlist === 'yes' || wishlist === 'all') filters.wishlistFilter = wishlist
  if (orderBy === 'unitNumber' || orderBy === 'price' || orderBy === 'bedrooms') filters.orderBy = orderBy
  if (orderDir === 'asc' || orderDir === 'desc') filters.orderDir = orderDir
  const minPrice = Number(params.get('minPrice'))
  const maxPrice = Number(params.get('maxPrice'))
  if (Number.isFinite(minPrice) && minPrice > 0) filters.minPrice = minPrice
  if (Number.isFinite(maxPrice) && maxPrice > 0) filters.maxPrice = maxPrice
  const view = params.get('view')
  const viewMode: ViewMode = view === 'LIST' || view === 'PLANS' ? view : 'GRID'
  return { filters, viewMode }
}

export function searchParamsFromFilters(filters: SearchFilters, viewMode: ViewMode, current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams()
  current.forEach((value, key) => {
    if (!FILTER_KEYS.includes(key as (typeof FILTER_KEYS)[number])) next.set(key, value)
  })
  const search = filters.searchQuery?.trim()
  if (search) next.set('q', search)
  if ((filters.orderBy ?? DEFAULT_FILTERS.orderBy) !== DEFAULT_FILTERS.orderBy) next.set('orderBy', filters.orderBy as string)
  if ((filters.orderDir ?? DEFAULT_FILTERS.orderDir) !== DEFAULT_FILTERS.orderDir) next.set('orderDir', filters.orderDir as string)
  if (filters.status !== DEFAULT_FILTERS.status) next.set('status', filters.status)
  if ((filters.layout ?? DEFAULT_FILTERS.layout) !== DEFAULT_FILTERS.layout) next.set('layout', filters.layout as string)
  if ((filters.floor ?? DEFAULT_FILTERS.floor) !== DEFAULT_FILTERS.floor) next.set('floor', filters.floor as string)
  if ((filters.direction ?? DEFAULT_FILTERS.direction) !== DEFAULT_FILTERS.direction) next.set('direction', filters.direction as string)
  if ((filters.parking ?? DEFAULT_FILTERS.parking) !== DEFAULT_FILTERS.parking) next.set('parking', filters.parking as string)
  if (filters.minPrice !== DEFAULT_FILTERS.minPrice) next.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice !== DEFAULT_FILTERS.maxPrice) next.set('maxPrice', String(filters.maxPrice))
  if (filters.bedrooms !== DEFAULT_FILTERS.bedrooms) next.set('bedrooms', filters.bedrooms)
  if (filters.bathrooms !== DEFAULT_FILTERS.bathrooms) next.set('bathrooms', filters.bathrooms)
  if ((filters.wishlistFilter ?? 'all') !== 'all') next.set('wishlist', filters.wishlistFilter as string)
  if (viewMode !== 'GRID') next.set('view', viewMode)
  return next
}

export function filterUnits(units: Unit[], filters: SearchFilters, wishlistIds: Set<string>): Unit[] {
  const maxPrice = filters.maxPrice === 'all' ? null : Number(filters.maxPrice)
  const minPrice = filters.minPrice === 'all' ? null : Number(filters.minPrice)
  const searchQuery = filters.searchQuery?.trim().toLowerCase() ?? ''
  const wishlistFilter = filters.wishlistFilter ?? 'all'
  const list = units.filter((unit) => {
    const matchesPrice = (maxPrice === null || unit.price <= maxPrice) && (minPrice === null || unit.price >= minPrice)
    const matchesBeds = filters.bedrooms === 'all' || unit.bedrooms.toString() === filters.bedrooms
    const matchesBaths = filters.bathrooms === 'all' || unit.bathrooms.toString() === filters.bathrooms
    const matchesStatus = filters.status === 'all' || unit.status === filters.status
    const matchesSearch = !searchQuery || unit.unitNumber.toLowerCase().includes(searchQuery)
    const matchesLayout = !filters.layout || filters.layout === 'any' || unit.unitType === filters.layout
    const matchesFloor = !filters.floor || filters.floor === 'any' || (unit.floor ?? '') === filters.floor
    const matchesDirection = !filters.direction || filters.direction === 'any' || (unit.direction ?? '') === filters.direction
    const matchesParking = !filters.parking || filters.parking === 'any' || unit.parking.toString() === filters.parking
    const matchesWishlist = wishlistFilter === 'all' || wishlistIds.has(unit.id)
    return matchesPrice && matchesBeds && matchesBaths && matchesStatus && matchesSearch && matchesLayout && matchesFloor && matchesDirection && matchesParking && matchesWishlist
  })
  const by = filters.orderBy ?? 'unitNumber'
  const dir = filters.orderDir ?? 'asc'
  return [...list].sort((a, b) => {
    const aVal = by === 'price' ? a.price : by === 'bedrooms' ? a.bedrooms : a.unitNumber
    const bVal = by === 'price' ? b.price : by === 'bedrooms' ? b.bedrooms : b.unitNumber
    const cmp = typeof aVal === 'number' ? aVal - (bVal as number) : aVal < (bVal as string) ? -1 : aVal > (bVal as string) ? 1 : 0
    return dir === 'asc' ? cmp : -cmp
  })
}
