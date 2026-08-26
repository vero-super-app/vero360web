import 'server-only'

import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  DIGITAL_SERVICE_ORDERS_COLLECTION,
  type DigitalServiceOrder,
  type DigitalServiceOrderCounts,
} from '@/lib/digital-services'

export const PLATFORM_WALLET_USER_ID = 'super_admin'
export const PLATFORM_WALLET_DOC_ID = 'super_admin'
export const PLATFORM_WALLET_NAME = 'Vero 360 Platform'
export const WALLETS_COLLECTION = 'wallets'
export const WALLET_TX_COLLECTION = 'wallet_transactions'

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return Number(String(value ?? '').replace(/,/g, '')) || 0
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString()
      } catch {
        return null
      }
    }
    const seconds =
      (value as { _seconds?: number; seconds?: number })._seconds ??
      (value as { seconds?: number }).seconds
    if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString()
  }
  return null
}

export function parseDigitalServiceOrder(
  id: string,
  data: DocumentData | Record<string, unknown>,
): DigitalServiceOrder {
  const kindRaw = str(data.kind).toLowerCase()
  const category = str(data.category).toLowerCase()
  const kind =
    kindRaw ||
    (category === 'streaming' || data.period
      ? 'subscription'
      : 'gift_card')

  return {
    id,
    productKey: str(data.productKey),
    productName: str(data.productName) || 'Digital product',
    productSubtitle: str(data.productSubtitle),
    brandTag: str(data.brandTag),
    category: str(data.category),
    kind,
    period: str(data.period) || (kind === 'subscription' ? 'monthly' : null),
    periodLabel:
      str(data.periodLabel) || (kind === 'subscription' ? '1 month' : null),
    selectedUsd: (() => {
      const n = num(data.selectedUsd)
      return n > 0 ? n : null
    })(),
    amountMwk: num(data.amountMwk ?? data.amount),
    status: str(data.status).toLowerCase() || 'pending_payment',
    txRef: str(data.txRef || data.tx_ref) || null,
    buyerUid: str(data.buyerUid || data.userId),
    buyerName: str(data.buyerName || data.userName) || 'Buyer',
    buyerEmail: str(data.buyerEmail || data.email),
    buyerPhone: str(data.buyerPhone || data.phone),
    paidAt: tsToIso(data.paidAt),
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    platformFeeCredited: data.platformFeeCredited === true,
    platformFeeTxId: str(data.platformFeeTxId) || null,
  }
}

export function buildDigitalOrderCounts(
  items: DigitalServiceOrder[],
): DigitalServiceOrderCounts {
  let paid = 0
  let pending = 0
  let subscriptions = 0
  let giftCards = 0
  let feeCredited = 0
  let feePending = 0
  let revenuePaid = 0
  let revenueCredited = 0

  for (const o of items) {
    if (o.kind === 'subscription') subscriptions += 1
    else giftCards += 1

    if (o.status === 'pending_payment') pending += 1
    else if (o.status === 'paid' || o.status === 'fulfilled' || o.paidAt) {
      paid += 1
      revenuePaid += o.amountMwk
    }

    if (o.platformFeeCredited) {
      feeCredited += 1
      revenueCredited += o.amountMwk
    } else if (o.amountMwk > 0 && (o.paidAt || o.status === 'paid' || o.status === 'fulfilled')) {
      feePending += 1
    }
  }

  return {
    all: items.length,
    paid,
    pending,
    subscriptions,
    giftCards,
    feeCredited,
    feePending,
    revenuePaid,
    revenueCredited,
  }
}

export async function listDigitalServiceOrders(opts?: {
  limit?: number
}): Promise<DigitalServiceOrder[]> {
  const db = getAdminDb()
  const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 1000)
  let snap
  try {
    snap = await db
      .collection(DIGITAL_SERVICE_ORDERS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
  } catch {
    snap = await db.collection(DIGITAL_SERVICE_ORDERS_COLLECTION).limit(limit).get()
  }

  const items = snap.docs.map(d => parseDigitalServiceOrder(d.id, d.data()))
  items.sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bt - at
  })
  return items
}

export async function getDigitalServiceOrder(
  id: string,
): Promise<DigitalServiceOrder | null> {
  const clean = id.trim()
  if (!clean) return null
  const snap = await getAdminDb()
    .collection(DIGITAL_SERVICE_ORDERS_COLLECTION)
    .doc(clean)
    .get()
  if (!snap.exists) return null
  return parseDigitalServiceOrder(snap.id, snap.data() || {})
}

export async function updateDigitalServiceOrderStatus(
  id: string,
  status: 'paid' | 'fulfilled' | 'cancelled' | 'pending_payment',
): Promise<DigitalServiceOrder> {
  const ref = getAdminDb().collection(DIGITAL_SERVICE_ORDERS_COLLECTION).doc(id.trim())
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Order not found')

  await ref.set(
    {
      status,
      updatedAt: FieldValue.serverTimestamp(),
      ...(status === 'paid' || status === 'fulfilled'
        ? { paidAt: FieldValue.serverTimestamp() }
        : {}),
    },
    { merge: true },
  )

  const updated = await ref.get()
  return parseDigitalServiceOrder(updated.id, updated.data() || {})
}

