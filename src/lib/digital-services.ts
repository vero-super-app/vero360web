/** Digital Services orders (subscriptions + gift cards) — Firestore `digital_service_orders`. */

export const DIGITAL_SERVICE_ORDERS_COLLECTION = 'digital_service_orders'

export type DigitalOrderKind = 'subscription' | 'gift_card' | 'crypto' | string
export type DigitalOrderStatus = 'pending_payment' | 'paid' | 'fulfilled' | 'cancelled' | string

export type DigitalServiceOrder = {
  id: string
  productKey: string
  productName: string
  productSubtitle: string
  brandTag: string
  category: string
  kind: DigitalOrderKind
  /** e.g. monthly */
  period: string | null
  periodLabel: string | null
  selectedUsd: number | null
  amountMwk: number
  status: DigitalOrderStatus
  txRef: string | null
  paymentProvider: string | null
  bankProofUrl: string | null
  buyerUid: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  paidAt: string | null
  createdAt: string | null
  updatedAt: string | null
  startDate: string | null
  endDate: string | null
  platformFeeCredited: boolean
  platformFeeTxId: string | null
  isGuest: boolean
  payoutKyc: {
    kind: string
    alipayWechatCodeUrl: string
    idInHandUrl: string
    faceUrl: string
    binanceId: string
    binanceAddress: string
    binanceCodeUrl: string
    uploadedAt: string | null
  } | null
  fulfillment: {
    cardDetails: string
    joiningLink: string
    notes: string
    fileUrls: string[]
    sentAt: string | null
    sentVia: string[]
  } | null
  fulfillmentMode?: string | null
  fulfillmentProvider?: string | null
  fulfillmentError?: string | null
  prepaidForgeSku?: string | null
  prepaidForgeRegion?: string | null
}

export type DigitalServiceOrderCounts = {
  all: number
  paid: number
  pending: number
  subscriptions: number
  giftCards: number
  giftCardsPaid: number
  giftCardsPending: number
  activeSubscriptions: number
  expiredSubscriptions: number
  feeCredited: number
  feePending: number
  revenuePaid: number
  revenueCredited: number
  crypto: number
}

