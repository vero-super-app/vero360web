import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  isCourierStatus,
  parseCourierDeliveries,
  type CourierDelivery,
} from '@/lib/courier'
import {
  publishCourierStatusAlert,
  resolveCourierSenderUid,
} from '@/lib/courier-push'
import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

type Ctx = { params: Promise<{ id: string }> }

async function loadDelivery(
  id: string,
  authHeader: string | null,
): Promise<CourierDelivery | null> {
  const headers: HeadersInit = { Accept: 'application/json' }
  if (authHeader) headers.Authorization = authHeader
  const res = await fetch(veroEndpoint('verocourier', 'deliveries', id), {
    headers,
    cache: 'no-store',
  })
  const data = await readJsonSafe(res)
  if (!res.ok) return null
  const [item] = parseCourierDeliveries([data])
  return item || null
}

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const { id } = await ctx.params
  const auth = getVeroAuthHeader(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const status =
    body && typeof body === 'object' && 'status' in body
      ? String((body as { status: unknown }).status || '')
      : ''

  const cancelReasonRaw =
    body && typeof body === 'object' && 'cancelReason' in body
      ? String((body as { cancelReason: unknown }).cancelReason || '').trim()
      : ''

  if (!isCourierStatus(status)) {
    return NextResponse.json(
      { error: 'status must be PENDING, ACCEPTED, ON_THE_WAY, DELIVERED, or CANCELLED' },
      { status: 400 },
    )
  }

  if (status === 'CANCELLED' && !cancelReasonRaw) {
    return NextResponse.json(
      { error: 'cancelReason is required when rejecting a delivery' },
      { status: 400 },
    )
  }

  const cancelReason =
    status === 'CANCELLED'
      ? cancelReasonRaw.replace(/\s*\|\s*/g, ' — ').slice(0, 500)
      : undefined

  try {
    // Capture sender metadata before status write (Nest may omit fields on PATCH).
    const before = await loadDelivery(id, auth)

    const headers: HeadersInit = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
    if (auth) headers.Authorization = auth

    const nestBody: Record<string, string> = { status }
    if (cancelReason) nestBody.cancelReason = cancelReason

    const res = await fetch(veroEndpoint('verocourier', 'deliveries', id, 'status'), {
      method: 'PATCH',
      headers,
      body: JSON.stringify(nestBody),
    })
    const data = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(data, 'Failed to update delivery status') },
        { status: res.status },
      )
    }

    let [item] = parseCourierDeliveries([data])
    if (!item?.additionalInformation || !item.senderUid) {
      const fresh = await loadDelivery(id, auth)
      if (fresh) {
        item = {
          ...fresh,
          status: item?.status || status,
          cancelReason: item?.cancelReason || fresh.cancelReason || cancelReason || null,
          estimatedPriceMwk: item?.estimatedPriceMwk ?? fresh.estimatedPriceMwk,
          estimatedDistanceKm: item?.estimatedDistanceKm ?? fresh.estimatedDistanceKm,
          estimateSummary: item?.estimateSummary ?? fresh.estimateSummary,
          senderUid: item?.senderUid || fresh.senderUid || before?.senderUid || null,
        }
      }
    }

    if (before) {
      item = {
        ...(item || before),
        senderUid: item?.senderUid || before.senderUid,
        email: item?.email || before.email,
        phone: item?.phone || before.phone,
        pickupLocation: item?.pickupLocation || before.pickupLocation,
        dropoffLocation: item?.dropoffLocation || before.dropoffLocation,
        trackingNumber: item?.trackingNumber || before.trackingNumber,
        estimatedPriceMwk: item?.estimatedPriceMwk ?? before.estimatedPriceMwk,
        estimatedDistanceKm: item?.estimatedDistanceKm ?? before.estimatedDistanceKm,
        estimateSummary: item?.estimateSummary ?? before.estimateSummary,
        additionalInformation:
          item?.additionalInformation || before.additionalInformation,
        status,
        cancelReason: cancelReason || item?.cancelReason || before.cancelReason,
      }
    }

    const delivery = item || null

    let notified = false
    let fcmSent = 0
    let notifyError: string | null = null
    try {
      const senderUid = await resolveCourierSenderUid({
        senderUid: delivery?.senderUid || before?.senderUid,
        email: delivery?.email || before?.email,
      })

      if (senderUid && delivery) {
        const result = await publishCourierStatusAlert({
          senderUid,
          trackingCode: delivery.trackingNumber || `#${delivery.id}`,
          status,
          pickup: delivery.pickupLocation,
          dropoff: delivery.dropoffLocation,
          cancelReason: cancelReason || delivery.cancelReason,
        })
        notified = result.queued
        fcmSent = result.fcmSent || 0
        if (!fcmSent && result.fcmError) {
          notifyError = result.fcmError
        }
      } else {
        notifyError =
          'Could not resolve sender Firebase UID — open the delivery in Nest/app and confirm SenderUid is saved'
      }
    } catch (err) {
      notifyError = err instanceof Error ? err.message : 'Push notification failed'
      console.warn('Courier status push skipped:', notifyError)
    }

    return NextResponse.json({
      success: true,
      item: delivery || data,
      notified,
      fcmSent,
      notifyError,
    })
  } catch (err) {
    console.error('Admin courier status PATCH error:', err)
    return NextResponse.json({ error: 'Could not update delivery status' }, { status: 502 })
  }
}
