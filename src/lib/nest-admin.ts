import {
  apiErrorMessage,
  getVeroAdminToken,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

const NEST_ADMIN_KEY_MISSING =
  'Backend admin key missing. Add VERO_ADMIN_API_KEY or VERO_API_TOKEN to .env.local (must match the Nest backend), then restart the dev server.'

function panelBearerToken(request?: Request): string | null {
  if (!request) return null
  const h =
    request.headers.get('authorization') ||
    request.headers.get('Authorization')
  if (!h) return null
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  const token = m?.[1]?.trim() || ''
  // Nest AdminAccessGuard treats short bearer values as API keys, not Firebase.
  return token.length >= 100 ? token : null
}

function configuredNestAdminKey(): string {
  return (
    process.env.VERO_ADMIN_API_KEY?.trim() ||
    process.env.ADMIN_API_KEY?.trim() ||
    getVeroAdminToken()
  )
}

/** Nest admin routes accept x-admin-api-key after panel auth on Next. */
export function nestAdminHeaders(
  extra?: Record<string, string>,
  panelRequest?: Request,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extra,
  }
  const key = configuredNestAdminKey()
  if (key) {
    headers['x-admin-api-key'] = key
    headers.Authorization = `Bearer ${key}`
    return headers
  }

  const panelToken = panelBearerToken(panelRequest)
  if (panelToken) {
    headers.Authorization = `Bearer ${panelToken}`
  }
  return headers
}

export async function nestAdminFetch(
  segments: Array<string | number>,
  init?: RequestInit,
  panelRequest?: Request,
) {
  const headers = nestAdminHeaders(
    init?.headers as Record<string, string> | undefined,
    panelRequest,
  )
  if (!headers['x-admin-api-key'] && !headers.Authorization) {
    return {
      res: { ok: false, status: 503 } as Response,
      body: { message: NEST_ADMIN_KEY_MISSING },
      error: NEST_ADMIN_KEY_MISSING,
    }
  }

  const res = await fetch(veroEndpoint(...segments), {
    ...init,
    headers,
    cache: 'no-store',
  })
  const body = await readJsonSafe(res)
  return { res, body, error: apiErrorMessage(body, 'Request failed') }
}
