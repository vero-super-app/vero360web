import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseAdminRidesResponse } from '@/lib/rides'
import { nestAdminFetch } from '@/lib/nest-admin'

export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)
    const url = new URL(request.url)
    const qs = new URLSearchParams()
    const skip = url.searchParams.get('skip')
    const take = url.searchParams.get('take')
    const status = url.searchParams.get('status')
    const paymentStatus = url.searchParams.get('paymentStatus')
    const search = url.searchParams.get('search')
    const issuesOnly = url.searchParams.get('issuesOnly')

    if (skip) qs.set('skip', skip)
    if (take) qs.set('take', take)
    if (status) qs.set('status', status)
    if (paymentStatus) qs.set('paymentStatus', paymentStatus)
    if (search) qs.set('search', search)
    if (issuesOnly === 'true') qs.set('issuesOnly', 'true')

    const query = qs.toString()
    const path = query ? `rides?${query}` : 'rides'

    const { res, body, error } = await nestAdminFetch(['admin', path], undefined, request)

    if (!res.ok) {
      const message =
        res.status === 404
          ? 'Ride admin API is not available on the backend yet. Redeploy vero-backend with GET /vero/admin/rides, then restart the server.'
          : error
      return NextResponse.json({ error: message }, { status: res.status })
    }

    const parsed = parseAdminRidesResponse(body)
    return NextResponse.json({
      success: true,
      items: parsed.rides,
      total: parsed.total,
      counts: parsed.counts,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin rides GET error:', err)
    return NextResponse.json({ error: 'Could not reach rides API' }, { status: 502 })
  }
}
