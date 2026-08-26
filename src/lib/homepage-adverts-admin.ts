import 'server-only'

import { randomUUID } from 'crypto'
import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { getAdminDb, getAdminStorage, getAdminStorageBucket } from '@/lib/firebase-admin'
import {
  HOMEPAGE_ADVERTS_COLLECTION,
  isAdvertLive,
  ADMIN_ADVERT_DURATION_PRESETS,
  type HomepageAdvert,
  type HomepageAdvertCounts,
} from '@/lib/homepage-adverts'

export const PLATFORM_WALLET_USER_ID = 'super_admin'
export const PLATFORM_WALLET_DOC_ID = 'super_admin'
export const PLATFORM_WALLET_NAME = 'Vero 360 Platform'
export const WALLETS_COLLECTION = 'wallets'
export const WALLET_TX_COLLECTION = 'wallet_transactions'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

function firebaseDownloadUrl(bucketName: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
}

function imageExt(contentType: string, fileName: string): string {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  const fromName = fileName.split('.').pop()?.toLowerCase()
  if (fromName === 'png' || fromName === 'webp' || fromName === 'gif' || fromName === 'jpg' || fromName === 'jpeg') {
    return fromName === 'jpeg' ? 'jpg' : fromName
  }
  return 'jpg'
}

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

export function parseHomepageAdvert(
  id: string,
  data: DocumentData | Record<string, unknown>,
): HomepageAdvert {
  const amountPaid = num(data.priceMwk ?? data.amountPaid ?? data.amount)
  const productRaw = data.productPrice ?? data.sellingPrice
  const productPrice = num(productRaw)
  const status = str(data.status).toLowerCase() || 'pending_payment'

  return {
    id,
    title: str(data.title) || 'Untitled advert',
    description: str(data.description),
    imageUrl: str(data.imageUrl),
    category: str(data.category),
    status,
    amountPaid,
    planId: str(data.planId),
    durationDays: num(data.durationDays),
    durationHours: num(data.durationHours),
    productPrice: productPrice > 0 ? productPrice : null,
    ownerUid: str(data.userId) || str(data.merchantId),
    ownerName: str(data.userName) || 'Advertiser',
    ownerEmail: str(data.userEmail) || str(data.email),
    ownerPhone: str(data.phone),
    backendUserId: (() => {
      const n = num(data.backendUserId ?? data.user_id)
      return n > 0 ? Math.round(n) : null
    })(),
    txRef: str(data.txRef || data.tx_ref) || null,
    startsAt: tsToIso(data.startsAt),
    endsAt: tsToIso(data.endsAt),
    paidAt: tsToIso(data.paidAt),
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    platformFeeCredited: data.platformFeeCredited === true,
    platformFeeTxId: str(data.platformFeeTxId) || null,
  }
}

export function buildAdvertCounts(items: HomepageAdvert[]): HomepageAdvertCounts {
  const now = Date.now()
  let active = 0
  let pending = 0
  let expired = 0
  let disabled = 0
  let feeCredited = 0
  let feePending = 0
  let revenuePaid = 0
  let revenueCredited = 0

  for (const ad of items) {
    const live = isAdvertLive(ad, now)
    if (ad.status === 'pending_payment') pending += 1
    else if (ad.status === 'disabled') disabled += 1
    else if (live) active += 1
    else if (ad.status === 'active' || ad.status === 'expired') expired += 1
    else if (ad.endsAt && new Date(ad.endsAt).getTime() <= now) expired += 1

    if (ad.amountPaid > 0 && (ad.status === 'active' || ad.paidAt || ad.platformFeeCredited)) {
      revenuePaid += ad.amountPaid
    }
    if (ad.platformFeeCredited) {
      feeCredited += 1
      revenueCredited += ad.amountPaid
    } else if (ad.amountPaid > 0 && (ad.status === 'active' || ad.paidAt)) {
      feePending += 1
    }
  }

  return {
    all: items.length,
    active,
    pending,
    expired,
    disabled,
    feeCredited,
    feePending,
    revenuePaid,
    revenueCredited,
  }
}

export async function listHomepageAdverts(opts?: {
  limit?: number
}): Promise<HomepageAdvert[]> {
  const db = getAdminDb()
  const limit = Math.min(Math.max(opts?.limit ?? 300, 1), 1000)
  let snap
  try {
    snap = await db
      .collection(HOMEPAGE_ADVERTS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
  } catch {
    snap = await db.collection(HOMEPAGE_ADVERTS_COLLECTION).limit(limit).get()
  }

  const items = snap.docs.map(d => parseHomepageAdvert(d.id, d.data()))
  items.sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bt - at
  })
  return items
}

