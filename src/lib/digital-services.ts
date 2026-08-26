/** Digital Services orders (subscriptions + gift cards) — Firestore `digital_service_orders`. */

export const DIGITAL_SERVICE_ORDERS_COLLECTION = 'digital_service_orders'

export type DigitalOrderKind = 'subscription' | 'gift_card' | string
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
  buyerUid: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  paidAt: string | null
  createdAt: string | null
  updatedAt: string | null
  platformFeeCredited: boolean
  platformFeeTxId: string | null
}

export type DigitalServiceOrderCounts = {
  all: number
  paid: number
  pending: number
  subscriptions: number
  giftCards: number
  feeCredited: number
  feePending: number
  revenuePaid: number
  revenueCredited: number
}
