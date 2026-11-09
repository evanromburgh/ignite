type SignupLead = {
  firstName: string
  lastName: string
  email: string
  phone: string
  interestedIn: string
  reasonForBuying: string
  idPassport: string
}

export type ZohoLeadLookup = {
  zohoLeadId: string
  created: boolean
}

type ZohoSession = {
  token: string
  apiDomain: string
  expiresAt: number
}

let cachedSession: ZohoSession | null = null

export function clearZohoTokenCache() {
  cachedSession = null
}

function requiredZohoEnv() {
  const clientId = (process.env.ZOHO_CLIENT_ID ?? '').trim()
  const clientSecret = (process.env.ZOHO_CLIENT_SECRET ?? '').trim()
  const refreshToken = (process.env.ZOHO_REFRESH_TOKEN ?? '').trim()
  const apiDomain = (process.env.ZOHO_API_DOMAIN ?? 'com').trim() || 'com'
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Zoho credentials are not configured')
  }
  return { clientId, clientSecret, refreshToken, apiDomain }
}

function text(value: unknown) {
  const trimmed = String(value ?? '').trim()
  return trimmed || null
}

function leadId(data: unknown) {
  const row = Array.isArray(data) ? data[0] : null
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  const direct = text(record.id)
  if (direct) return direct
  const details = record.details
  if (!details || typeof details !== 'object') return null
  const detail = details as Record<string, unknown>
  const detailId = text(detail.id)
  if (detailId) return detailId
  const duplicate = detail.duplicate_record
  if (!duplicate || typeof duplicate !== 'object') return null
  return text((duplicate as Record<string, unknown>).id)
}

function zohoRecordId(value: string) {
  const id = value.trim()
  return /^\d{5,30}$/.test(id) ? id : null
}

function ownerId(data: unknown) {
  const row = Array.isArray(data) ? data[0] : null
  if (!row || typeof row !== 'object') return null
  const owner = (row as Record<string, unknown>).Owner
  if (!owner || typeof owner !== 'object') return null
  const id = text((owner as Record<string, unknown>).id)
  return id && /^\d{5,30}$/.test(id) ? id : null
}

export async function readZohoLeadOwnerId(leadId: string): Promise<string | null> {
  const id = zohoRecordId(leadId)
  if (!id) return null
  const session = await zohoSession()
  const response = await fetch(`https://www.zohoapis.${session.apiDomain}/crm/v2/Leads/${id}?fields=Owner`, {
    headers: { Authorization: `Zoho-oauthtoken ${session.token}` },
  })
  if (response.status === 204) return null
  const payload = await response.json().catch(() => null) as { data?: unknown } | null
  if (!response.ok) throw new Error(`Zoho lead read failed (${response.status})`)
  return ownerId(payload?.data)
}

async function zohoSession() {
  if (cachedSession && Date.now() < cachedSession.expiresAt) return cachedSession
  const env = requiredZohoEnv()
  const response = await fetch(`https://accounts.zoho.${env.apiDomain}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: env.refreshToken,
      client_id: env.clientId,
      client_secret: env.clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  const payload = await response.json().catch(() => null) as { access_token?: unknown; expires_in?: unknown } | null
  const token = text(payload?.access_token)
  if (!response.ok || !token) {
    throw new Error(`Zoho token request failed (${response.status})`)
  }
  const expiresIn = Number(payload?.expires_in ?? 3600)
  cachedSession = {
    token,
    apiDomain: env.apiDomain,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  }
  return cachedSession
}

export async function findOrCreateZohoLead(input: SignupLead): Promise<ZohoLeadLookup> {
  const session = await zohoSession()
  const headers = {
    Authorization: `Zoho-oauthtoken ${session.token}`,
    'Content-Type': 'application/json',
  }
  const base = `https://www.zohoapis.${session.apiDomain}/crm/v2`
  const search = await fetch(`${base}/Leads/search?email=${encodeURIComponent(input.email)}`, { headers })
  if (search.status !== 204) {
    if (!search.ok) throw new Error(`Zoho lead search failed (${search.status})`)
    const payload = await search.json().catch(() => null) as { data?: unknown } | null
    const existingId = leadId(payload?.data)
    if (existingId) return { zohoLeadId: existingId, created: false }
  }

  const lead: Record<string, string> = {
    First_Name: input.firstName,
    Last_Name: input.lastName,
    Email: input.email,
    Lead_Source: 'Property Portal',
    Lead_Status: 'New Lead',
  }
  const phone = input.phone.trim()
  if (phone) lead.Phone = phone
  const interestedIn = input.interestedIn.trim()
  if (interestedIn) lead.Interested_In = interestedIn
  const reasonForBuying = input.reasonForBuying.trim()
  if (reasonForBuying) lead.Reason_For_Buying = reasonForBuying
  const idPassport = input.idPassport.trim()
  if (idPassport) lead.ID_Passport_Number = idPassport

  const created = await fetch(`${base}/Leads`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: [lead] }),
  })
  const payload = await created.json().catch(() => null) as { data?: unknown } | null
  const zohoLeadId = leadId(payload?.data)
  if (!zohoLeadId) throw new Error(`Zoho lead create failed (${created.status})`)
  const row = Array.isArray(payload?.data) ? payload.data[0] as { code?: unknown; status?: unknown } : null
  const duplicate = row?.code === 'DUPLICATE_DATA' || row?.status === 'error'
  return { zohoLeadId, created: created.ok && !duplicate }
}