function slugStatus(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

/** Normalize app/Firestore status variants into one of the known panel statuses. */
export function normalizeDigitalOrderStatus(raw: unknown): DigitalOrderStatus {
  const v = slugStatus(raw)
  if (!v) return 'pending_payment'
  if (
    v === 'pending_payment' ||
    v === 'pendingpayment' ||
    v === 'pending' ||
    v === 'awaiting_payment' ||
    v === 'awaitingpayment' ||
    v === 'unpaid' ||
    v === 'payment_pending' ||
    v === 'awaiting_bank' ||
    v === 'awaiting_bank_confirmation' ||
    v === 'bank_transfer_pending'
  ) {
    return 'pending_payment'
  }
  if (v === 'fulfilled' || v === 'complete' || v === 'completed' || v === 'delivered') {
    return 'fulfilled'
  }
  if (v === 'cancelled' || v === 'canceled' || v === 'failed' || v === 'refunded') {
    return 'cancelled'
  }
  if (v === 'paid' || v === 'success' || v === 'successful' || v === 'payment_success') {
    return 'paid'
  }
  return v
}

export function normalizeDigitalOrderKind(
  rawKind: unknown,
  opts?: { category?: unknown; period?: unknown },
): DigitalOrderKind {
  const v = slugStatus(rawKind)
  if (v === 'subscription' || v === 'sub' || v === 'streaming') return 'subscription'
  if (v === 'crypto' || v === 'fx') return 'crypto'
  if (
    v === 'gift_card' ||
    v === 'giftcard' ||
    v === 'gift' ||
    v === 'voucher'
  ) {
    return 'gift_card'
  }
  if (v) return v

  const category = slugStatus(opts?.category)
  if (category === 'streaming' || category === 'subscription') return 'subscription'
  if (category === 'crypto' || category === 'fx') return 'crypto'
  if (category === 'gift_card' || category === 'giftcard' || category === 'gift') {
    return 'gift_card'
  }
  if (opts?.period) return 'subscription'
  return 'gift_card'
}

export function isDigitalOrderPending(order: Pick<DigitalServiceOrder, 'status'>): boolean {
  return normalizeDigitalOrderStatus(order.status) === 'pending_payment'
}

/**
 * Paid / fulfilled only — never overlaps with pending.
 * `paidAt` alone does not mark an order paid while status is still pending.
 */
export function isDigitalOrderPaid(
  order: Pick<DigitalServiceOrder, 'status' | 'paidAt'>,
): boolean {
  const status = normalizeDigitalOrderStatus(order.status)
  if (status === 'pending_payment' || status === 'cancelled') return false
  return status === 'paid' || status === 'fulfilled'
}

export function isDigitalGiftCard(
  order: Pick<DigitalServiceOrder, 'kind' | 'category'>,
): boolean {
  if (isDigitalCrypto(order)) return false
  return normalizeDigitalOrderKind(order.kind, { category: order.category }) === 'gift_card'
}

export function isDigitalSubscription(order: Pick<DigitalServiceOrder, 'kind'>): boolean {
  return normalizeDigitalOrderKind(order.kind) === 'subscription'
}

export function isDigitalCrypto(order: Pick<DigitalServiceOrder, 'kind' | 'category'>): boolean {
  return (
    normalizeDigitalOrderKind(order.kind, { category: order.category }) === 'crypto' ||
    String(order.category || '').trim().toLowerCase() === 'crypto'
  )
}

/**
 * Calculates a subscription's linked end date based on its start date and period/periodLabel.
 * Supports months, years, weeks, days, quarterly, semi-annual, annual, etc.
 */
export function computeSubscriptionEndDate(
  startDateStr: string | null | undefined,
  period?: string | null,
  periodLabel?: string | null,
): string | null {
  if (!startDateStr) return null
  const start = new Date(startDateStr)
  if (Number.isNaN(start.getTime())) return null

  const p = `${period || ''} ${periodLabel || ''}`.toLowerCase().trim()
  const end = new Date(start)

  // Match e.g. "3 months", "6 month", "12 months"
  const monthMatch = p.match(/(\d+)\s*(?:month|m\b)/)
  if (monthMatch) {
    const months = parseInt(monthMatch[1], 10)
    if (!Number.isNaN(months) && months > 0) {
      end.setMonth(end.getMonth() + months)
      return end.toISOString()
    }
  }

  // Match e.g. "1 year", "2 years"
  const yearMatch = p.match(/(\d+)\s*(?:year|yr|y\b)/)
  if (yearMatch) {
    const years = parseInt(yearMatch[1], 10)
    if (!Number.isNaN(years) && years > 0) {
      end.setFullYear(end.getFullYear() + years)
      return end.toISOString()
    }
  }

  // Match e.g. "2 weeks", "1 week"
  const weekMatch = p.match(/(\d+)\s*(?:week|wk|w\b)/)
  if (weekMatch) {
    const weeks = parseInt(weekMatch[1], 10)
    if (!Number.isNaN(weeks) && weeks > 0) {
      end.setDate(end.getDate() + weeks * 7)
      return end.toISOString()
    }
  }

  // Match e.g. "30 days", "7 days"
  const dayMatch = p.match(/(\d+)\s*(?:day|d\b)/)
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10)
    if (!Number.isNaN(days) && days > 0) {
      end.setDate(end.getDate() + days)
      return end.toISOString()
    }
  }

  if (p.includes('annual') || p.includes('yearly')) {
    end.setFullYear(end.getFullYear() + 1)
    return end.toISOString()
  }

  if (p.includes('semi-annual') || p.includes('half year')) {
    end.setMonth(end.getMonth() + 6)
    return end.toISOString()
  }

  if (p.includes('quarterly')) {
    end.setMonth(end.getMonth() + 3)
    return end.toISOString()
  }

  if (p.includes('weekly')) {
    end.setDate(end.getDate() + 7)
    return end.toISOString()
  }

  if (p.includes('daily')) {
    end.setDate(end.getDate() + 1)
    return end.toISOString()
  }

  // Default subscription interval is 1 month
  end.setMonth(end.getMonth() + 1)
  return end.toISOString()
}

export type SubscriptionTiming = {
  startDate: string | null
  endDate: string | null
  isExpired: boolean
  isExpiringSoon: boolean
  daysRemaining: number | null
  label: string
}

export function getSubscriptionTiming(order: DigitalServiceOrder): SubscriptionTiming {
  if (!isDigitalSubscription(order) || isDigitalOrderPending(order)) {
    return {
      startDate: null,
      endDate: null,
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: null,
      label: 'Not started',
    }
  }

  const startDate = order.startDate || order.paidAt || order.createdAt || null
  const endDate =
    order.endDate ||
    (startDate
      ? computeSubscriptionEndDate(startDate, order.period, order.periodLabel)
      : null)

  if (!endDate) {
    return {
      startDate,
      endDate: null,
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: null,
      label: 'No end date',
    }
  }

  const endMs = new Date(endDate).getTime()
  if (Number.isNaN(endMs)) {
    return {
      startDate,
      endDate: null,
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: null,
      label: 'Invalid date',
    }
  }

  const now = Date.now()
  const diffMs = endMs - now
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const isExpired = diffMs <= 0
  const isExpiringSoon = !isExpired && days <= 3

  let label = ''
  if (isExpired) {
    const passedDays = Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24)))
    label = passedDays === 0 ? 'Expired today' : `Expired ${passedDays}d ago`
  } else if (days === 0) {
    label = 'Expires today'
  } else if (days === 1) {
    label = 'Expires tomorrow'
  } else {
    label = `${days} days left`
  }

  return {
    startDate,
    endDate,
    isExpired,
    isExpiringSoon,
    daysRemaining: days,
    label,
  }
}
