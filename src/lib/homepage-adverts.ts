/** Shared homepage advert types (Firestore `homepage_adverts`). */

export const HOMEPAGE_ADVERTS_COLLECTION = 'homepage_adverts'

export type HomepageAdvertStatus =
  | 'pending_payment'
  | 'active'
  | 'expired'
  | 'disabled'
  | string

export type HomepageAdvert = {
  id: string
  title: string
  description: string
  imageUrl: string
  category: string
  status: HomepageAdvertStatus
  /** Advert package fee paid to platform (MWK). */
  amountPaid: number
  planId: string
  durationDays: number
  durationHours: number
  productPrice: number | null
  ownerUid: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  backendUserId: number | null
  txRef: string | null
  startsAt: string | null
  endsAt: string | null
  paidAt: string | null
  createdAt: string | null
  updatedAt: string | null
  /** Whether amountPaid was credited to platform fee wallet. */
  platformFeeCredited: boolean
  platformFeeTxId: string | null
}

export type HomepageAdvertCounts = {
  all: number
  active: number
  pending: number
  expired: number
  disabled: number
  feeCredited: number
  feePending: number
  revenuePaid: number
  revenueCredited: number
}

/** Duration presets for complimentary admin posts (aligned with app plans). */
export const ADMIN_ADVERT_DURATION_PRESETS = [
  { id: '24h', label: '24 hours', durationHours: 24 },
  { id: '3d', label: '3 days', durationHours: 72 },
  { id: '7d', label: '1 week', durationHours: 168 },
  { id: '14d', label: '2 weeks', durationHours: 336 },
  { id: '30d', label: '30 days', durationHours: 720 },
] as const

export const ADMIN_ADVERT_CATEGORIES = [
  'Food & Drinks',
  'Electronics',
  'Fashion',
  'Services',
  'Real Estate',
  'Events',
  'Transport',
  'Other',
] as const

export function isAdvertLive(ad: HomepageAdvert, now = Date.now()): boolean {
  if (ad.status !== 'active') return false
  if (!ad.endsAt) return true
  const end = new Date(ad.endsAt).getTime()
  return Number.isFinite(end) ? end > now : true
}
