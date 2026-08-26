import 'server-only'

import { parseJobPosts, toJobApiBody } from '@/lib/jobs'
import { fetchAllMalawiJobs } from '@/lib/malawi-job-sources'
import {
  apiErrorMessage,
  getVeroAdminToken,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

export type MalawiJobsSyncResult = {
  fetched: number
  created: number
  skipped: number
  sources: Awaited<ReturnType<typeof fetchAllMalawiJobs>>['results']
  errors: string[]
}

/** Scrape Malawi job boards and create new listings in Nest. */
export async function syncMalawiJobs(opts?: {
  perSource?: number
}): Promise<MalawiJobsSyncResult> {
  const auth = getVeroAdminToken()
  const jsonHeaders: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
  }
  const getHeaders: HeadersInit = {
    Accept: 'application/json',
    ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
  }

  const existingRes = await fetch(
    `${veroEndpoint('jobs')}?activeOnly=false&region=malawi`,
    { headers: getHeaders, cache: 'no-store' },
  )
  const existingBody = await readJsonSafe(existingRes)
  if (!existingRes.ok) {
    throw new Error(apiErrorMessage(existingBody, 'Failed to load existing Malawi jobs'))
  }

  const existing = parseJobPosts(existingBody)
  const knownExternal = new Set(
    existing
      .map(j => (j.externalId || '').trim().toLowerCase())
      .filter(Boolean),
  )
  const knownLinks = new Set(
    existing.map(j => j.jobLink.trim().toLowerCase()).filter(Boolean),
  )

  const { jobs, results } = await fetchAllMalawiJobs({
    perSource: opts?.perSource ?? 40,
  })

  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (const draft of jobs) {
    const ext = draft.externalId.toLowerCase()
    const link = draft.jobLink.toLowerCase()
    if (knownExternal.has(ext) || knownLinks.has(link)) {
      skipped += 1
      continue
    }

    try {
      const payload = toJobApiBody({
        position: draft.position,
        description: draft.description || draft.position,
        jobLink: draft.jobLink,
        photoUrl: draft.photoUrl,
        isActive: true,
        region: 'malawi',
        company: draft.company,
        location: draft.location,
        isRemote: draft.isRemote,
        source: draft.source,
        externalId: draft.externalId,
      })

      const res = await fetch(veroEndpoint('jobs'), {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      })
      const body = await readJsonSafe(res)
      if (!res.ok) {
        errors.push(
          `${draft.source}:${draft.externalId} — ${apiErrorMessage(body, 'create failed')}`,
        )
        continue
      }
      created += 1
      knownExternal.add(ext)
      knownLinks.add(link)
    } catch (err) {
      errors.push(
        `${draft.source}:${draft.externalId} — ${
          err instanceof Error ? err.message : 'create failed'
        }`,
      )
    }
  }

  return {
    fetched: jobs.length,
    created,
    skipped,
    sources: results,
    errors: errors.slice(0, 12),
  }
}
