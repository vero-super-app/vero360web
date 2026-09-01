'use client'

import Link from 'next/link'
import { VeroIcon } from '@/app/components/landing/icons'
import { DASHBOARD_SECTIONS } from '@/lib/dashboard-sections'
import {
  useCourierPendingBadge,
  useDigitalPaymentsNewBadge,
  useDriverPendingBadge,
  useHelpCenterUnreadBadge,
  useHomepageAdPaymentsNewBadge,
  useMerchantReportsOpenBadge,
  useNewUsersBadge,
  useOrdersPendingBadge,
} from './AdminAlertsProvider'
import { usePanelSession } from './PanelSessionProvider'

export default function DashboardCards() {
  const unread = useHelpCenterUnreadBadge()
  const courierPending = useCourierPendingBadge()
  const driversPending = useDriverPendingBadge()
  const ordersPending = useOrdersPendingBadge()
  const newUsers = useNewUsersBadge()
  const reportsOpen = useMerchantReportsOpenBadge()
  const digitalNew = useDigitalPaymentsNewBadge()
  const homepageAdNew = useHomepageAdPaymentsNewBadge()
  const { isSuperAdmin } = usePanelSession()

  return (
    <div
      className="dashboard-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 18,
      }}
    >
      {DASHBOARD_SECTIONS.filter(card => !card.superAdminOnly || isSuperAdmin).map(card => {
        const isHelp = card.id === 'verochat'
        const isCourier = card.id === 'vero-courier'
        const isDrivers = card.id === 'vero-ride'
        const isOrders = card.id === 'orders'
        const isUsers = card.id === 'users'
        const isReports = card.id === 'merchant-reports'
        const isDigital = card.id === 'digital-services'
        const isHomepageAds = card.id === 'homepage-ads'
        const badgeCount = isHelp
          ? unread
          : isCourier
            ? courierPending
            : isDrivers
              ? driversPending
              : isOrders
                ? ordersPending
                : isUsers
                  ? newUsers
                  : isReports
                    ? reportsOpen
                    : isDigital
                      ? digitalNew
                      : isHomepageAds
                        ? homepageAdNew
                        : 0
        const showBadge = badgeCount > 0
        const alertLabel = isHelp
          ? `${badgeCount} unread Help Center messages`
          : isCourier
            ? `${badgeCount} pending Vero Courier order${badgeCount === 1 ? '' : 's'}`
            : isDrivers
              ? `${badgeCount} driver verification item${badgeCount === 1 ? '' : 's'}`
              : isOrders
                ? `${badgeCount} pending marketplace order${badgeCount === 1 ? '' : 's'}`
                : isUsers
                  ? `${badgeCount} new user${badgeCount === 1 ? '' : 's'}`
                  : isReports
                    ? `${badgeCount} open merchant report${badgeCount === 1 ? '' : 's'}`
                    : isDigital
                      ? `${badgeCount} new digital service payment${badgeCount === 1 ? '' : 's'}`
                      : isHomepageAds
                        ? `${badgeCount} new homepage ad payment${badgeCount === 1 ? '' : 's'}`
                        : ''
        const alertDesc = isHelp
          ? `${badgeCount} new message${badgeCount === 1 ? '' : 's'} waiting`
          : isCourier
            ? `${badgeCount} new order${badgeCount === 1 ? '' : 's'} waiting`
            : isDrivers
              ? `${badgeCount} document${badgeCount === 1 ? '' : 's'} to review`
              : isOrders
                ? `${badgeCount} order${badgeCount === 1 ? '' : 's'} needing review`
                : isUsers
                  ? `${badgeCount} new registration${badgeCount === 1 ? '' : 's'}`
                  : isReports
                    ? `${badgeCount} report${badgeCount === 1 ? '' : 's'} to review`
                    : isDigital
                      ? `${badgeCount} payment${badgeCount === 1 ? '' : 's'} just completed`
                      : isHomepageAds
                        ? `${badgeCount} advert payment${badgeCount === 1 ? '' : 's'} just completed`
                        : ''
        const alertCta = isHelp
          ? 'Reply now →'
          : isCourier
            ? 'Review now →'
            : isDrivers
              ? 'Review drivers →'
              : isOrders
                ? 'Open orders →'
                : isUsers
                  ? 'View users →'
                  : isReports
                    ? 'Review reports →'
                    : isDigital
                      ? 'Open digital services →'
                      : isHomepageAds
                        ? 'Open homepage ads →'
                        : ''

        return (
          <Link
            key={card.id}
            href={`/dashboard/${card.id}`}
            className={`dashboard-card${showBadge ? ' dashboard-card-alert' : ''}`}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              padding: 22,
              borderRadius: 18,
              background: '#fff',
              border: showBadge ? '1.5px solid var(--primary)' : '1px solid var(--border)',
              boxShadow: showBadge ? '0 8px 28px rgba(249,115,22,0.18)' : 'var(--shadow-sm)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
              minHeight: 168,
            }}
          >
            {showBadge && (
              <span
                aria-label={alertLabel}
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  minWidth: 24,
                  height: 24,
                  padding: '0 7px',
                  borderRadius: 100,
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 0 3px rgba(249,115,22,0.2)',
                }}
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}

            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 15,
                background: card.bg,
                color: card.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <VeroIcon name={card.icon} size={26} color={card.color} strokeWidth={2.35} />
              {showBadge && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#EF4444',
                    border: '2px solid #fff',
                  }}
                />
              )}
            </div>
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  marginBottom: 6,
                  fontFamily: 'var(--font-display)',
                }}
              >
                {card.title}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5, margin: 0 }}>
                {showBadge ? alertDesc : card.desc}
              </p>
            </div>
            <span
              style={{
                marginTop: 'auto',
                fontSize: 13,
                fontWeight: 600,
                color: card.color,
              }}
            >
              {showBadge ? alertCta : 'Open →'}
            </span>
          </Link>
        )
      })}

      <style>{`
        .dashboard-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow);
          border-color: var(--border-2);
        }
        .dashboard-card-alert {
          animation: helpPulse 1.8s ease-in-out infinite;
        }
        @keyframes helpPulse {
          0%, 100% { box-shadow: 0 8px 28px rgba(249,115,22,0.18); }
          50% { box-shadow: 0 10px 36px rgba(249,115,22,0.32); }
        }
      `}</style>
    </div>
  )
}
