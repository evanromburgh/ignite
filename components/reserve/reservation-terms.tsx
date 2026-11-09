'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { formatClockMss } from '@/lib/format'
import { clearReserveSession, RESERVE_UNIT_ID } from '@/lib/reserve'
import type { Unit } from '@/lib/types'
import { useAuth } from '@/components/auth/auth-provider'
import { useLockCountdown, useServerClock } from '@/components/catalog/use-clock'
import { useUnits } from '@/components/catalog/use-units'
import { useSettings } from '@/components/settings-context'

const END_SLOP_PX = 8

type AgreementRequest = {
  unit: Unit
  token: string
  lockExpiresAt?: string
  accept: () => void
}

let request: AgreementRequest | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function openReservationAgreement(next: AgreementRequest) {
  const previous = request
  request = next
  emit()
  if (previous && previous.unit.id !== next.unit.id) void releaseHold(previous)
}

function takeAgreementRequest() {
  const current = request
  request = null
  emit()
  return current
}

export function ReservationAgreementDialog() {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => request,
    () => null,
  )
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted || !current) return null
  return createPortal(<AgreementPanel key={current.unit.id} request={current} />, document.body)
}

function AgreementPanel({ request }: { request: AgreementRequest }) {
  const settings = useSettings()
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [read, setRead] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const releasingRef = useRef(false)
  const holdMinutes = Math.max(1, Math.round(settings.lockDurationMs / 60_000))
  const holdLabel = holdMinutes === 1 ? '1 minute' : `${holdMinutes} minutes`
  const offsetMs = useServerClock()
  const { user } = useAuth()
  const { units, loading } = useUnits()
  const sawHold = useRef(false)
  const parsedExpiry = request.lockExpiresAt ? Date.parse(request.lockExpiresAt) : undefined
  const expiresAt = Number.isFinite(parsedExpiry) ? parsedExpiry : undefined
  useLockCountdown(expiresAt, offsetMs)
  const timeLeft = expiresAt ? Math.max(0, Math.floor((expiresAt - (Date.now() + offsetMs)) / 1000)) : 0
  const expired = Boolean(expiresAt) && timeLeft <= 0

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [])

  useEffect(() => {
    if (loading || !user) return
    const live = units.find((unit) => unit.id === request.unit.id)
    if (!live) return
    const holds = live.lockedBy === user.id && typeof live.lockExpiresAt === 'number' && live.lockExpiresAt > Date.now() + offsetMs
    if (holds) {
      sawHold.current = true
      return
    }
    if (!sawHold.current || live.lockedBy === user.id) return
    const current = takeAgreementRequest()
    if (current && sessionStorage.getItem(RESERVE_UNIT_ID) === current.unit.id) clearReserveSession(sessionStorage)
  }, [loading, offsetMs, request.unit.id, units, user])

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return
    const mark = () => {
      if (node.clientHeight === 0) return
      if (node.scrollHeight - node.scrollTop - node.clientHeight <= END_SLOP_PX) setRead(true)
    }
    mark()
    const observer = new ResizeObserver(mark)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  function dismiss() {
    if (releasingRef.current) return
    releasingRef.current = true
    setReleasing(true)
    const current = takeAgreementRequest()
    if (current) void releaseHold(current)
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      dismiss()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="fixed inset-0 z-[5000] flex items-stretch justify-center sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Cancel reservation agreement" onClick={dismiss} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="reservation-agreement-title" tabIndex={-1} className="reservation-agreement-panel relative flex h-full w-full flex-col overflow-hidden bg-white outline-none sm:h-auto sm:overflow-y-auto sm:rounded-[0.5rem] sm:shadow-2xl">
        <div className="flex flex-col p-5 sm:p-12">
          <h2 id="reservation-agreement-title" className="text-2xl font-semibold tracking-tight text-theme-text-primary sm:text-3xl">Reservation Agreement for Unit {request.unit.unitNumber}</h2>
          <p className="mt-4 text-[13px] leading-relaxed text-zinc-500">You are attempting to reserve unit {request.unit.unitNumber}. Please note that the property will be reserved for you once you open this dialog and you will have {holdLabel} to complete the payment process.</p>
          <p id="reservation-terms-instruction" className="mt-5 text-[13px] font-semibold leading-relaxed text-theme-text-primary">Please make sure to read our terms and conditions before continuing to make your reservation payment. You will have to scroll through the agreement before you can accept.</p>
          <div className="relative mt-5 h-40">
              <div
                ref={scrollerRef}
                tabIndex={0}
                role="region"
                aria-labelledby="reservation-terms-instruction"
                onScroll={(event) => {
                  const node = event.currentTarget
                  if (node.clientHeight === 0) return
                  if (node.scrollHeight - node.scrollTop - node.clientHeight <= END_SLOP_PX) setRead(true)
                }}
                className="h-full overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 px-4 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                <ReservationTerms />
              </div>
              {read ? null : <div className="pointer-events-none absolute inset-x-px bottom-px h-10 rounded-b-2xl bg-gradient-to-t from-white to-transparent" />}
          </div>
          <div className="mt-8 flex items-center justify-between gap-3 sm:gap-6">
            <div>
              <p className="text-[10px] font-black tracking-[0.25em] text-zinc-400 uppercase">Expires in</p>
              <p className="text-4xl font-black text-theme-text-primary tabular-nums">{formatClockMss(timeLeft)}</p>
            </div>
            <div className="flex items-center gap-3 sm:gap-6">
              <button type="button" disabled={releasing} onClick={dismiss} className="h-12 px-5 text-[11px] font-black uppercase tracking-wider text-zinc-500 hover:text-zinc-800 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={!read || releasing || expired} aria-describedby="reservation-terms-instruction" onClick={() => { const current = takeAgreementRequest(); current?.accept() }} className="h-12 px-6 bg-[#18181B] text-white font-black text-[11px] uppercase tracking-wider rounded-lg hover:bg-[#27272a] transition-[background-color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:cursor-not-allowed">{expired ? 'Reservation expired' : 'I agree to T&C\'s'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

async function releaseHold(current: AgreementRequest) {
  if (sessionStorage.getItem(RESERVE_UNIT_ID) === current.unit.id) clearReserveSession(sessionStorage)
  await fetch('/api/units/release-lock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` },
    body: JSON.stringify({ unitId: current.unit.id }),
  }).catch(() => undefined)
}

function ReservationTerms() {
  return (
    <div className="space-y-3 text-[12px] leading-relaxed text-zinc-600">
      <p className="font-semibold text-theme-text-primary">Abridged Ignite Reservation Terms and Conditions</p>
      <p>Before reserving a unit, please take note of below T&apos;s and C&apos;s. By paying the Reservation Fee, you accept the full Terms &amp; Conditions.</p>
      <p>Ignite is a digital reservation and marketing platform only. Ignite does not purport to be an estate agency or property practitioner under the Property Practitioners Act. All property sales are handled by the Developer and its appointed Estate Agency.</p>
      <section className="space-y-1.5">
        <h3 className="font-semibold text-theme-text-primary">Reservation Fee:</h3>
        <ul className="list-disc space-y-1 pl-4">
          <li>The fee is a facilitation fee that temporarily holds your chosen unit until you sign a Deed of Sale with the Developer.</li>
          <li>It is not a deposit while held by Ignite.</li>
          <li>Payment may be made by way of eft / direct transfer or credit card payment.</li>
        </ul>
      </section>
      <section className="space-y-1.5">
        <h3 className="font-semibold text-theme-text-primary">What happens after payment:</h3>
        <ul className="list-disc space-y-1 pl-4">
          <li>Once paid, your unit is held for 72 hours (or such longer period as Ignite, in its sole discretion, may allow).</li>
          <li>You must sign the Deed of Sale with the Developer (through the Estate Agency) and complete FICA within that period to the satisfaction of the Estate Agency or Conveyancer.</li>
          <li>If you do, Ignite can transfer the same amount to the conveyancers&apos; trust account on your behalf, where it will then count as part of your deposit.</li>
        </ul>
      </section>
      <section className="space-y-1.5">
        <h3 className="font-semibold text-theme-text-primary">Refunds &amp; forfeits:</h3>
        <ul className="list-disc space-y-1 pl-4">
          <li>Refund of fee: If you sign the deed of sale as above, but your mortgage bond / finance approval is declined within the finance clause period; or if the Developer withdraws the unit; or if duplicate/erroneous payment was made.</li>
          <li>Forfeiture of fee: If you fail/refuse to sign the Deed of Sale within the reservation time-frame; or reserve a unit in bad faith; or misuse the platform.</li>
        </ul>
      </section>
      <section className="space-y-1.5">
        <h3 className="font-semibold text-theme-text-primary">Transparency &amp; compliance:</h3>
        <ul className="list-disc space-y-1 pl-4">
          <li>All payments are traceable and auditable.</li>
          <li>POPIA and FICA apply — your information will be shared only with the Developer, Estate Agency, payment processors, and conveyancers where needed.</li>
        </ul>
      </section>
      <p className="font-semibold text-theme-text-primary">Important notice: A reservation is not a sale. Only a signed Deed of Sale creates a binding purchase.</p>
      <p>By clicking &quot;Accept&quot; and paying the Reservation Fee, you confirm you understand and agree to these terms.</p>
    </div>
  )
}
