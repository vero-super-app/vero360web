import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { parseDriversResponse } from '@/lib/drivers'
import { nestAdminFetch } from '@/lib/nest-admin'

export type DriverPendingItem = {
  key: string
  type: 'driver' | 'vehicle'
  driverId: number
  taxiId?: number
  name: string
  detail?: string
  submittedAt: string | null
}

/** Lightweight poll endpoint for admin driver verification badges / notifications. */
export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const { res, body, error } = await nestAdminFetch(
      ['admin', 'drivers?skip=0&take=200'],
      undefined,
      request,
    )

    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    const parsed = parseDriversResponse(body)
    const items: DriverPendingItem[] = []

    for (const driver of parsed.drivers) {
      if (driver.status === 'PENDING_VERIFICATION') {
        items.push({
          key: `driver:${driver.id}`,
          type: 'driver',
          driverId: driver.id,
          name: driver.name,
          detail: 'Identity documents',
          submittedAt: driver.submittedAt || driver.createdAt,
        })
      }

      for (const taxi of driver.taxis) {
        if (taxi.status === 'PENDING_REVIEW') {
          items.push({
            key: `vehicle:${taxi.id}`,
            type: 'vehicle',
            driverId: driver.id,
            taxiId: taxi.id,
            name: driver.name,
            detail: `${taxi.model || 'Vehicle'} · ${taxi.licensePlate}`,
            submittedAt: driver.submittedAt || driver.createdAt,
          })
        }
      }
    }

    items.sort((a, b) => {
      const at = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
      const bt = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
      return bt - at
    })

    const pendingDrivers = items.filter(i => i.type === 'driver').length
    const pendingVehicles = items.filter(i => i.type === 'vehicle').length

    return NextResponse.json({
      success: true,
      pending: items.length,
      pendingDrivers,
      pendingVehicles,
      itemKeys: items.map(i => i.key),
      items,
      latest: items[0] ?? null,
    })
  } catch (err) {
    console.error('Admin drivers pending GET error:', err)
    return NextResponse.json({ error: 'Could not reach drivers API' }, { status: 502 })
  }
}
