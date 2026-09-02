import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseDriver } from '@/lib/drivers'
import { nestAdminFetch } from '@/lib/nest-admin'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: Ctx) {
  try {
    await requirePanelAdmin(request)
    const { id } = await ctx.params
    const payload = await request.json().catch(() => ({}))
    const reason =
      typeof (payload as { reason?: unknown }).reason === 'string'
        ? (payload as { reason: string }).reason
        : ''
    if (!reason.trim()) {
      return NextResponse.json(
        { error: 'A rejection reason is required' },
        { status: 400 },
      )
    }
    const { res, body, error } = await nestAdminFetch(
      ['admin', 'drivers', id, 'reject'],
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      },
      request,
    )
    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }
    return NextResponse.json({ success: true, driver: parseDriver(body) ?? body })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({ error: 'Reject failed' }, { status: 502 })
  }
}
