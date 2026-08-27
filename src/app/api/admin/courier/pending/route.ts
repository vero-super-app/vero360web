import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { parseCourierDeliveries } from '@/lib/courier'
import {
  apiErrorMessage,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

/** Lightweight poll endpoint for admin courier order badges / notifications. */
export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const res = await fetch(veroEndpoint('verocourier', 'all', 'deliveries'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(body, 'Failed to load courier deliveries') },
        { status: res.status },
      )
    }

    const pending = parseCourierDeliveries(body)
      .filter(item => item.status === 'PENDING')
      .sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bt - at
      })

    const latest = pending[0]
    return NextResponse.json({
      success: true,
      pending: pending.length,
      pendingIds: pending.map(item => item.id),
      latest: latest
        ? {
            id: latest.id,
            trackingNumber: latest.trackingNumber,
            city: latest.city,
            createdAt: latest.createdAt,
            estimatedPriceMwk: latest.estimatedPriceMwk,
            estimatedDistanceKm: latest.estimatedDistanceKm,
            estimateSummary: latest.estimateSummary,
          }
        : null,
    })
  } catch (err) {
    console.error('Admin courier pending GET error:', err)
    return NextResponse.json({ error: 'Could not reach courier API' }, { status: 502 })
  }
}
