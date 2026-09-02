'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import Logo from '@/app/components/landing/Logo'
import { VeroIcon } from '@/app/components/landing/icons'
import { auth } from '@/lib/firebase'
import { DASHBOARD_NAV_GROUPS } from '@/lib/dashboard-sections'
import { AdminAlertsProvider, useAdminAlerts, useHelpCenterUnreadBadge } from './AdminAlertsProvider'
import { ConfirmDialogProvider } from './ConfirmDialog'
import {
  isSuperAdminOnlyPath,
  PanelSessionProvider,
  usePanelSession,
} from './PanelSessionProvider'

function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href === '/dashboard/vero-ride/trips') {
    return pathname === href || pathname.startsWith(`${href}/`)
  }
  if (href === '/dashboard/vero-ride') {
    if (pathname === '/dashboard/vero-ride') return true
    if (pathname.startsWith('/dashboard/vero-ride/trips')) return false
    return pathname.startsWith('/dashboard/vero-ride/')
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <PanelSessionProvider>
      <DashboardAuthGate>{children}</DashboardAuthGate>
    </PanelSessionProvider>
  )
}

function DashboardAuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isSuperAdmin, loading: sessionLoading, authenticated } = usePanelSession()

  useEffect(() => {
    if (sessionLoading) return
    if (!authenticated) {
      const next =
        pathname && pathname.startsWith('/dashboard')
          ? `?next=${encodeURIComponent(pathname)}`
          : ''
      router.replace(`/panel${next}`)
      return
    }
    if (isSuperAdminOnlyPath(pathname) && !isSuperAdmin) {
      router.replace('/dashboard')
    }
  }, [sessionLoading, isSuperAdmin, pathname, router, authenticated])

  if (sessionLoading || !authenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface)',
          padding: 24,
        }}
      >
        <p style={{ color: 'var(--text-3)', fontSize: 15, fontWeight: 600, margin: 0 }}>
          {sessionLoading ? 'Checking admin access…' : 'Redirecting to sign in…'}
        </p>
      </div>
    )
  }

  return (
    <AdminAlertsProvider>
      <ConfirmDialogProvider>
        <DashboardShellInner>{children}</DashboardShellInner>
      </ConfirmDialogProvider>
    </AdminAlertsProvider>
  )
}

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const unread = useHelpCenterUnreadBadge()
  const { isSuperAdmin } = usePanelSession()
  const {
    courier: { pending: courierPending, toast: courierToast, clearToast: clearCourierToast },
    drivers: { pending: driversPending, toast: driversToast, clearToast: clearDriversToast },
    rides: { issues: rideIssues, toast: ridesToast, clearToast: clearRidesToast },
    orders: { pending: ordersPending, toast: ordersToast, clearToast: clearOrdersToast },
    users: { newCount: newUsers, toast: usersToast, clearToast: clearUsersToast },
    merchantReports: {
      open: reportsOpen,
      toast: reportsToast,
      clearToast: clearReportsToast,
    },
    payments: {
      digitalNew,
      homepageAdNew,
      toast: paymentsToast,
      toastHref: paymentsToastHref,
      clearToast: clearPaymentsToast,
    },
  } = useAdminAlerts()

  const navGroups = useMemo(() => {
    return DASHBOARD_NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => !item.superAdminOnly || isSuperAdmin),
    })).filter(group => group.items.length > 0)
  }, [isSuperAdmin])

  useEffect(() => {
    if (!courierToast) return
    const timer = window.setTimeout(() => clearCourierToast(), 8000)
    return () => window.clearTimeout(timer)
  }, [courierToast, clearCourierToast])

  useEffect(() => {
    if (!driversToast) return
    const timer = window.setTimeout(() => clearDriversToast(), 8000)
    return () => window.clearTimeout(timer)
  }, [driversToast, clearDriversToast])

  useEffect(() => {
    if (!ridesToast) return
    const timer = window.setTimeout(() => clearRidesToast(), 8000)
    return () => window.clearTimeout(timer)
  }, [ridesToast, clearRidesToast])

  useEffect(() => {
    if (!ordersToast) return
    const timer = window.setTimeout(() => clearOrdersToast(), 8000)
    return () => window.clearTimeout(timer)
  }, [ordersToast, clearOrdersToast])

  useEffect(() => {
    if (!usersToast) return
    const timer = window.setTimeout(() => clearUsersToast(), 8000)
    return () => window.clearTimeout(timer)
  }, [usersToast, clearUsersToast])

  useEffect(() => {
    if (!reportsToast) return
    const timer = window.setTimeout(() => clearReportsToast(), 8000)
    return () => window.clearTimeout(timer)
  }, [reportsToast, clearReportsToast])

  useEffect(() => {
    if (!paymentsToast) return
    const timer = window.setTimeout(() => clearPaymentsToast(), 10000)
    return () => window.clearTimeout(timer)
  }, [paymentsToast, clearPaymentsToast])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut(auth)
    } catch {
      // Still send them to the sign-in page if Firebase sign-out fails.
    }
    router.push('/panel')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: '#fff',
          borderBottom: '1px solid var(--border)',
          padding: '0 20px',
        }}
      >
        <div
          style={{
            height: 68,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="dashboard-menu-btn"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              style={{
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: '#fff',
                color: 'var(--text)',
                fontSize: 18,
              }}
            >
              ☰
            </button>

            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Logo height={34} />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: isSuperAdmin ? '#6D28D9' : 'var(--primary)',
                  background: isSuperAdmin ? '#F5F3FF' : 'var(--primary-light)',
                  padding: '4px 10px',
                  borderRadius: 100,
                }}
              >
                {isSuperAdmin ? 'Super admin' : 'Admin'}
              </span>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)' }}>
              Website
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                background: 'var(--primary)',
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                cursor: signingOut ? 'wait' : 'pointer',
                opacity: signingOut ? 0.75 : 1,
              }}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 'calc(100vh - 68px)' }}>
        {open && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="dashboard-sidebar-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 45,
              background: 'rgba(17, 24, 39, 0.4)',
              border: 'none',
              cursor: 'pointer',
            }}
          />
        )}

        <aside
          className={`dashboard-sidebar${open ? ' is-open' : ''}`}
          style={{
            width: 260,
            flexShrink: 0,
            background: '#fff',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 'calc(100vh - 68px)',
            position: 'sticky',
            top: 68,
            alignSelf: 'flex-start',
          }}
        >
          <div
            className="dashboard-sidebar-mobile-head"
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 16px 8px',
              borderBottom: '1px solid var(--border)',
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
              Menu
            </span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: '#fff',
                fontSize: 18,
              }}
            >
              ×
            </button>
          </div>

          <nav
            aria-label="Admin navigation"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
              padding: '20px 12px 28px',
              overflowY: 'auto',
              flex: 1,
            }}
          >
            {navGroups.map(group => (
              <div key={group.title}>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-4)',
                    margin: '0 10px 8px',
                  }}
                >
                  {group.title}
                </p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
                  {group.items.map(item => {
                    const active = isActivePath(pathname, item.href)
                    const badgeCount =
                      item.badgeKey === 'help'
                        ? unread
                        : item.badgeKey === 'courier'
                          ? courierPending
                          : item.badgeKey === 'drivers'
                            ? driversPending
                            : item.badgeKey === 'rides'
                              ? rideIssues
                            : item.badgeKey === 'orders'
                              ? ordersPending
                              : item.badgeKey === 'users'
                                ? newUsers
                                : item.badgeKey === 'reports'
                                  ? reportsOpen
                                  : item.badgeKey === 'digital'
                                    ? digitalNew
                                    : item.badgeKey === 'homepageAds'
                                      ? homepageAdNew
                                      : 0
                    const badge =
                      badgeCount > 0 ? (badgeCount > 99 ? '99+' : String(badgeCount)) : null

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`dashboard-nav-link${active ? ' is-active' : ''}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '9px 12px',
                            borderRadius: 10,
                            fontSize: 14,
                            fontWeight: active ? 700 : 500,
                            color: active ? 'var(--primary-dark)' : 'var(--text-2)',
                            background: active ? 'var(--primary-50)' : 'transparent',
                            border: active
                              ? '1px solid var(--primary-light)'
                              : '1px solid transparent',
                            transition: 'background 0.15s ease, color 0.15s ease',
                          }}
                        >
                          <VeroIcon
                            name={item.icon}
                            size={20}
                            strokeWidth={2.35}
                            style={{ flexShrink: 0, opacity: active ? 1 : 0.9 }}
                          />
                          <span style={{ flex: 1 }}>{item.label}</span>
                          {badge && (
                            <span
                              style={{
                                minWidth: 22,
                                height: 22,
                                padding: '0 6px',
                                borderRadius: 100,
                                background: 'var(--primary)',
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: '28px 24px 64px',
          }}
        >
          <div style={{ maxWidth: 1100 }}>
            {courierToast && (
              <div
                role="status"
                style={{
                  marginBottom: 16,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#FFF7ED',
                  border: '1px solid #FED7AA',
                  color: '#9A3412',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  boxShadow: '0 8px 24px rgba(249,115,22,0.16)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <VeroIcon name="truck" size={20} strokeWidth={2.35} />
                  {courierToast}
                </span>
                <span style={{ display: 'inline-flex', gap: 8, flexShrink: 0 }}>
                  <Link
                    href="/dashboard/vero-courier"
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: 'var(--primary)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={clearCourierToast}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #FED7AA',
                      background: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#9A3412',
                    }}
                  >
                    Dismiss
                  </button>
                </span>
              </div>
            )}
            {driversToast && (
              <div
                role="status"
                style={{
                  marginBottom: 16,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#FFF7ED',
                  border: '1px solid #FED7AA',
                  color: '#9A3412',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  boxShadow: '0 8px 24px rgba(249,115,22,0.16)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <VeroIcon name="car" size={20} strokeWidth={2.35} />
                  {driversToast}
                </span>
                <span style={{ display: 'inline-flex', gap: 8, flexShrink: 0 }}>
                  <Link
                    href="/dashboard/vero-ride"
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: '#F97316',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Review
                  </Link>
                  <button
                    type="button"
                    onClick={clearDriversToast}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #FED7AA',
                      background: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#9A3412',
                    }}
                  >
                    Dismiss
                  </button>
                </span>
              </div>
            )}
            {ridesToast && (
              <div
                role="status"
                style={{
                  marginBottom: 16,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#FFF7ED',
                  border: '1px solid #FED7AA',
                  color: '#9A3412',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  boxShadow: '0 8px 24px rgba(249,115,22,0.16)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <VeroIcon name="car" size={20} strokeWidth={2.35} />
                  {ridesToast}
                </span>
                <span style={{ display: 'inline-flex', gap: 8, flexShrink: 0 }}>
                  <Link
                    href="/dashboard/vero-ride/trips"
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: '#F97316',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    View trips
                  </Link>
                  <button
                    type="button"
                    onClick={clearRidesToast}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #FED7AA',
                      background: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#9A3412',
                    }}
                  >
                    Dismiss
                  </button>
                </span>
              </div>
            )}
            {ordersToast && (
              <div
                role="status"
                style={{
                  marginBottom: 16,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#F0F9FF',
                  border: '1px solid #BAE6FD',
                  color: '#075985',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  boxShadow: '0 8px 24px rgba(3,105,161,0.12)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <VeroIcon name="package" size={20} strokeWidth={2.35} />
                  {ordersToast}
                </span>
                <span style={{ display: 'inline-flex', gap: 8, flexShrink: 0 }}>
                  <Link
                    href="/dashboard/orders"
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: '#0369A1',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={clearOrdersToast}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #BAE6FD',
                      background: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#075985',
                    }}
                  >
                    Dismiss
                  </button>
                </span>
              </div>
            )}
            {usersToast && (
              <div
                role="status"
                style={{
                  marginBottom: 16,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#1E40AF',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  boxShadow: '0 8px 24px rgba(37,99,235,0.12)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <VeroIcon name="users" size={20} strokeWidth={2.35} />
                  {usersToast}
                </span>
                <span style={{ display: 'inline-flex', gap: 8, flexShrink: 0 }}>
                  <Link
                    href="/dashboard/users"
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: '#2563EB',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={clearUsersToast}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #BFDBFE',
                      background: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#1E40AF',
                    }}
                  >
                    Dismiss
                  </button>
                </span>
              </div>
            )}
            {reportsToast && (
              <div
                role="status"
                style={{
                  marginBottom: 16,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#FFF7ED',
                  border: '1px solid #FED7AA',
                  color: '#9A3412',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  boxShadow: '0 8px 24px rgba(249,115,22,0.12)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <VeroIcon name="flag" size={20} strokeWidth={2.35} />
                  {reportsToast}
                </span>
                <span style={{ display: 'inline-flex', gap: 8, flexShrink: 0 }}>
                  <Link
                    href="/dashboard/merchant-reports"
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: '#C2410C',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={clearReportsToast}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #FED7AA',
                      background: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#9A3412',
                    }}
                  >
                    Dismiss
                  </button>
                </span>
              </div>
            )}
            {paymentsToast && (
              <div
                role="status"
                style={{
                  marginBottom: 16,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  color: '#166534',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  boxShadow: '0 8px 24px rgba(22,163,74,0.12)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <VeroIcon
                    name={
                      paymentsToastHref?.includes('homepage') ? 'megaphone' : 'sparkles'
                    }
                    size={20}
                    strokeWidth={2.35}
                  />
                  {paymentsToast}
                </span>
                <span style={{ display: 'inline-flex', gap: 8, flexShrink: 0 }}>
                  <Link
                    href={paymentsToastHref || '/dashboard/digital-services'}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: '#15803D',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={clearPaymentsToast}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #BBF7D0',
                      background: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#166534',
                    }}
                  >
                    Dismiss
                  </button>
                </span>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      <style>{`
        .dashboard-nav-link:hover {
          background: var(--surface) !important;
        }
        .dashboard-nav-link.is-active:hover {
          background: var(--primary-50) !important;
        }
        @media (max-width: 900px) {
          .dashboard-menu-btn {
            display: inline-flex !important;
          }
          .dashboard-sidebar {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            z-index: 50;
            min-height: 100vh !important;
            transform: translateX(-105%);
            transition: transform 0.2s ease;
            box-shadow: var(--shadow-lg);
          }
          .dashboard-sidebar.is-open {
            transform: translateX(0);
          }
          .dashboard-sidebar-mobile-head {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  )
}
