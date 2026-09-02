import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseAdminRide } from '@/lib/rides'
import { nestAdminFetch } from '@/lib/nest-admin'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: Ctx) {
  try {
    await requirePanelAdmin(request)
    const { id } = await ctx.params

    const { res, body, error } = await nestAdminFetch(['admin', 'rides', id], undefined, request)

    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    const ride = parseAdminRide(body)
    if (!ride) {
      return NextResponse.json({ error: 'Invalid ride response' }, { status: 502 })
    }

    return NextResponse.json({ success: true, ride })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin ride GET error:', err)
    return NextResponse.json({ error: 'Could not reach rides API' }, { status: 502 })
  }
}
