import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  apiErrorMessage,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Admin delete — Nest DELETE /orders/admin/:id
 */
export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const { id: raw } = await ctx.params
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
  }

  try {
    const res = await fetch(veroEndpoint('orders', 'admin', id), {
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
            'Failed to delete order. Redeploy vero-backend with DELETE /orders/admin/:id if this is 404.',
          ),
        },
        { status: res.status },
      )
    }
    return NextResponse.json({ success: true, deleted: true, id })
  } catch (err) {
    console.error('Admin order DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not delete order' },
      { status: 502 },
    )
  }
}
