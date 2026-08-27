import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebase-admin'
import type { CourierStatus } from '@/lib/courier'

export const ORDER_PARTY_ALERTS_COLLECTION = 'order_party_alerts'

export function courierStatusPushCopy(
  status: CourierStatus,
  trackingCode: string,
  cancelReason?: string | null,
): { title: string; body: string; event: string } {
  const code = trackingCode.trim() || 'your parcel'
  const reason = (cancelReason || '').trim()

  switch (status) {
    case 'PENDING':
      return {
        title: 'Parcel request received',
        body: `We received your parcel ${code}. A courier will accept it shortly.`,
        event: 'pending',
      }
    case 'ACCEPTED':
      return {
        title: 'Parcel accepted',
        body: `Your parcel ${code} has been accepted by Vero Courier.`,
        event: 'accepted',
      }
    case 'ON_THE_WAY':
      return {
        title: 'Courier is coming',
        body: `Your parcel ${code} is on the way. The courier is coming now.`,
        event: 'coming',
      }
    case 'DELIVERED':
      return {
        title: 'Parcel delivered',
        body: `Your parcel ${code} has been delivered.`,
        event: 'delivered',
      }
    case 'CANCELLED':
      return {
        title: 'Parcel rejected',
        body: reason
          ? `Your parcel ${code} was rejected. Reason: ${reason}`
          : `Your parcel ${code} was rejected. Contact support if you need help.`,
        event: 'rejected',
      }
    default:
      return {
        title: 'Parcel update',
        body: `Your parcel ${code} status is now ${status}.`,
        event: String(status).toLowerCase(),
      }
  }
}

/** Resolve Firebase Auth uid: Auth email → users/{uid} email → provided senderUid. */
export async function resolveCourierSenderUid(opts: {
  senderUid?: string | null
  email?: string | null
}): Promise<string | null> {
  const fromMeta = (opts.senderUid || '').trim()
  if (fromMeta) return fromMeta

  const email = (opts.email || '').trim()
  if (!email || email.toLowerCase() === 'no-email@vero.local') return null

  try {
    const user = await getAdminAuth().getUserByEmail(email)
    if (user?.uid) return user.uid
  } catch {
    // not found / auth not configured
  }

  const lower = email.toLowerCase()
  for (const candidate of lower === email ? [email] : [lower, email]) {
    try {
      const snap = await getAdminDb()
        .collection('users')
        .where('email', '==', candidate)
        .limit(1)
        .get()
      if (!snap.empty) return snap.docs[0].id
    } catch (err) {
      console.warn('resolveCourierSenderUid firestore:', err)
    }
  }

  return null
}

/** @deprecated use resolveCourierSenderUid */
export async function resolveUidByEmail(email?: string | null): Promise<string | null> {
  return resolveCourierSenderUid({ email })
}

async function collectFcmTokens(uid: string): Promise<string[]> {
  const tokens = new Set<string>()
  try {
    const doc = await getAdminDb().collection('users').doc(uid).get()
    const data = doc.data() || {}
    const single = String(data.fcmToken || '').trim()
    if (single) tokens.add(single)
    const arr = data.fcmTokens
    if (Array.isArray(arr)) {
      for (const t of arr) {
        const s = String(t || '').trim()
        if (s) tokens.add(s)
      }
    }
  } catch (err) {
    console.warn('collectFcmTokens:', err)
  }

  try {
    const sub = await getAdminDb()
      .collection('users')
      .doc(uid)
      .collection('fcmTokens')
      .limit(40)
      .get()
    for (const d of sub.docs) {
      const t = String(d.data()?.token || d.id || '').trim()
      if (t) tokens.add(t)
    }
  } catch {
    // optional subcollection
  }

  return [...tokens]
}

async function sendFcmToUid(
  uid: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ sent: number; error?: string }> {
  const tokens = await collectFcmTokens(uid)
  if (!tokens.length) return { sent: 0, error: 'No FCM tokens for user' }

  try {
    const messaging = getAdminMessaging()
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
      android: {
        priority: 'high',
        notification: { channelId: 'high_importance_channel', sound: 'default' },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            contentAvailable: true,
          },
        },
      },
    })

    // Drop invalid tokens
    const invalid: string[] = []
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || ''
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-registration-token')
        ) {
          invalid.push(tokens[i])
        }
      }
    })
    if (invalid.length) {
      try {
        const ref = getAdminDb().collection('users').doc(uid)
        await ref.set(
          { fcmTokens: FieldValue.arrayRemove(...invalid) },
          { merge: true },
        )
      } catch {
        // ignore cleanup failures
      }
    }

    return { sent: res.successCount }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'FCM send failed'
    console.warn('sendFcmToUid:', message)
    return { sent: 0, error: message }
  }
}

/**
 * Queue courier status alert:
 * 1) Firestore `order_party_alerts` (in-app listener)
 * 2) FCM push (background / killed app)
 */
export async function publishCourierStatusAlert(opts: {
  senderUid: string
  trackingCode: string
  status: CourierStatus
  pickup?: string | null
  dropoff?: string | null
  cancelReason?: string | null
}): Promise<{ queued: boolean; toUid?: string; fcmSent?: number; fcmError?: string }> {
  const uid = opts.senderUid.trim()
  if (!uid) return { queued: false }

  const { title, body, event } = courierStatusPushCopy(
    opts.status,
    opts.trackingCode,
    opts.cancelReason,
  )
  const from = (opts.pickup || '').trim()
  const to = (opts.dropoff || '').trim()
  const routeSeg = from && to ? ` (${from} → ${to})` : ''
  const fullBody = `${body}${routeSeg}`
  const tracking = opts.trackingCode.trim() || ''

  await getAdminDb().collection(ORDER_PARTY_ALERTS_COLLECTION).add({
    toUid: uid,
    title,
    body: fullBody,
    payload: {
      type: 'courier_status',
      status: event,
      trackingNumber: tracking || null,
      courierStatus: opts.status,
      cancelReason: (opts.cancelReason || '').trim() || null,
    },
    createdAt: FieldValue.serverTimestamp(),
    consumed: false,
  })

  const fcm = await sendFcmToUid(uid, title, fullBody, {
    type: 'courier_status',
    status: event,
    trackingNumber: tracking,
    courierStatus: opts.status,
    cancelReason: (opts.cancelReason || '').trim(),
  })

  return {
    queued: true,
    toUid: uid,
    fcmSent: fcm.sent,
    fcmError: fcm.error,
  }
}
