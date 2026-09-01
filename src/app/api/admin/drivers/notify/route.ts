import { NextResponse } from 'next/server'
import { denyUnlessPanelAdminOrApiKey } from '@/lib/admin-auth'

type NotifyBody = {
  type?: 'driver' | 'vehicle'
  driverId?: number
  taxiId?: number
  name?: string
  email?: string
  phone?: string
  detail?: string
}

/** Optional email alert when a driver submits verification documents (Resend). */
export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdminOrApiKey(request)
  if (denied) return denied
  let body: NotifyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const to =
    process.env.CONTACT_TO_EMAIL ||
    process.env.VEROCHAT_NOTIFY_EMAIL ||
    'info@vero360.app'
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ ok: true, skipped: 'email_not_configured' })
  }

  const adminBase = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://vero360.app'
  const driverId = body.driverId
  const inboxUrl = driverId
    ? `${adminBase.replace(/\/$/, '')}/dashboard/vero-ride/${driverId}`
    : `${adminBase.replace(/\/$/, '')}/dashboard/vero-ride`

  const isVehicle = body.type === 'vehicle'
  const subjectLabel = isVehicle ? 'Vehicle documents' : 'Driver application'
  const nameLabel = body.name?.trim() || 'A driver'

  const text = [
    `${nameLabel} submitted ${isVehicle ? 'vehicle compliance documents' : 'driver identity documents'} for review.`,
    '',
    `Driver ID: ${driverId ?? '—'}`,
    body.taxiId ? `Vehicle ID: ${body.taxiId}` : null,
    `Email: ${body.email || '—'}`,
    `Phone: ${body.phone || '—'}`,
    body.detail ? `Details: ${body.detail}` : null,
    '',
    `Review in admin: ${inboxUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Vero360 <onboarding@resend.dev>',
      to: [to],
      subject: `[Vero Ride] ${subjectLabel} — ${nameLabel}`,
      text,
    }),
  })

  if (!res.ok) {
    console.error('Driver notify error:', await res.text())
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
