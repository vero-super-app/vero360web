'use client'

import { createContext, useContext } from 'react'
import { useCourierAlerts, type CourierAlertState } from '@/lib/courier-alerts'
import { useHelpCenterUnread } from '@/lib/help-center-alerts'
import { useMerchantReportAlerts, type MerchantReportAlertState } from '@/lib/merchant-report-alerts'
import { useOrderAlerts, type OrderAlertState } from '@/lib/order-alerts'
import { usePaymentAlerts, type PaymentAlertState } from '@/lib/payment-alerts'
import { useUserAlerts, type UserAlertState } from '@/lib/user-alerts'

type AdminAlertsContextValue = {
  courier: CourierAlertState
  orders: OrderAlertState
  users: UserAlertState
  merchantReports: MerchantReportAlertState
  payments: PaymentAlertState
  helpUnread: number
}

const AdminAlertsContext = createContext<AdminAlertsContextValue | null>(null)

export function AdminAlertsProvider({ children }: { children: React.ReactNode }) {
  const courier = useCourierAlerts()
  const orders = useOrderAlerts()
  const users = useUserAlerts()
  const merchantReports = useMerchantReportAlerts()
  const payments = usePaymentAlerts()
  const helpUnread = useHelpCenterUnread()
  return (
    <AdminAlertsContext.Provider
      value={{ courier, orders, users, merchantReports, payments, helpUnread }}
    >
      {children}
    </AdminAlertsContext.Provider>
  )
}

export function useAdminAlerts() {
  const ctx = useContext(AdminAlertsContext)
  if (!ctx) {
    throw new Error('useAdminAlerts must be used within AdminAlertsProvider')
  }
  return ctx
}

/** Safe for optional use outside provider (returns zeros). */
export function useCourierPendingBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.courier.pending ?? 0
}

export function useOrdersPendingBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.orders.pending ?? 0
}

export function useNewUsersBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.users.newCount ?? 0
}

export function useMerchantReportsOpenBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.merchantReports.open ?? 0
}

export function useHelpCenterUnreadBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.helpUnread ?? 0
}

export function useDigitalPaymentsNewBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.payments.digitalNew ?? 0
}

export function useHomepageAdPaymentsNewBadge() {
  const ctx = useContext(AdminAlertsContext)
  return ctx?.payments.homepageAdNew ?? 0
}
