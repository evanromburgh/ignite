import { NextResponse } from 'next/server'
import { handlePaystackWebhook } from '@/lib/checkout'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const bodyText = await request.text()
  const signature = request.headers.get('x-paystack-signature') ?? ''
  try {
    await handlePaystackWebhook(bodyText, signature)
  } catch (error) {
    console.error('paystack webhook failed', error)
  }
  return NextResponse.json({ ok: true })
}
