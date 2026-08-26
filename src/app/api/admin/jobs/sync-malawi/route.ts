import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { syncMalawiJobs } from '@/lib/sync-jobs-malawi'

/**
 * Pull Malawi listings from onlinejobmw.com, jobsearchmalawi.com, and mwayi.mw,
 * then create any that are not already in Nest (matched by externalId or jobLink).
 */
export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const result = await syncMalawiJobs({ perSource: 40 })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Admin Malawi jobs sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not sync Malawi jobs' },
      { status: 502 },
    )
  }
}
