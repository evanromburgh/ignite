import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearZohoTokenCache, findOrCreateZohoLead, readZohoLeadOwnerId } from '@/lib/zoho'

const lead = {
  firstName: 'Amina',
  lastName: 'Naidoo',
  email: 'amina@example.com',
  phone: '+27821234567',
  interestedIn: '2-bedroom apartment',
  reasonForBuying: 'To Invest',
  idPassport: '8001015009087',
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  process.env.ZOHO_CLIENT_ID = 'client'
  process.env.ZOHO_CLIENT_SECRET = 'secret'
  process.env.ZOHO_REFRESH_TOKEN = 'refresh'
  process.env.ZOHO_API_DOMAIN = 'com'
  clearZohoTokenCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Zoho signup lead', () => {
  it('returns the existing lead id without creating another lead', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [{ id: 'lead-existing' }] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(findOrCreateZohoLead(lead)).resolves.toEqual({
      zohoLeadId: 'lead-existing',
      created: false,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('Leads/search?email=amina%40example.com')
  })

  it('creates a lead when Zoho has no matching email', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(201, { data: [{ details: { id: 'lead-new' }, status: 'success' }] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(findOrCreateZohoLead(lead)).resolves.toEqual({
      zohoLeadId: 'lead-new',
      created: true,
    })
    const createCall = fetchMock.mock.calls[2]
    expect(createCall[1].method).toBe('POST')
    expect(JSON.parse(createCall[1].body)).toEqual({
      data: [{
        First_Name: 'Amina',
        Last_Name: 'Naidoo',
        Email: 'amina@example.com',
        Phone: '+27821234567',
        Interested_In: '2-bedroom apartment',
        Lead_Source: 'Property Portal',
        Lead_Status: 'New Lead',
        Reason_For_Buying: 'To Invest',
        ID_Passport_Number: '8001015009087',
      }],
    })
  })

  it('keeps the existing id when Zoho reports a duplicate email', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(202, {
        data: [{
          code: 'DUPLICATE_DATA',
          status: 'error',
          details: { duplicate_record: { id: 'lead-duplicate' } },
        }],
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(findOrCreateZohoLead(lead)).resolves.toEqual({
      zohoLeadId: 'lead-duplicate',
      created: false,
    })
  })
})

describe('Zoho lead owner', () => {
  it('reads only the lead owner id', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse(200, {
        data: [{ Owner: { id: '5843104000000311031', name: 'Erin Allen', email: 'erin@ignite-studios.co.za' } }],
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(readZohoLeadOwnerId('5843104000000123456')).resolves.toBe('5843104000000311031')
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://www.zohoapis.com/crm/v2/Leads/5843104000000123456?fields=Owner')
    expect(fetchMock.mock.calls[1][1].method).toBeUndefined()
  })

  it('returns null when the workflow has not assigned an owner', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [{ id: '5843104000000123456' }] })))

    await expect(readZohoLeadOwnerId('5843104000000123456')).resolves.toBeNull()
  })

  it('does not call Zoho for a lead id that is not a Zoho record id', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(readZohoLeadOwnerId('lead-existing')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails when Zoho rejects the lead read', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse(401, { code: 'INVALID_TOKEN' })))

    await expect(readZohoLeadOwnerId('5843104000000123456')).rejects.toThrow('Zoho lead read failed (401)')
  })
})
