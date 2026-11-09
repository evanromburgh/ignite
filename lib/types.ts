export type UnitStatus = 'Available' | 'Reserved' | 'Sold' | 'Held by Developer'
export type ViewMode = 'GRID' | 'LIST' | 'PLANS'

export type Unit = {
  id: string
  unitNumber: string
  bedrooms: number
  bathrooms: number
  parking: number
  sizeSqm: number
  price: number
  status: UnitStatus
  unitType: string
  floor: string | null
  direction: string | null
  imageUrl: string
  imageUrl2: string | null
  imageUrl3: string | null
  floorplanUrl: string | null
  viewers: Record<string, number>
  wishlistCount: number
  lockExpiresAt?: number
  lockedBy?: string
}

export type SearchFilters = {
  maxPrice: number | 'all'
  minPrice: number | 'all'
  bedrooms: string
  bathrooms: string
  status: string
  searchQuery?: string
  orderBy?: 'unitNumber' | 'price' | 'bedrooms'
  orderDir?: 'asc' | 'desc'
  layout?: string
  floor?: string
  direction?: string
  parking?: string
  wishlistFilter?: 'all' | 'yes'
}

export type AppUser = {
  id: string
  email: string | null
  displayName: string | null
  role: 'admin' | 'user'
  firstName: string | null
  lastName: string | null
  phone: string | null
  idPassportNumber: string | null
  interestedIn: string | null
  reasonForBuying: string | null
  googleAccount: boolean
  signupIncomplete: boolean
}

export type AgentContact = {
  id: string
  name: string
  title: string
  phone: string
  email: string
  imageUrl?: string
}

export type ProjectSettings = {
  brandName: string
  tagline: string
  profileIntro: string
  documentsIntro: string
  footerContactEmail: string
  wordmarkLead: string
  wordmarkTail: string
  seoTitle: string
  seoDescription: string
  seoImageUrl: string
  logoLightUrl: string
  logoDarkUrl: string
  faviconUrl: string
  theme: Record<string, string>
  heroImageUrls: string[]
  paystackPublicKey: string
  lockDurationMs: number
  presenceTtlMs: number
  reservationDepositCents: number
  bondRate: number
  ratesBase: number
  ratesMultiplier: number
  levyPerSqm: number
  shortTermMultiplier: number
  longTermMultiplier: number
  priceFilterMin: number
  priceFilterMax: number
  priceFilterStep: number
  priceFilterAmounts: number[]
  passwordMinLength: number
}

export type DocumentItem = {
  id: string
  title: string
  description: string
  fileUrl: string
  fileType: string | null
  fileSize: string | null
}

export type SiteMapShape = {
  shapeKind: 'building' | 'unit'
  label: string | null
  unitNumber: string | null
  pathD: string
}

export type SiteMapRecord = {
  id: string
  kind: 'master' | 'floor'
  label: string
  imageUrl: string
  mobileImageUrl: string | null
  viewBox: string
  rotateHotspotsClockwiseOnMobile: boolean
  frameBuildingTitle: string | null
  facingTop: string | null
  facingBottom: string | null
  facingLeft: string | null
  facingRight: string | null
  shapes: SiteMapShape[]
}

export type UnitRow = {
  id: string
  unit_number: string
  bedrooms: number
  bathrooms: number
  parking: number
  size_sqm: number
  price: number
  status: UnitStatus
  unit_type: string
  floor?: string | null
  direction?: string | null
  image_key_1?: string | null
  image_url?: string | null
  image_key_2?: string | null
  image_key_3?: string | null
  floorplan_key?: string | null
  viewers?: Record<string, number | string> | null
  wishlist_count?: number | null
  lock_expires_at?: string | null
  locked_by?: string | null
}
