'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { errorMessageFromUnknown } from '@/lib/errors'
import { persistReserveSession, resolveReserveAccessToken, shouldWarmAcquireLock } from '@/lib/reserve'
import type { Unit } from '@/lib/types'
import { useAuth } from '@/components/auth/auth-provider'
import { openReservationAgreement } from '@/components/reserve/reservation-terms'
import { showToast } from '@/components/toast'
import { showUrgency } from '@/components/urgency'

const RESERVATION_IN_PROGRESS = 'You already have a reservation in progress.'

export function useReserveFlow(fallbackErrorMessage: string, warmAcquireLock = false) {
  const { accessToken } = useAuth()
  const router = useRouter()
  const [reservingUnitId, setReservingUnitId] = useState<string | null>(null)
  const warmed = useRef(false)

  async function reserveUnit(unit: Unit) {
    setReservingUnitId(unit.id)
    try {
      const token = resolveReserveAccessToken(accessToken, null, null)
      if (!token) return
      if (shouldWarmAcquireLock(warmAcquireLock, warmed.current, token)) {
        warmed.current = true
        await fetch('/api/units/acquire-lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ unitId: '00000000-0000-0000-0000-000000000000' }),
        }).catch(() => undefined)
      }
      const response = await fetch('/api/units/acquire-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ unitId: unit.id }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = typeof body.error === 'string' ? body.error : fallbackErrorMessage
        if (message === RESERVATION_IN_PROGRESS) {
          showToast(message)
          return
        }
        throw new Error(message)
      }
      persistReserveSession(sessionStorage, { unitId: unit.id, token, lockExpiresAt: body.lockExpiresAt })
      openReservationAgreement({
        unit,
        token,
        lockExpiresAt: typeof body.lockExpiresAt === 'string' ? body.lockExpiresAt : undefined,
        accept: () => router.push(`/reserve/${unit.unitNumber}`),
      })
    } catch (error) {
      showUrgency(errorMessageFromUnknown(error, fallbackErrorMessage))
    } finally {
      setReservingUnitId(null)
    }
  }

  return { reservingUnitId, reserveUnit }
}
