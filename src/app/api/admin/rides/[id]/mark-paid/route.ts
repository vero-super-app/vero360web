import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseAdminRide } from '@/lib/rides'
import { nestAdminFetch } from '@/lib/nest-admin'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: Ctx) {
  try {
    await requirePanelAdmin(request)
    const { id } = await ctx.params
    const payload = await request.json().catch(() => ({}))

    const { res, body, error } = await nestAdminFetch(
      ['admin', 'rides', id, 'mark-paid'],
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      request,
    )

    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    const ride = parseAdminRide(body)
    return NextResponse.json({ success: true, ride })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin ride mark-paid error:', err)
    return NextResponse.json({ error: 'Could not mark ride as paid' }, { status: 502 })
  }
}
