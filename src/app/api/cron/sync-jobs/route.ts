import { NextResponse } from 'next/server'
import { denyUnlessCronAuthorized } from '@/lib/cron-auth'
import { syncExternalJobs } from '@/lib/sync-jobs-external'
import { syncMalawiJobs } from '@/lib/sync-jobs-malawi'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Scheduled job sync — Malawi scrapers + Nest Remotive/Jooble.
 * Call with `Authorization: Bearer $CRON_SECRET` (e.g. Netlify scheduled function or cron-job.org).
 */
export async function GET(request: Request) {
  const denied = denyUnlessCronAuthorized(request)
  if (denied) return denied

  try {
    const malawi = await syncMalawiJobs({ perSource: 40 })
    let external: unknown = null
    let externalError: string | null = null
    try {
      external = await syncExternalJobs()
    } catch (err) {
      externalError = err instanceof Error ? err.message : 'External sync failed'
      console.warn('Cron external jobs sync skipped:', externalError)
    }

    return NextResponse.json({
      success: true,
      malawi,
      external,
      externalError,
    })
  } catch (err) {
    console.error('Cron jobs sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Jobs sync failed' },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
