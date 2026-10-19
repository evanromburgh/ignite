type ReservationRow = {
  id: string
  unit_id: string
  user_id: string
  status: string
  amount_cents: number
  buyer_first_name: string
  buyer_last_name: string
  buyer_email: string
  buyer_phone: string
  buyer_id_passport: string
  buyer_reason_for_buying: string
  unit_number_snapshot: string
  zoho_lead_id: string | null
  zoho_contact_id: string | null
  zoho_reservation_id: string | null
}

export type ZohoSyncResult = {
  zohoLeadId: string | null
  zohoContactId: string
  zohoReservationId: string
}

const jsonHeaders = (token: string) => ({
  Authorization: `Zoho-oauthtoken ${token}`,
  'Content-Type': 'application/json',
})

function normalizePhone(input: string): string {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('27')) return `+${digits}`
  if (digits.startsWith('0')) return `+27${digits.slice(1)}`
  return `+27${digits}`
}

async function getZohoAccessToken() {
  const zohoClientId = (Deno.env.get('ZOHO_CLIENT_ID') ?? '').trim()
  const zohoClientSecret = (Deno.env.get('ZOHO_CLIENT_SECRET') ?? '').trim()
  const zohoRefreshToken = (Deno.env.get('ZOHO_REFRESH_TOKEN') ?? '').trim()
  const zohoApiDomain = (Deno.env.get('ZOHO_API_DOMAIN') ?? 'com').trim() || 'com'

  if (!zohoClientId || !zohoClientSecret || !zohoRefreshToken) {
    throw new Error('Zoho credentials are not configured')
  }

  const tokenResponse = await fetch(`https://accounts.zoho.${zohoApiDomain}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: zohoRefreshToken,
      client_id: zohoClientId,
      client_secret: zohoClientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!tokenResponse.ok) {
    throw new Error(`Zoho token request failed (${tokenResponse.status}): ${await tokenResponse.text()}`)
  }

  const tokenData = await tokenResponse.json()
  const accessToken = String(tokenData?.access_token ?? '').trim()
  if (!accessToken) {
    throw new Error('Zoho token response missing access_token')
  }

  return {
    accessToken,
    baseUrl: `https://www.zohoapis.${zohoApiDomain}/crm/v2`,
  }
}

async function searchSingleByEmail(baseUrl: string, accessToken: string, moduleName: 'Leads' | 'Contacts', email: string) {
  const url = `${baseUrl}/${moduleName}/search?criteria=(Email:equals:${encodeURIComponent(email)})`
  const response = await fetch(url, { headers: jsonHeaders(accessToken) })
  if (!response.ok) return null

  const data = await response.json().catch(() => ({}))
  const first = data?.data?.[0]
  return first ? String(first.id ?? '').trim() || null : null
}

async function convertLead(baseUrl: string, accessToken: string, leadId: string): Promise<string | null> {
  const convertUrl = `${baseUrl}/Leads/${leadId}/actions/convert`
  const convertResponse = await fetch(convertUrl, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({
      data: [{
        overwrite: true,
        notify_lead_owner: false,
        notify_new_owner: false,
      }],
    }),
  })

  if (!convertResponse.ok) {
    return null
  }

  const payload = await convertResponse.json().catch(() => ({}))
  const row = payload?.data?.[0] ?? payload

  const candidates = [
    row?.Contacts?.[0]?.id,
    row?.Contacts?.id,
    row?.Contact?.[0]?.id,
    row?.Contact?.id,
  ]
    .map((v: unknown) => String(v ?? '').trim())
    .filter(Boolean)

  return candidates[0] ?? null
}

async function upsertContact(baseUrl: string, accessToken: string, reservation: ReservationRow, existingContactId: string | null) {
  const payload: Record<string, unknown> = {
    First_Name: reservation.buyer_first_name,
    Last_Name: reservation.buyer_last_name,
    Email: reservation.buyer_email,
    ID_Passport_Number: reservation.buyer_id_passport,
  }

  const normalizedPhone = normalizePhone(reservation.buyer_phone)
  if (normalizedPhone) {
    payload.Phone = normalizedPhone
  }

  if (existingContactId) {
    const response = await fetch(`${baseUrl}/Contacts/${existingContactId}`, {
      method: 'PUT',
      headers: jsonHeaders(accessToken),
      body: JSON.stringify({ data: [payload] }),
    })

    if (!response.ok) {
      throw new Error(`Zoho contact update failed (${response.status}): ${await response.text()}`)
    }
    return existingContactId
  }

  const response = await fetch(`${baseUrl}/Contacts`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ data: [payload] }),
  })

  if (!response.ok) {
    throw new Error(`Zoho contact create failed (${response.status}): ${await response.text()}`)
  }

  const data = await response.json().catch(() => ({}))
  const createdId = String(data?.data?.[0]?.details?.id ?? data?.data?.[0]?.id ?? '').trim()
  if (!createdId) {
    throw new Error('Zoho contact create response missing contact id')
  }
  return createdId
}

