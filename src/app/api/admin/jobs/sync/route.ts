import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { syncExternalJobs } from '@/lib/sync-jobs-external'

/** Triggers Nest `POST /jobs/sync` (Remotive + Jooble). */
export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const result = await syncExternalJobs()
    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error('Admin jobs sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not sync jobs' },
      { status: 502 },
    )
  }
}
