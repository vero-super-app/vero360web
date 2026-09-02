'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  driverStatusLabel,
  driverStatusTone,
  formatDateTime,
  type DriverStatus,
  type FleetDriver,
} from '@/lib/drivers'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardSearchField,
} from '@/app/dashboard/DashboardChrome'
import { panelAuthHeaders, adminFetch } from '@/lib/panel-client-auth'

const SECTION = DASHBOARD_SECTION_MAP['vero-ride']

type Tab = 'all' | DriverStatus | 'VEHICLE_PENDING'

type Counts = {
  all: number
  pending: number
  verified: number
  rejected: number
  suspended: number
  pendingVehicles: number
}

const EMPTY_COUNTS: Counts = {
  all: 0,
  pending: 0,
  verified: 0,
  rejected: 0,
  suspended: 0,
  pendingVehicles: 0,
}

export default function VeroRideDriversPage() {
  const [items, setItems] = useState<FleetDriver[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [tab, setTab] = useState<Tab>('PENDING_VERIFICATION')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch('/api/admin/drivers', {
        headers,
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load drivers')
      setItems(data.drivers || [])
      setCounts(data.counts || EMPTY_COUNTS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drivers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = items
    if (tab === 'VEHICLE_PENDING') {
      list = items.filter(d => d.taxis.some(t => t.status === 'PENDING_REVIEW'))
    } else if (tab !== 'all') {
      list = items.filter(d => d.status === tab)
    }
    if (!q) return list
    return list.filter(d => {
      const hay = `${d.name} ${d.email} ${d.phone} ${d.id}`
        .toLowerCase()
      return hay.includes(q)
    })
  }, [items, tab, query])

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'PENDING_VERIFICATION', label: 'Pending', count: counts.pending },
    { id: 'VEHICLE_PENDING', label: 'Vehicle review', count: counts.pendingVehicles },
    { id: 'VERIFIED', label: 'Verified', count: counts.verified },
    { id: 'REJECTED', label: 'Rejected', count: counts.rejected },
    { id: 'SUSPENDED', label: 'Suspended', count: counts.suspended },
    { id: 'all', label: 'All', count: counts.all },
  ]

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <DashboardBackLink />

      <DashboardPageHeader
        sectionId="vero-ride"
        title="Vero Ride, Drivers"
        description="Review driver identity and vehicle documents before they go online."
        actions={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Link
              href="/dashboard/vero-ride/trips"
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
              Trip monitor
            </Link>
            <DashboardRefreshButton onClick={load} disabled={loading} />
          </div>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {[
          { label: 'Pending drivers', value: counts.pending },
          { label: 'Vehicle review', value: counts.pendingVehicles },
          { label: 'Verified', value: counts.verified },
          { label: 'Rejected', value: counts.rejected },
        ].map(card => (
          <div
            key={card.label}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {tabs.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                background: active ? 'var(--primary-soft, #FFF7ED)' : 'var(--surface)',
                color: active ? 'var(--primary)' : 'var(--text)',
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {t.label} ({t.count})
            </button>
          )
        })}
      </div>

      <DashboardSearchField
        value={query}
        onChange={setQuery}
        placeholder="Search name, email, license, ID…"
        label="Search drivers"
        onClear={() => setQuery('')}
      />

      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: '#FEF2F2',
            color: '#B91C1C',
            border: '1px solid #FECACA',
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading drivers…</p>
      ) : filtered.length === 0 ? (
        <DashboardEmptyState
          icon={SECTION.icon}
          color={SECTION.color}
          title="No drivers in this view"
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(driver => {
            const tone = driverStatusTone(driver.status)
            const pendingVehicle = driver.taxis.some(
              t => t.status === 'PENDING_REVIEW',
            )
            return (
              <Link
                key={driver.id}
                href={`/dashboard/vero-ride/${driver.id}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '14px 16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {driver.name}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                      {driver.email || '—'} · {driver.phone || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      Submitted{' '}
                      {formatDateTime(driver.submittedAt || driver.createdAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {pendingVehicle ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          border: '1px solid #BFDBFE',
                        }}
                      >
                        Vehicle pending
                      </span>
                    ) : null}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: tone.bg,
                        color: tone.color,
                        border: `1px solid ${tone.border}`,
                      }}
                    >
                      {driverStatusLabel(driver.status)}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
