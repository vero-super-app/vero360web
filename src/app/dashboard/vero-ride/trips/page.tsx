'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminFetch } from '@/lib/panel-client-auth'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardSearchField,
} from '@/app/dashboard/DashboardChrome'
import {
  formatDateTime,
  formatRideDistanceKm,
  formatRideFareMwk,
  paymentStatusTone,
  ridePartySummary,
  rideRouteSummary,
  rideStatusLabel,
  rideStatusTone,
  type AdminRide,
  type AdminRideCounts,
} from '@/lib/rides'

const SECTION = DASHBOARD_SECTION_MAP['vero-ride']

type Tab =
  | 'ISSUES'
  | 'ACTIVE'
  | 'REQUESTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'all'

const EMPTY_COUNTS: AdminRideCounts = {
  all: 0,
  active: 0,
  requested: 0,
  inProgress: 0,
  completed: 0,
  cancelled: 0,
  unpaidCompleted: 0,
  issues: 0,
}

export default function VeroRideTripsPage() {
  const [items, setItems] = useState<AdminRide[]>([])
  const [counts, setCounts] = useState<AdminRideCounts>(EMPTY_COUNTS)
  const [tab, setTab] = useState<Tab>('ISSUES')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/rides?take=500', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load rides')
      setItems(data.items || [])
      setCounts(data.counts || EMPTY_COUNTS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rides')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    let byTab = items
    if (tab === 'ISSUES') {
      byTab = items.filter(item => item.needsAttention)
    } else if (tab === 'ACTIVE') {
      byTab = items.filter(item =>
        ['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(item.status),
      )
    } else if (tab === 'IN_PROGRESS') {
      byTab = items.filter(item =>
        ['ACCEPTED', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(item.status),
      )
    } else if (tab !== 'all') {
      byTab = items.filter(item => item.status === tab)
    }

    if (!q) return byTab

    return byTab.filter(item => {
      const hay = [
        String(item.id),
        item.passengerName,
        item.passengerPhone,
        item.passengerEmail,
        item.driverName,
        item.driverPhone,
        item.taxiPlate,
        item.pickupAddress,
        item.dropoffAddress,
        item.status,
        item.paymentStatus,
        item.cancellationReason,
        ...item.attentionReasons,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [items, tab, query])

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'ISSUES', label: 'Needs attention', count: counts.issues },
    { id: 'ACTIVE', label: 'Active', count: counts.active },
    { id: 'REQUESTED', label: 'Requested', count: counts.requested },
    { id: 'IN_PROGRESS', label: 'En route', count: counts.inProgress },
    { id: 'COMPLETED', label: 'Completed', count: counts.completed },
    { id: 'CANCELLED', label: 'Cancelled', count: counts.cancelled },
    { id: 'all', label: 'All', count: counts.all },
  ]

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="vero-ride"
        title="Vero Ride Trips"
        description="Monitor live trips, payment issues, and ride details. Cancel stuck rides or resolve unpaid fares."
        actions={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Link
              href="/dashboard/vero-ride"
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: '#fff',
                color: 'var(--text-2)',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Driver fleet
            </Link>
            <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
          </div>
        }
      />

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#FEF2F2',
            color: '#991B1B',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          { label: 'Active trips', value: counts.active, tone: '#C2410C' },
          { label: 'Needs attention', value: counts.issues, tone: '#B45309' },
          { label: 'Unpaid completed', value: counts.unpaidCompleted, tone: '#B91C1C' },
          { label: 'All trips', value: counts.all, tone: '#374151' },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: '#fff',
            }}
          >
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
              {stat.label}
            </p>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 24,
                fontWeight: 800,
                color: stat.tone,
                fontFamily: 'var(--font-display)',
              }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <DashboardSearchField
        value={query}
        onChange={value => {
          setQuery(value)
          if (value.trim()) setTab('all')
        }}
        placeholder="Search trip ID, passenger, driver, plate, address…"
        label="Search trips"
        onClear={() => setQuery('')}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {tabs.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 12px',
                borderRadius: 100,
                border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: active ? 'var(--primary-50)' : '#fff',
                color: active ? 'var(--primary-dark)' : 'var(--text-2)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {t.label} ({t.count})
            </button>
          )
        })}
      </div>

      <section
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 22,
          boxShadow: 'var(--shadow-sm)',
          minHeight: 420,
        }}
      >
        {loading ? (
          <p style={{ color: 'var(--text-3)' }}>Loading ride trips…</p>
        ) : filtered.length === 0 ? (
          <DashboardEmptyState
            icon={SECTION.icon}
            color={SECTION.color}
            title={
              query.trim()
                ? `No trips found for “${query.trim()}”`
                : tab === 'ISSUES'
                  ? 'No trips need attention'
                  : 'No trips in this view'
            }
            hint={
              query.trim()
                ? 'Try a different trip ID, phone number, or address.'
                : tab === 'ISSUES'
                  ? 'Unpaid completed rides and long-running active trips appear here.'
                  : undefined
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(item => {
              const statusTone = rideStatusTone(item.status)
              const payTone = paymentStatusTone(item.paymentStatus)
              const highlight = item.needsAttention

              return (
                <article
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 16,
                    padding: 16,
                    borderRadius: 14,
                    border: highlight ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    background: highlight ? 'var(--primary-50)' : 'var(--surface)',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                        Trip #{item.id}
                      </h3>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 100,
                          background: statusTone.bg,
                          color: statusTone.color,
                          border: `1px solid ${statusTone.border}`,
                        }}
                      >
                        {rideStatusLabel(item.status)}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 100,
                          background: payTone.bg,
                          color: payTone.color,
                          border: `1px solid ${payTone.border}`,
                        }}
                      >
                        {item.paymentStatus.toLowerCase() === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                      {item.needsAttention && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 100,
                            background: '#FEF2F2',
                            color: '#B91C1C',
                            border: '1px solid #FECACA',
                          }}
                        >
                          Issue
                        </span>
                      )}
                    </div>

                    <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-2)' }}>
                      {rideRouteSummary(item)}
                    </p>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-3)' }}>
                      {ridePartySummary(item)}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 12,
                        fontSize: 13,
                        color: 'var(--text-3)',
                      }}
                    >
                      <span>
                        Fare:{' '}
                        <strong style={{ color: 'var(--text-2)' }}>
                          {formatRideFareMwk(item.actualFare ?? item.estimatedFare)}
                        </strong>
                      </span>
                      <span>
                        Distance:{' '}
                        <strong style={{ color: 'var(--text-2)' }}>
                          {formatRideDistanceKm(item.actualDistance ?? item.estimatedDistance)}
                        </strong>
                      </span>
                      <span>
                        Class:{' '}
                        <strong style={{ color: 'var(--text-2)' }}>
                          {item.preferredVehicleClass}
                        </strong>
                      </span>
                      {item.taxiPlate && (
                        <span>
                          Plate:{' '}
                          <strong style={{ color: 'var(--text-2)' }}>{item.taxiPlate}</strong>
                        </span>
                      )}
                    </div>

                    {item.attentionReasons.length > 0 && (
                      <p
                        style={{
                          margin: '10px 0 0',
                          fontSize: 13,
                          color: '#B45309',
                          fontWeight: 600,
                        }}
                      >
                        {item.attentionReasons.join(' · ')}
                      </p>
                    )}

                    <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-4)' }}>
                      Created {formatDateTime(item.createdAt)}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <Link
                      href={`/dashboard/vero-ride/trips/${item.id}`}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1px solid #BFDBFE',
                        background: '#EFF6FF',
                        color: '#1D4ED8',
                        fontSize: 13,
                        fontWeight: 700,
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      View details
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
