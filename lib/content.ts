import { cache } from 'react'
import { resolvePublicUrl } from '@/lib/assets'
import { publicEnv } from '@/lib/env'
import { createAnonClient } from '@/lib/supabase'
import type { DocumentItem, ProjectSettings, SiteMapRecord, SiteMapShape } from '@/lib/types'

type SettingsRow = {
  brand_name: string
  tagline: string
  profile_intro: string
  documents_intro: string
  footer_contact_email: string
  wordmark_lead: string
  wordmark_tail: string
  seo_title: string
  seo_description: string
  seo_image_path: string
  logo_light_path: string
  logo_dark_path: string
  favicon_path: string
  theme: Record<string, string>
  hero_image_urls: string[]
  paystack_public_key: string
  lock_duration_ms: number
  presence_ttl_ms: number
  reservation_deposit_cents: number
  bond_rate: number
  rates_base: number
  rates_multiplier: number
  levy_per_sqm: number
  short_term_multiplier: number
  long_term_multiplier: number
  price_filter_min: number
  price_filter_max: number
  price_filter_step: number
  price_filter_amounts: number[]
  password_min_length: number
}

function mapSettings(row: SettingsRow, supabaseUrl: string): ProjectSettings {
  const theme: Record<string, string> = {}
  for (const [key, value] of Object.entries(row.theme ?? {})) {
    if (key.startsWith('--') && typeof value === 'string') theme[key] = value
  }
  return {
    brandName: row.brand_name,
    tagline: row.tagline,
    profileIntro: row.profile_intro,
    documentsIntro: row.documents_intro,
    footerContactEmail: row.footer_contact_email,
    wordmarkLead: row.wordmark_lead,
    wordmarkTail: row.wordmark_tail,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    seoImageUrl: resolvePublicUrl(supabaseUrl, row.seo_image_path),
    logoLightUrl: resolvePublicUrl(supabaseUrl, row.logo_light_path),
    logoDarkUrl: resolvePublicUrl(supabaseUrl, row.logo_dark_path),
    faviconUrl: resolvePublicUrl(supabaseUrl, row.favicon_path),
    theme,
    heroImageUrls: (row.hero_image_urls ?? []).map((url) => resolvePublicUrl(supabaseUrl, url)),
    paystackPublicKey: row.paystack_public_key ?? '',
    lockDurationMs: row.lock_duration_ms,
    presenceTtlMs: row.presence_ttl_ms,
    reservationDepositCents: row.reservation_deposit_cents,
    bondRate: Number(row.bond_rate),
    ratesBase: Number(row.rates_base),
    ratesMultiplier: Number(row.rates_multiplier),
    levyPerSqm: Number(row.levy_per_sqm),
    shortTermMultiplier: Number(row.short_term_multiplier),
    longTermMultiplier: Number(row.long_term_multiplier),
    priceFilterMin: Number(row.price_filter_min),
    priceFilterMax: Number(row.price_filter_max),
    priceFilterStep: Number(row.price_filter_step),
    priceFilterAmounts: (row.price_filter_amounts ?? []).map(Number),
    passwordMinLength: row.password_min_length,
  }
}

export const getProjectSettings = cache(async (): Promise<ProjectSettings> => {
  const { url } = publicEnv()
  const supabase = createAnonClient()
  const { data, error } = await supabase.from('project_settings').select('*').eq('id', 1).single()
  if (error || !data) {
    throw new Error('project_settings is not available')
  }
  return mapSettings(data as SettingsRow, url)
})

export const getDocuments = cache(async (): Promise<DocumentItem[]> => {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, description, file_type, file_size, sort_order')
    .eq('published', true)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    fileUrl: `/api/documents/${row.id as string}`,
    fileType: (row.file_type as string | null) ?? null,
    fileSize: (row.file_size as string | null) ?? null,
  }))
})

export const getSiteMaps = cache(async (): Promise<SiteMapRecord[]> => {
  const { url } = publicEnv()
  const supabase = createAnonClient()
  const { data: maps, error } = await supabase
    .from('site_maps')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  const ids = (maps ?? []).map((map) => map.id as string)
  const { data: shapes, error: shapeError } = ids.length
    ? await supabase
        .from('site_map_shapes')
        .select('site_map_id, shape_kind, label, unit_number, path_d, sort_order')
        .in('site_map_id', ids)
        .order('sort_order', { ascending: true })
    : { data: [], error: null }
  if (shapeError) throw new Error(shapeError.message)
  const byMap = new Map<string, SiteMapShape[]>()
  for (const shape of shapes ?? []) {
    const list = byMap.get(shape.site_map_id as string) ?? []
    list.push({
      shapeKind: shape.shape_kind as SiteMapShape['shapeKind'],
      label: (shape.label as string | null) ?? null,
      unitNumber: (shape.unit_number as string | null) ?? null,
      pathD: shape.path_d as string,
    })
    byMap.set(shape.site_map_id as string, list)
  }
  return (maps ?? []).map((map) => ({
    id: map.id as string,
    kind: map.kind as SiteMapRecord['kind'],
    label: map.label as string,
    imageUrl: resolvePublicUrl(url, map.image_path as string),
    mobileImageUrl: map.mobile_image_path ? resolvePublicUrl(url, map.mobile_image_path as string) : null,
    viewBox: (map.view_box as string) || '0 0 1 1',
    rotateHotspotsClockwiseOnMobile: Boolean(map.rotate_hotspots_clockwise_on_mobile),
    frameBuildingTitle: (map.frame_building_title as string | null) ?? null,
    facingTop: (map.frame_facing_top as string | null) ?? null,
    facingBottom: (map.frame_facing_bottom as string | null) ?? null,
    facingLeft: (map.frame_facing_left as string | null) ?? null,
    facingRight: (map.frame_facing_right as string | null) ?? null,
    shapes: byMap.get(map.id as string) ?? [],
  }))
})
