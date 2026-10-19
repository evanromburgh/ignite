'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatZarInteger } from '@/lib/format'
import { publicEnv } from '@/lib/env'
import { PAYMENT_CANCELLED_TOAST, PAYMENT_REFERENCE } from '@/lib/reserve'
import { browserSupabase } from '@/lib/supabase'
import { mapUnitRow } from '@/lib/units'
import type { Unit, UnitRow } from '@/lib/types'
import { useAuth } from '@/components/auth/auth-provider'
import { useSettings } from '@/components/settings-context'

export function PaymentSuccessPage() {
  const settings = useSettings()
  const { user } = useAuth()
  const [unit, setUnit] = useState<Unit | null>(null)
  const [amount, setAmount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const reference = localStorage.getItem(PAYMENT_REFERENCE)
    if (!reference || !user) return
    const { url } = publicEnv()
    const supabase = browserSupabase()
    void supabase
      .from('reservations')
      .select('unit_id, amount_cents, paystack_reference')
      .eq('paystack_reference', reference)
      .maybeSingle()
      .then(async ({ data, error: queryError }) => {
        if (queryError || !data) {
          setError('We could not find that payment yet.')
          return
        }
        setAmount(Number(data.amount_cents) / 100)
        const { data: row } = await supabase.from('units').select('*').eq('id', data.unit_id).maybeSingle()
        if (row) setUnit(mapUnitRow(row as UnitRow, url, settings.presenceTtlMs))
      })
  }, [settings.presenceTtlMs, user])

  return (
    <section className="px-4 sm:px-[5rem] pt-36 pb-20 max-w-2xl">
      <h1 className="text-4xl font-black tracking-tight">Payment received</h1>
      <p className="mt-3 text-sm text-zinc-600">{settings.brandName} has recorded your reservation{unit ? ` for unit ${unit.unitNumber}` : ''}{amount != null ? ` of R ${formatZarInteger(amount)}` : ''}.</p>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <Link href="/reservations" className="mt-4 h-[46px] px-8 bg-white text-black text-[11px] font-black uppercase tracking-widest rounded-lg hover:bg-zinc-200 transition-[background-color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] inline-flex items-center justify-center">My Reservations</Link>
    </section>
  )
}

export function PaymentCancelPage() {
  const settings = useSettings()
  const router = useRouter()
  const { accessToken } = useAuth()

  useEffect(() => {
    let active = true
    async function cancel() {
      const reference = localStorage.getItem(PAYMENT_REFERENCE)
      if (reference && accessToken) {
        const { url, anonKey } = publicEnv()
        await fetch(`${url}/functions/v1/cancel-reservation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, apikey: anonKey },
          body: JSON.stringify({ paymentReference: reference }),
        }).catch(() => undefined)
      }
      sessionStorage.setItem(PAYMENT_CANCELLED_TOAST, '1')
      if (active) router.replace('/')
    }
    void cancel()
    return () => { active = false }
  }, [accessToken, router])

  return (
    <div className="min-h-screen bg-[#18181B] text-white flex items-center justify-center">
      <p className="text-sm tracking-[0.35em] font-semibold">{settings.wordmarkLead} | {settings.wordmarkTail}</p>
    </div>
  )
}