export async function getHomepageAdvert(id: string): Promise<HomepageAdvert | null> {
  const clean = id.trim()
  if (!clean) return null
  const snap = await getAdminDb().collection(HOMEPAGE_ADVERTS_COLLECTION).doc(clean).get()
  if (!snap.exists) return null
  return parseHomepageAdvert(snap.id, snap.data() || {})
}

export async function updateHomepageAdvertStatus(
  id: string,
  status: 'active' | 'disabled' | 'expired',
): Promise<HomepageAdvert> {
  const ref = getAdminDb().collection(HOMEPAGE_ADVERTS_COLLECTION).doc(id.trim())
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Advert not found')

  await ref.set(
    {
      status,
      active: status === 'active',
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  const updated = await ref.get()
  return parseHomepageAdvert(updated.id, updated.data() || {})
}

export async function deleteHomepageAdvert(id: string): Promise<void> {
  const clean = id.trim()
  if (!clean) throw new Error('Missing advert id')
  await getAdminDb().collection(HOMEPAGE_ADVERTS_COLLECTION).doc(clean).delete()
}

export async function uploadHomepageAdvertImage(file: File): Promise<string> {
  if (file.size <= 0) throw new Error('Empty file')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be 8MB or smaller')

  const contentType = (file.type || 'application/octet-stream').toLowerCase()
  if (!contentType.startsWith('image/')) {
    throw new Error('Only image files are allowed')
  }
  if (
    ALLOWED_IMAGE_TYPES.size > 0 &&
    !ALLOWED_IMAGE_TYPES.has(contentType) &&
    contentType !== 'image/jpg'
  ) {
    throw new Error('Use JPEG, PNG, WebP, or GIF')
  }

  const ext = imageExt(contentType, file.name)
  const objectPath = `homepage_adverts/admin/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const bucket = getAdminStorage().bucket(getAdminStorageBucket())
  const token = randomUUID()

  await bucket.file(objectPath).save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  })

  return firebaseDownloadUrl(bucket.name, objectPath, token)
}

/**
 * Create a complimentary homepage advert (no payment) — goes live immediately.
 * Same Firestore shape as app-paid ads so the mobile slider picks it up.
 */
export async function createAdminHomepageAdvert(input: {
  title: string
  description?: string
  imageUrl: string
  category?: string
  durationHours?: number
  planId?: string
  productPrice?: number | null
  ownerName?: string
  ownerEmail?: string
  ownerPhone?: string
  ownerUid?: string
}): Promise<HomepageAdvert> {
  const title = str(input.title)
  const imageUrl = str(input.imageUrl)
  if (!title) throw new Error('Title is required')
  if (!imageUrl) throw new Error('A photo upload is required')

  let durationHours = Math.round(num(input.durationHours))
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    const preset = ADMIN_ADVERT_DURATION_PRESETS.find(p => p.id === str(input.planId))
    durationHours = preset?.durationHours ?? 168
  }
  durationHours = Math.min(Math.max(durationHours, 1), 24 * 90)

  const planId =
    str(input.planId) ||
    ADMIN_ADVERT_DURATION_PRESETS.find(p => p.durationHours === durationHours)?.id ||
    'admin_comp'

  const now = new Date()
  const ends = new Date(now.getTime() + durationHours * 60 * 60 * 1000)
  const durationDays = Math.max(1, Math.ceil(durationHours / 24))
  const category = str(input.category) || 'Other'
  const ownerUid = str(input.ownerUid) || 'admin'
  const ownerName = str(input.ownerName) || 'Vero360 Admin'
  const ownerEmail = str(input.ownerEmail)
  const ownerPhone = str(input.ownerPhone)
  const productPrice = num(input.productPrice)
  const description = str(input.description)

  const ref = getAdminDb().collection(HOMEPAGE_ADVERTS_COLLECTION).doc()
  const txRef = `admin_comp:${ref.id}`

  await ref.set({
    title,
    description,
    imageUrl,
    category,
    userId: ownerUid,
    merchantId: ownerUid,
    userName: ownerName,
    userEmail: ownerEmail || null,
    phone: ownerPhone || null,
    ...(productPrice > 0 ? { productPrice } : {}),
    planId,
    status: 'active',
    active: true,
    priceMwk: 0,
    amountPaid: 0,
    durationHours,
    durationDays,
    txRef,
    paidAt: null,
    startsAt: now,
    endsAt: ends,
    platformFeeCredited: true,
    platformFeeTxId: null,
    complimentary: true,
    source: 'admin_web',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  return parseHomepageAdvert(ref.id, {
    title,
    description,
    imageUrl,
    category,
    userId: ownerUid,
    userName: ownerName,
    userEmail: ownerEmail,
    phone: ownerPhone,
    productPrice: productPrice > 0 ? productPrice : null,
    planId,
    status: 'active',
    priceMwk: 0,
    durationHours,
    durationDays,
    txRef,
    startsAt: now,
    endsAt: ends,
    platformFeeCredited: true,
    createdAt: now,
    updatedAt: now,
  })
}

/** Ensure platform wallet doc exists; return its id. */
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

/**
 * Credit the full advert package fee into the platform (super_admin) wallet
 * as a service_fee / platform fee. Idempotent via platformFeeCredited flag.
 */
export async function creditAdvertPlatformFee(advertId: string): Promise<{
  advert: HomepageAdvert
  credited: boolean
  amount: number
  transactionId: string | null
  message: string
}> {
  const db = getAdminDb()
  const advertRef = db.collection(HOMEPAGE_ADVERTS_COLLECTION).doc(advertId.trim())

  return db.runTransaction(async tx => {
    const advertSnap = await tx.get(advertRef)
    if (!advertSnap.exists) throw new Error('Advert not found')
    const data = advertSnap.data() || {}
    const advert = parseHomepageAdvert(advertSnap.id, data)

    if (advert.platformFeeCredited) {
      return {
        advert,
        credited: false,
        amount: advert.amountPaid,
        transactionId: advert.platformFeeTxId,
        message: 'Platform fee already credited for this advert',
      }
    }

    const amount = advert.amountPaid
    if (amount <= 0) {
      throw new Error('Advert has no paid package amount to credit')
    }

    // Only credit when payment happened (active / paid), not pending drafts.
    const paid =
      Boolean(advert.paidAt) ||
      advert.status === 'active' ||
      advert.status === 'expired' ||
      advert.status === 'disabled'
    if (!paid && advert.status === 'pending_payment') {
      throw new Error('Advert is still pending payment — fee not credited yet')
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

    const transactionId = `TXN_AD_${advert.id}_${Date.now()}`
    const txRef = db.collection(WALLET_TX_COLLECTION).doc(transactionId)
    const description = `Homepage advert fee · ${advert.title}`.slice(0, 180)
    const reference = advert.txRef || `homepage_ad:${advert.id}`

    tx.set(txRef, {
      transactionId,
      walletId: PLATFORM_WALLET_DOC_ID,
      userId: PLATFORM_WALLET_USER_ID,
      type: 'service_fee',
      amount,
      status: 'completed',
      description,
      reference,
      source: 'homepage_advert',
      advertId: advert.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    tx.set(
      advertRef,
      {
        platformFeeCredited: true,
        platformFeeTxId: transactionId,
        platformFeeCreditedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    return {
      advert: {
        ...advert,
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

/** Credit all paid ads that are missing a platform fee ledger entry. */
export async function creditPendingAdvertPlatformFees(): Promise<{
  scanned: number
  credited: number
  skipped: number
  totalAmount: number
  results: Array<{ id: string; credited: boolean; amount: number; message: string }>
}> {
  await ensurePlatformWallet()
  const items = await listHomepageAdverts({ limit: 1000 })
  const candidates = items.filter(
    ad =>
      !ad.platformFeeCredited &&
      ad.amountPaid > 0 &&
      (ad.paidAt || ad.status === 'active' || ad.status === 'expired' || ad.status === 'disabled'),
  )

  const results: Array<{ id: string; credited: boolean; amount: number; message: string }> = []
  let credited = 0
  let skipped = 0
  let totalAmount = 0

  for (const ad of candidates) {
    try {
      const res = await creditAdvertPlatformFee(ad.id)
      results.push({
        id: ad.id,
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
        id: ad.id,
        credited: false,
        amount: ad.amountPaid,
        message: err instanceof Error ? err.message : 'Credit failed',
      })
    }
  }

  return {
    scanned: candidates.length,
    credited,
    skipped,
    totalAmount,
    results,
  }
}
