import { NextResponse } from 'next/server'

/** Protect scheduled sync routes — set CRON_SECRET on Netlify / hosting. */
export function denyUnlessCronAuthorized(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }

  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (auth === `Bearer ${secret}`) return null

  const header = request.headers.get('x-cron-secret')
  if (header === secret) return null

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
