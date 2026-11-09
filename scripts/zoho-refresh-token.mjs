import fs from 'node:fs'

const envPath = '.env.local'
const code = process.argv.slice(2).join('').trim()
if (!code) {
  console.error('Usage: npm run zoho:refresh-token -- <grant-code>')
  process.exit(1)
}

const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
const env = Object.fromEntries(
  envText.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return []
    const index = trimmed.indexOf('=')
    return [[trimmed.slice(0, index), trimmed.slice(index + 1)]]
  }),
)

const clientId = (env.ZOHO_CLIENT_ID ?? '').trim()
const clientSecret = (env.ZOHO_CLIENT_SECRET ?? '').trim()
const apiDomain = (env.ZOHO_API_DOMAIN ?? 'com').trim() || 'com'
if (!clientId || !clientSecret) {
  console.error('Add ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET to .env.local first. They are on the Client Secret tab.')
  process.exit(1)
}

const response = await fetch(`https://accounts.zoho.${apiDomain}/oauth/v2/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
  }),
})

const payload = await response.json().catch(() => null)
const refreshToken = String(payload?.refresh_token ?? '').trim()
if (!response.ok || !refreshToken) {
  const reason = payload?.error ?? response.status
  console.error(`Zoho did not return a refresh token (${reason}). Generate a new code and run this again within 3 minutes.`)
  process.exit(1)
}

function upsert(text, key, value) {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  if (pattern.test(text)) return text.replace(pattern, line)
  const suffix = text.endsWith('\n') || text.length === 0 ? '' : '\n'
  return `${text}${suffix}${line}\n`
}

let next = upsert(envText, 'ZOHO_REFRESH_TOKEN', refreshToken)
const apiHost = String(payload?.api_domain ?? '')
const hostDomain = apiHost.match(/zohoapis\.(.+)$/)?.[1]
if (hostDomain) next = upsert(next, 'ZOHO_API_DOMAIN', hostDomain)
fs.writeFileSync(envPath, next)
console.log(`Saved ZOHO_REFRESH_TOKEN to ${envPath}${hostDomain ? ` (ZOHO_API_DOMAIN=${hostDomain})` : ''}.`)
