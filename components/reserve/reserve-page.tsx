'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { errorMessageFromUnknown, httpStatusFromUnknown } from '@/lib/errors'
import { depositZar, formatClockMss, formatZarInteger } from '@/lib/format'
import { publicEnv } from '@/lib/env'
import { PAYMENT_REFERENCE, PAYSTACK_SCRIPT_URL, RESERVATION_REDIRECTING, RESERVE_LOCK_EXPIRES_AT, RESERVE_TOKEN, RESERVE_UNIT_ID } from '@/lib/reserve'
import { browserSupabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth/auth-provider'
import { useLockCountdown, useServerClock } from '@/components/catalog/use-clock'
import { useUnits } from '@/components/catalog/use-units'
import { IconBath, IconBed, IconCar, IconLayout, IconSize } from '@/components/icons'
import { useSettings } from '@/components/settings-context'

type PaystackPopup = {
  newTransaction: (options: Record<string, unknown>) => void
  resumeTransaction?: (accessCode: string, options?: Record<string, unknown>) => void
}

declare global {
  interface Window {
    PaystackPop?: new () => PaystackPopup
  }
}

export function ReservePage({ unitNumber }: { unitNumber: string }) {
  const settings = useSettings()
  const router = useRouter()
  const { user, accessToken } = useAuth()
  const { units, loading } = useUnits()
  const offsetMs = useServerClock()
  const unit = units.find((item) => item.unitNumber === unitNumber)
  const unitId = unit?.id
  const [expiresAt, setExpiresAt] = useState<number | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const timeLeft = useLockCountdown(expiresAt, offsetMs)

  useEffect(() => {
    const storedUnit = sessionStorage.getItem(RESERVE_UNIT_ID)
    const storedExpiry = sessionStorage.getItem(RESERVE_LOCK_EXPIRES_AT)
    if (unitId && storedUnit === unitId && storedExpiry) setExpiresAt(Date.parse(storedExpiry))
  }, [unitId])

  useEffect(() => {
    if (!unitId || !accessToken) return
    const controller = new AbortController()
    void fetch('/api/units/acquire-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ unitId }),
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}))
      if (controller.signal.aborted) return
      if (!response.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Could not hold this unit.')
        return
      }
      setError(null)
      if (typeof body.lockExpiresAt === 'string') {
        sessionStorage.setItem(RESERVE_LOCK_EXPIRES_AT, body.lockExpiresAt)
        sessionStorage.setItem(RESERVE_UNIT_ID, unitId)
        sessionStorage.setItem(RESERVE_TOKEN, accessToken)
        setExpiresAt(Date.parse(body.lockExpiresAt))
      }
    }).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return
    })
    return () => controller.abort()
  }, [unitId, accessToken])

  useEffect(() => {
    if (expiresAt && timeLeft === 0 && Date.now() + offsetMs >= expiresAt) {
      router.replace('/')
    }
  }, [expiresAt, timeLeft, offsetMs, router])

  async function cancelHold() {
    if (!unit || !accessToken) {
      router.replace('/')
      return
    }
    await fetch('/api/units/release-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ unitId: unit.id }),
    }).catch(() => undefined)
    router.replace('/')
  }

  async function submit() {
    if (!unit || !accessToken || !user?.email) return
    setSubmitting(true)
    setError(null)
    const { url, anonKey } = publicEnv()
    const payload = {
      unitId: unit.id,
      unitNumber: unit.unitNumber,
      email: user.email,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phone: user.phone ?? '',
      idPassport: user.idPassportNumber ?? '',
      reasonForBuying: user.reasonForBuying ?? '',
    }
    try {
      const response = await postReservation(url, anonKey, accessToken, payload)
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw Object.assign(new Error(typeof body.error === 'string' ? body.error : 'Could not submit reservation.'), { status: response.status })
      const accessCode = typeof body.accessCode === 'string' ? body.accessCode : ''
      const paymentReference = typeof body.paymentReference === 'string' ? body.paymentReference : ''
      if (!accessCode || !paymentReference) throw new Error('Payment link not available. Please contact support.')
      localStorage.setItem(PAYMENT_REFERENCE, paymentReference)
      sessionStorage.setItem(RESERVATION_REDIRECTING, unit.id)
      await loadPaystack()
      const Popup = window.PaystackPop
      if (!Popup) throw new Error('Paystack popup not available')
      const popup = new Popup()
      const callbacks = {
        onSuccess: async () => {
          const { data } = await browserSupabase().auth.getSession()
          const token = data.session?.access_token ?? accessToken
          const confirm = await fetch(`${url}/functions/v1/confirm-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: anonKey },
            body: JSON.stringify({ paymentReference }),
          })
          if (!confirm.ok) {
            setError('Payment succeeded, but confirmation is pending. Please refresh My Units in a moment.')
            setSubmitting(false)
            return
          }
          router.push('/payment-success')
        },
        onCancel: () => {
          void fetch(`${url}/functions/v1/cancel-reservation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, apikey: anonKey },
            body: JSON.stringify({ paymentReference }),
          })
          router.replace('/')
        },
      }
      if (popup.resumeTransaction) popup.resumeTransaction(accessCode, callbacks)
      else popup.newTransaction({ access_code: accessCode, ...callbacks })
    } catch (err) {
      const status = httpStatusFromUnknown(err)
      setError(status === 401 ? 'Session expired. Please sign in again.' : errorMessageFromUnknown(err, 'Could not submit reservation.'))
      setSubmitting(false)
    }
  }

  if (loading) return <p className="flex items-center justify-center min-h-[60svh] text-zinc-500">Loading…</p>
  if (!unit) return <p className="flex items-center justify-center min-h-[60svh] text-zinc-500">This unit is not available.</p>
  const lockedByOther = Boolean(unit.lockedBy && unit.lockedBy !== user?.id && timeLeft > 0)
  const depositLabel = formatZarInteger(depositZar(settings.reservationDepositCents))

  return (
    <div className="pt-[7.5rem] sm:pt-[11rem] sm:pb-20 bg-theme-bg">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-12">
        <div className="md:flex md:gap-12 md:items-center">
          <div className="md:w-[60%]">
            <div className="relative w-full overflow-hidden rounded-2xl bg-[#18181B] aspect-[3/2] flex items-center justify-center">
              {unit.floorplanUrl ? <img src={unit.floorplanUrl} alt={`Unit ${unit.unitNumber} floorplan`} className="max-h-full max-w-full object-contain" /> : unit.imageUrl ? <img src={unit.imageUrl} alt={`Unit ${unit.unitNumber}`} className="w-full h-full object-cover" /> : <p className="text-sm text-zinc-500">Floorplan coming soon for Unit {unit.unitNumber}.</p>}
            </div>
          </div>
          <div className="mt-10 md:mt-0 md:w-[40%] md:flex md:items-center">
            <div className="w-full rounded-3xl px-0 md:px-20 text-center">
              <h1 className="text-4xl sm:text-5xl font-semibold text-theme-text-primary tracking-tight leading-none mb-6">Reserve Unit {unit.unitNumber}</h1>
              <p className="text-[12px] sm:text-[13px] text-zinc-500 max-w-[30rem] mx-auto mb-4">Please pay the <span className="font-semibold text-theme-text-primary">non-refundable reservation fee of <span className="whitespace-nowrap">R{depositLabel}</span></span> to secure your unit before the time runs out.</p>
              <p className="text-sm sm:text-base font-semibold text-theme-text-primary mb-5">Selling price: R {formatZarInteger(unit.price)}</p>
              <div className="flex items-center justify-evenly rounded-2xl bg-white py-8 mb-8">
                <ReserveStat icon={<IconBed className="w-4 h-4" />} label="Bedrooms" value={unit.bedrooms} />
                <ReserveStat icon={<IconBath className="w-4 h-4" />} label="Bathrooms" value={unit.bathrooms} />
                <ReserveStat icon={<IconCar className="w-4 h-4" />} label="Parking" value={unit.parking || 1} />
                <ReserveStat icon={<IconLayout className="w-4 h-4" />} label="Unit Type" value={unit.unitType || '—'} />
                <ReserveStat icon={<IconSize className="w-4 h-4" />} label="Unit Size" value={`${unit.sizeSqm}m²`} />
              </div>
              <p className="text-[10px] font-black tracking-[0.25em] text-zinc-400 uppercase">Expires in</p>
              <p className="text-4xl font-black text-theme-text-primary tabular-nums">{formatClockMss(timeLeft)}</p>
              {error ? <p className="text-[11px] font-bold text-red-500 mt-4">{error}</p> : null}
              <button type="button" disabled={submitting || timeLeft <= 0 || lockedByOther} onClick={() => void submit()} className="mt-8 w-full h-12 flex items-center justify-center bg-[#18181B] text-white font-black text-[11px] uppercase tracking-wider rounded-lg hover:bg-[#27272a] transition-[background-color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Processing…' : lockedByOther ? 'Reserved by someone else' : timeLeft <= 0 ? 'Reservation expired' : 'Proceed to payment'}</button>
              <button type="button" className="mt-4 text-[10px] font-black uppercase tracking-wide text-zinc-400 hover:text-zinc-600" onClick={() => void cancelHold()}>Cancel reservation</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReserveStat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="group/tip relative inline-flex flex-col items-center gap-1 cursor-help text-[11px] text-zinc-700">
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-zinc-800 text-white text-[11px] rounded opacity-0 pointer-events-none group-hover/tip:opacity-100 whitespace-nowrap z-20">{label}</span>
      {icon}
      <span className="font-semibold text-theme-text-primary">{value}</span>
    </div>
  )
}

async function postReservation(url: string, anonKey: string, token: string, payload: Record<string, string>) {
  const response = await fetch(`${url}/functions/v1/submit-reservation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: anonKey },
    body: JSON.stringify(payload),
  })
  if (response.status !== 401) return response
  const { data } = await browserSupabase().auth.refreshSession()
  const fresh = data.session?.access_token
  if (!fresh || fresh === token) return response
  return fetch(`${url}/functions/v1/submit-reservation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fresh}`, apikey: anonKey },
    body: JSON.stringify(payload),
  })
}

function loadPaystack() {
  if (window.PaystackPop) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = PAYSTACK_SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Paystack'))
    document.body.appendChild(script)
  })
}
