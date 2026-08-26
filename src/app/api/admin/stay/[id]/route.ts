import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'
import { ACCOMMODATION_ROOMS_COLLECTION } from '@/lib/stay-rooms'
import {
  apiErrorMessage,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

type Ctx = { params: Promise<{ id: string }> }

async function cleanupRoomOverlays(id: number) {
  const db = getAdminDb()
  const col = db.collection(ACCOMMODATION_ROOMS_COLLECTION)
  const deletes: Promise<unknown>[] = []

  for (const field of ['apiAccommodationId', 'accommodationId', 'apiId'] as const) {
    try {
      const snap = await col.where(field, '==', id).limit(40).get()
      for (const doc of snap.docs) deletes.push(doc.ref.delete())
    } catch (err) {
      console.warn(`Stay room cleanup query (${field}) skipped:`, err)
    }
  }

  await Promise.all(deletes)
}

/**
 * Admin delete — Nest DELETE /accommodations/admin/:id (no owner check).
 * Same pattern as marketplace admin delete.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const { id: raw } = await ctx.params
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid accommodation id' }, { status: 400 })
  }

  try {
    const res = await fetch(veroEndpoint('accommodations', 'admin', id), {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const data = await readJsonSafe(res)

    if (!res.ok) {
      return NextResponse.json(
        {
          error: apiErrorMessage(
            data,
            'Failed to delete this accommodation. Redeploy vero-backend if Nest DELETE /accommodations/admin/:id is missing or still blocked by bookings FK.',
          ),
        },
        { status: res.status },
      )
    }

    try {
      await cleanupRoomOverlays(id)
    } catch (err) {
      console.warn('Stay room Firestore cleanup skipped:', err)
    }

    return NextResponse.json({ success: true, deleted: true, id })
  } catch (err) {
    console.error('Admin stay DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not delete accommodation' },
      { status: 502 },
    )
  }
}
