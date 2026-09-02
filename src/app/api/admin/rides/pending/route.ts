import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { nestAdminFetch } from '@/lib/nest-admin'

export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)

    const { res, body, error } = await nestAdminFetch(
      ['admin', 'rides', 'issues-count'],
      undefined,
      request,
    )

    if (!res.ok) {
      const message =
        res.status === 404
          ? 'Ride issues API is not on the backend yet. Redeploy vero-backend with GET /vero/admin/rides/issues-count.'
          : error
      return NextResponse.json({ error: message }, { status: res.status })
    }

    const issues =
      body && typeof body === 'object' && 'issues' in body
        ? Number((body as { issues: unknown }).issues)
        : 0

    return NextResponse.json({
      success: true,
      issues: Number.isFinite(issues) ? issues : 0,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin rides pending GET error:', err)
    return NextResponse.json({ error: 'Could not reach rides API' }, { status: 502 })
  }
}