async function upsertPaidReservation(baseUrl: string, accessToken: string, reservation: ReservationRow, zohoContactId: string) {
  // Idempotency: if a paid reservation already exists in Zoho for contact+unit, reuse it.
  const criteria = `(Contact:equals:${encodeURIComponent(zohoContactId)})and(Unit_Number:equals:${encodeURIComponent(reservation.unit_number_snapshot)})and(Payment_Status:equals:Paid)`
  const searchUrl = `${baseUrl}/Unit_Reservations/search?criteria=${criteria}&page=1&per_page=5`
  const searchResponse = await fetch(searchUrl, { headers: jsonHeaders(accessToken) })

  if (searchResponse.ok) {
    const payload = await searchResponse.json().catch(() => ({}))
    const existingId = String(payload?.data?.[0]?.id ?? '').trim()
    if (existingId) return existingId
  }

  const depositAmount = Number((reservation.amount_cents / 100).toFixed(2))
  const today = new Date().toISOString().slice(0, 10)
  const createResponse = await fetch(`${baseUrl}/Unit_Reservations`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({
      data: [{
        Contact: zohoContactId,
        Unit_Number: reservation.unit_number_snapshot,
        Reservation_Date: today,
        Payment_Status: 'Paid',
        Deposit: depositAmount,
        Reason_for_Buying: reservation.buyer_reason_for_buying,
        ID_Passport_Number: reservation.buyer_id_passport,
      }],
    }),
  })

  if (!createResponse.ok) {
    throw new Error(`Zoho reservation create failed (${createResponse.status}): ${await createResponse.text()}`)
  }

  const createPayload = await createResponse.json().catch(() => ({}))
  const createdId = String(createPayload?.data?.[0]?.details?.id ?? createPayload?.data?.[0]?.id ?? '').trim()
  if (!createdId) {
    throw new Error('Zoho reservation create response missing reservation id')
  }

  return createdId
}

export async function syncPaidReservationToZoho(
  supabase: any,
  reservationId: string,
): Promise<ZohoSyncResult> {
  const { data: reservation, error: reservationErr } = await supabase
    .from('reservations')
    .select([
      'id',
      'unit_id',
      'user_id',
      'status',
      'amount_cents',
      'buyer_first_name',
      'buyer_last_name',
      'buyer_email',
      'buyer_phone',
      'buyer_id_passport',
      'buyer_reason_for_buying',
      'unit_number_snapshot',
      'zoho_lead_id',
      'zoho_contact_id',
      'zoho_reservation_id',
    ].join(','))
    .eq('id', reservationId)
    .single()

  if (reservationErr || !reservation) {
    throw new Error(`Reservation lookup failed: ${reservationErr?.message ?? 'not found'}`)
  }

  if (reservation.status !== 'paid') {
    throw new Error(`Reservation is not paid (status=${reservation.status})`)
  }

  const { accessToken, baseUrl } = await getZohoAccessToken()
  let zohoLeadId = String(reservation.zoho_lead_id ?? '').trim() || null
  let zohoContactId = String(reservation.zoho_contact_id ?? '').trim() || null

  if (!zohoContactId) {
    zohoContactId = await searchSingleByEmail(baseUrl, accessToken, 'Contacts', reservation.buyer_email)
  }

  if (!zohoContactId) {
    zohoLeadId = zohoLeadId ?? await searchSingleByEmail(baseUrl, accessToken, 'Leads', reservation.buyer_email)
    if (zohoLeadId) {
      zohoContactId = await convertLead(baseUrl, accessToken, zohoLeadId)
      if (!zohoContactId) {
        await new Promise((resolve) => setTimeout(resolve, 1200))
        zohoContactId = await searchSingleByEmail(baseUrl, accessToken, 'Contacts', reservation.buyer_email)
      }
    }
  }

  zohoContactId = await upsertContact(baseUrl, accessToken, reservation as ReservationRow, zohoContactId)
  const zohoReservationId = await upsertPaidReservation(baseUrl, accessToken, reservation as ReservationRow, zohoContactId)

  return {
    zohoLeadId,
    zohoContactId,
    zohoReservationId,
  }
}
