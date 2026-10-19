export const RESERVE_UNIT_ID = 'ignite_reserve_unitId'
export const RESERVE_LOCK_EXPIRES_AT = 'ignite_reserve_lockExpiresAt'
export const RESERVE_TOKEN = 'ignite_reserve_token'
export const RESERVATION_REDIRECTING = 'ignite_reservation_redirecting'
export const PAYMENT_CANCELLED_TOAST = 'show_payment_cancelled_toast'
export const PAYMENT_REFERENCE = 'payment_reference'
export const PAYSTACK_SCRIPT_URL = 'https://js.paystack.co/v2/inline.js'

export function resolveReserveAccessToken(
  sessionCacheToken: string | null | undefined,
  sessionRefToken: string | null | undefined,
  hydratedToken: string | null | undefined,
): string | null {
  return sessionCacheToken ?? sessionRefToken ?? hydratedToken ?? null
}

export function shouldWarmAcquireLock(
  warmAcquireLock: boolean | undefined,
  hasWarmedAcquireLock: boolean,
  token: string | null,
): boolean {
  return Boolean(warmAcquireLock && !hasWarmedAcquireLock && token)
}

export function persistReserveSession(
  storage: Pick<Storage, 'setItem'> | undefined,
  payload: { unitId: string; token: string; lockExpiresAt?: string },
) {
  if (!storage) return
  storage.setItem(RESERVE_UNIT_ID, payload.unitId)
  if (payload.lockExpiresAt) storage.setItem(RESERVE_LOCK_EXPIRES_AT, payload.lockExpiresAt)
  storage.setItem(RESERVE_TOKEN, payload.token)
}
