export function parseReservationReference(ref: string): { reservationId: string } | null {
  const trimmed = String(ref ?? '').trim()
  if (!trimmed.startsWith('resv_')) return null

  const reservationId = trimmed.slice(5).trim()
  if (!reservationId) return null

  return { reservationId }
}
