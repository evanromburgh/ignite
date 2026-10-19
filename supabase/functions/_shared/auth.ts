/**
 * Extracts a bearer token from an Authorization header.
 * Accepts case-insensitive "Bearer <token>" and trims whitespace.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}
