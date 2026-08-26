import { NextResponse } from 'next/server'
import { denyUnlessCronAuthorized } from '@/lib/cron-auth'
import { syncExternalJobs } from '@/lib/sync-jobs-external'
import { syncMalawiJobs } from '@/lib/sync-jobs-malawi'
import { syncMalawiTenders } from '@/lib/sync-tenders-malawi'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

/** Run jobs + tenders sync in one call (for a single daily cron). */
export async function GET(request: Request) {
  const denied = denyUnlessCronAuthorized(request)
  if (denied) return denied

  const out: Record<string, unknown> = { success: true }

  try {
    out.tenders = await syncMalawiTenders({ perSource: 50 })
  } catch (err) {
    out.tendersError = err instanceof Error ? err.message : 'Tenders sync failed'
    console.error('Cron combined tenders sync:', out.tendersError)
  }

  try {
    out.jobsMalawi = await syncMalawiJobs({ perSource: 40 })
  } catch (err) {
    out.jobsMalawiError = err instanceof Error ? err.message : 'Malawi jobs sync failed'
    console.error('Cron combined Malawi jobs sync:', out.jobsMalawiError)
  }

  try {
    out.jobsExternal = await syncExternalJobs()
  } catch (err) {
    out.jobsExternalError = err instanceof Error ? err.message : 'External jobs sync failed'
    console.warn('Cron combined external jobs sync:', out.jobsExternalError)
  }

  const failed = out.tendersError || out.jobsMalawiError
  if (failed) {
    return NextResponse.json(out, { status: 502 })
  }

  return NextResponse.json(out)
}

export async function POST(request: Request) {
  return GET(request)
}
