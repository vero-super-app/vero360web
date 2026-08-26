import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { syncMalawiTenders } from '@/lib/sync-tenders-malawi'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Pull Malawi tenders from:
 * - malawitenders.com
 * - maneps.mw/procurement-notice
 * - ppda.mw/tenders
 */
export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const result = await syncMalawiTenders({ perSource: 50 })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Admin Malawi tenders sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not sync Malawi tenders' },
      { status: 502 },
    )
  }
}