export async function deleteDigitalServiceOrder(id: string): Promise<void> {
  const clean = id.trim()
  if (!clean) throw new Error('Missing order id')
  await getAdminDb().collection(DIGITAL_SERVICE_ORDERS_COLLECTION).doc(clean).delete()
}

async function ensurePlatformWallet(): Promise<string> {
  const db = getAdminDb()
  const ref = db.collection(WALLETS_COLLECTION).doc(PLATFORM_WALLET_DOC_ID)
  const snap = await ref.get()
  if (snap.exists) return ref.id
  await ref.set({
    walletId: PLATFORM_WALLET_DOC_ID,
    userId: PLATFORM_WALLET_USER_ID,
    merchantName: PLATFORM_WALLET_NAME,
    balance: 0,
    pendingBalance: 0,
    transactions: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}

/** Credit full digital order amount to Vero platform (super_admin) wallet. */
export async function creditDigitalOrderPlatformFee(orderId: string): Promise<{
  order: DigitalServiceOrder
  credited: boolean
  amount: number
  transactionId: string | null
  message: string
}> {
  const db = getAdminDb()
  const orderRef = db.collection(DIGITAL_SERVICE_ORDERS_COLLECTION).doc(orderId.trim())

  return db.runTransaction(async tx => {
    const orderSnap = await tx.get(orderRef)
    if (!orderSnap.exists) throw new Error('Order not found')
    const order = parseDigitalServiceOrder(orderSnap.id, orderSnap.data() || {})

    if (order.platformFeeCredited) {
      return {
        order,
        credited: false,
        amount: order.amountMwk,
        transactionId: order.platformFeeTxId,
        message: 'Platform fee already credited for this order',
      }
    }

    const amount = order.amountMwk
    if (amount <= 0) throw new Error('Order has no paid amount to credit')

    if (order.status === 'pending_payment' && !order.paidAt) {
      throw new Error('Order is still pending payment — fee not credited yet')
    }

    const walletRef = db.collection(WALLETS_COLLECTION).doc(PLATFORM_WALLET_DOC_ID)
    const walletSnap = await tx.get(walletRef)
    if (!walletSnap.exists) {
      tx.set(walletRef, {
        walletId: PLATFORM_WALLET_DOC_ID,
        userId: PLATFORM_WALLET_USER_ID,
        merchantName: PLATFORM_WALLET_NAME,
        balance: amount,
        pendingBalance: 0,
        transactions: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else {
      const bal = num(walletSnap.data()?.balance)
      tx.update(walletRef, {
        balance: bal + amount,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    const transactionId = `TXN_DIG_${order.id}_${Date.now()}`
    const description = `Digital service · ${order.productName}`.slice(0, 180)
    const reference = order.txRef || `digital:${order.id}`

    tx.set(db.collection(WALLET_TX_COLLECTION).doc(transactionId), {
      transactionId,
      walletId: PLATFORM_WALLET_DOC_ID,
      userId: PLATFORM_WALLET_USER_ID,
      type: 'service_fee',
      amount,
      status: 'completed',
      description,
      reference,
      source: 'digital_service',
      digitalOrderId: order.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    tx.set(
      orderRef,
      {
        platformFeeCredited: true,
        platformFeeTxId: transactionId,
        platformFeeCreditedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    return {
      order: {
        ...order,
        platformFeeCredited: true,
        platformFeeTxId: transactionId,
      },
      credited: true,
      amount,
      transactionId,
      message: `Credited ${amount} MWK to platform fee wallet`,
    }
  })
}

export async function creditPendingDigitalOrderPlatformFees(): Promise<{
  scanned: number
  credited: number
  skipped: number
  totalAmount: number
  results: Array<{ id: string; credited: boolean; amount: number; message: string }>
}> {
  await ensurePlatformWallet()
  const items = await listDigitalServiceOrders({ limit: 1000 })
  const candidates = items.filter(
    o =>
      !o.platformFeeCredited &&
      o.amountMwk > 0 &&
      (o.paidAt || o.status === 'paid' || o.status === 'fulfilled'),
  )

  const results: Array<{ id: string; credited: boolean; amount: number; message: string }> = []
  let credited = 0
  let skipped = 0
  let totalAmount = 0

  for (const o of candidates) {
    try {
      const res = await creditDigitalOrderPlatformFee(o.id)
      results.push({
        id: o.id,
        credited: res.credited,
        amount: res.amount,
        message: res.message,
      })
      if (res.credited) {
        credited += 1
        totalAmount += res.amount
      } else {
        skipped += 1
      }
    } catch (err) {
      skipped += 1
      results.push({
        id: o.id,
        credited: false,
        amount: o.amountMwk,
        message: err instanceof Error ? err.message : 'Credit failed',
      })
    }
  }

  return { scanned: candidates.length, credited, skipped, totalAmount, results }
}
