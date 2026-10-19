export function httpStatusFromUnknown(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const record = error as Record<string, unknown>
  const status = record.statusCode ?? record.status
  return typeof status === 'number' ? status : undefined
}

export function errorMessageFromUnknown(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const data = record.data
    if (data && typeof data === 'object') {
      const body = data as Record<string, unknown>
      if (typeof body.error === 'string' && body.error.trim()) return body.error
      if (typeof body.message === 'string' && body.message.trim()) return body.message
    }
    if (typeof record.message === 'string' && record.message.trim()) return record.message
  }
  return fallback
}
