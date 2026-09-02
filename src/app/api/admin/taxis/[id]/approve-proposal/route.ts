import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseTaxi } from '@/lib/drivers'
import { nestAdminFetch } from '@/lib/nest-admin'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: Ctx) {
  try {
    await requirePanelAdmin(request)
    const { id } = await ctx.params
    const { res, body, error } = await nestAdminFetch(
      ['admin', 'taxis', id, 'approve-proposal'],
      { method: 'POST' },
      request,
    )
    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }
    return NextResponse.json({ success: true, taxi: parseTaxi(body) ?? body })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({ error: 'Approve failed' }, { status: 502 })
  }
}
