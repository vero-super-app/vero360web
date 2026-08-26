import 'server-only'

import {
  apiErrorMessage,
  getVeroAdminToken,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

/** Trigger Nest Remotive + Jooble sync (`POST /jobs/sync`). */
export async function syncExternalJobs(): Promise<unknown> {
  const auth = getVeroAdminToken()
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
  }

  const res = await fetch(veroEndpoint('jobs', 'sync'), {
    method: 'POST',
    headers,
    cache: 'no-store',
  })
  const body = await readJsonSafe(res)
  if (!res.ok) {
    throw new Error(apiErrorMessage(body, 'External job sync failed'))
  }
  return body
}
