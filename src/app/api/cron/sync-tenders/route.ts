import { NextResponse } from 'next/server'
import { denyUnlessCronAuthorized } from '@/lib/cron-auth'
import { syncMalawiTenders } from '@/lib/sync-tenders-malawi'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Scheduled Malawi tender sync into Firestore.
 * Call with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const denied = denyUnlessCronAuthorized(request)
  if (denied) return denied

  try {
    const result = await syncMalawiTenders({ perSource: 50 })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Cron tenders sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Tenders sync failed' },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
