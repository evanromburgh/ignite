import { createHmac, timingSafeEqual } from 'node:crypto'

export function paystackSecret() {
  return process.env.PAYSTACK_SECRET_KEY?.trim() ?? ''
}

export async function initializePaystackCharge(reference: string, email: string, amountInCents: number) {
  const secret = paystackSecret()
  if (!secret) return { error: 'PAYSTACK_SECRET_KEY not configured' }
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: amountInCents,
      currency: 'ZAR',
      reference,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  const accessCode = String(payload?.data?.access_code ?? '').trim()
  if (!response.ok || !accessCode) {
    return { error: String(payload?.message ?? 'Paystack initialize failed') }
  }
  return { accessCode }
}

export async function verifyPaystackCharge(reference: string) {
  const secret = paystackSecret()
  if (!secret) return { error: 'PAYSTACK_SECRET_KEY not configured' as const }
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) return { error: 'Paystack verify failed' as const, details: await response.text() }
  const verify = await response.json().catch(() => ({}))
  return { verify }
}

export function paystackSignatureMatches(secret: string, body: string, signature: string) {
  const digest = createHmac('sha512', secret).update(body).digest('hex')
  const left = Buffer.from(digest)
  const right = Buffer.from(signature)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
