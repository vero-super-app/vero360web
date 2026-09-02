import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseDriver } from '@/lib/drivers'
import { nestAdminFetch } from '@/lib/nest-admin'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: Ctx) {
  try {
    await requirePanelAdmin(request)
    const { id } = await ctx.params
    const { res, body, error } = await nestAdminFetch(
      ['admin', 'drivers', id],
      undefined,
      request,
    )
    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }
    const driver = parseDriver(body)
    if (!driver) {
      return NextResponse.json({ error: 'Invalid driver payload' }, { status: 502 })
    }
    return NextResponse.json({ success: true, driver })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin driver detail GET error:', err)
    return NextResponse.json({ error: 'Could not load driver' }, { status: 502 })
  }
}
