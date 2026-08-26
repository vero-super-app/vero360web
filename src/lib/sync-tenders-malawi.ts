import 'server-only'

import { fetchAllMalawiTenders } from '@/lib/malawi-tender-sources'
import { upsertSyncedTender } from '@/lib/tenders-admin'

export type MalawiTendersSyncResult = {
  fetched: number
  created: number
  updated: number
  skipped: number
  sources: Awaited<ReturnType<typeof fetchAllMalawiTenders>>['results']
  errors: string[]
}

/** Scrape Malawi tender boards into Firestore `site_tenders`. */
export async function syncMalawiTenders(opts?: {
  perSource?: number
}): Promise<MalawiTendersSyncResult> {
  const { tenders, results } = await fetchAllMalawiTenders({
    perSource: opts?.perSource ?? 50,
  })

  let created = 0
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (const draft of tenders) {
    try {
      const outcome = await upsertSyncedTender({
        title: draft.title,
        description: draft.description,
        buyer: draft.buyer,
        reference: draft.reference,
        location: draft.location,
        publishedAt: draft.publishedAt,
        closingAt: draft.closingAt,
        tenderUrl: draft.tenderUrl,
        documentUrl: draft.documentUrl,
        source: draft.source,
        externalId: draft.externalId,
        active: true,
      })
      if (outcome === 'created') created += 1
      else if (outcome === 'updated') updated += 1
      else skipped += 1
    } catch (err) {
      errors.push(
        `${draft.source}:${draft.externalId} — ${
          err instanceof Error ? err.message : 'upsert failed'
        }`,
      )
    }
  }

  for (const r of results) {
    if (!r.ok && r.error) errors.push(`${r.source}: ${r.error}`)
  }

  return {
    fetched: tenders.length,
    created,
    updated,
    skipped,
    sources: results,
    errors: errors.slice(0, 12),
  }
}
