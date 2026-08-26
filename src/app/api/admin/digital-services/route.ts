import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  buildDigitalOrderCounts,
  creditPendingDigitalOrderPlatformFees,
  listDigitalServiceOrders,
} from '@/lib/digital-services-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const items = await listDigitalServiceOrders({ limit: 500 })
    const counts = buildDigitalOrderCounts(items)
    return NextResponse.json({ success: true, items, counts })
  } catch (err) {
    console.error('Admin digital-services GET:', err)
    return NextResponse.json({ error: 'Failed to load digital service orders' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string }
    if (body.action !== 'credit_pending_fees') {
      return NextResponse.json(
        { error: 'Unsupported action. Use action: credit_pending_fees' },
        { status: 400 },
      )
    }
    const result = await creditPendingDigitalOrderPlatformFees()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Admin digital-services POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to credit digital fees' },
      { status: 500 },
    )
  }
}
