'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  ORDER_STATUSES,
  courierLabel,
  courierTrackingUrl,
  formatDateTime,
  formatMwk,
  partyContactLine,
  paymentTone,
  resolveOrderImage,
  statusLabel,
  statusTone,
  type MarketplaceOrder,
  type OrderStatus,
} from '@/lib/orders'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardSearchField,
  DashboardThumbFallback,
} from '@/app/dashboard/DashboardChrome'
import { useConfirm, useConfirmDelete } from '../ConfirmDialog'

const SECTION = DASHBOARD_SECTION_MAP.orders

type Tab = 'all' | OrderStatus

type Counts = {
  all: number
  pending: number
  confirmed: number
  delivered: number
  cancelled: number
}

const EMPTY_COUNTS: Counts = {
  all: 0,
  pending: 0,
  confirmed: 0,
  delivered: 0,
  cancelled: 0,
}

export default function OrdersAdminPage() {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()
  const [items, setItems] = useState<MarketplaceOrder[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [proofPreview, setProofPreview] = useState<{
    url: string
    orderNumber: string
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/orders', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load orders')
      setItems(data.items || [])
      setCounts(data.counts || EMPTY_COUNTS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      if (tab !== 'all' && item.status !== tab) return false
      if (!q) return true
      return (
        item.orderNumber.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        (item.customerName || '').toLowerCase().includes(q) ||
        (item.merchantName || '').toLowerCase().includes(q) ||
        (item.customerEmail || '').toLowerCase().includes(q) ||
        (item.merchantEmail || '').toLowerCase().includes(q) ||
        (item.customerPhone || '').toLowerCase().includes(q) ||
        (item.merchantPhone || '').toLowerCase().includes(q) ||
        (item.courierMethod || '').toLowerCase().includes(q) ||
        courierLabel(item.courierMethod).toLowerCase().includes(q) ||
        (item.tracking || '').toLowerCase().includes(q)
      )
    })
  }, [items, tab, query])

  const setStatus = async (id: number, status: OrderStatus) => {
    const item = items.find(o => o.id === id)
    if (
      !(await confirm({
        title: 'Change order status?',
        message: `Mark order #${id}${item?.orderNumber ? ` (${item.orderNumber})` : ''} as “${statusLabel(status)}”?`,
        confirmLabel: 'Yes',
        cancelLabel: 'No',
        danger: status === 'cancelled',
      }))
    ) {
      return
    }

    setBusyId(id)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Status update failed')
      setNotice(`Order #${id} marked ${statusLabel(status)}`)
      setTab(status)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed')
    } finally {
      setBusyId(null)
    }
  }

  const removeOrder = async (item: MarketplaceOrder) => {
    if (
      !(await confirmDelete(
        item.orderNumber || `#${item.id}`,
        'Permanently delete this marketplace order? This cannot be undone.',
      ))
    ) {
      return
    }

    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/orders/${item.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice(`Deleted order ${item.orderNumber || `#${item.id}`}`)
      setItems(prev => prev.filter(o => o.id !== item.id))
      setCounts(prev => {
        const next = { ...prev }
        next.all = Math.max(0, next.all - 1)
        if (item.status in next) {
          const key = item.status as keyof Counts
          next[key] = Math.max(0, (next[key] as number) - 1)
        }
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'confirmed', label: 'Confirmed', count: counts.confirmed },
    { id: 'delivered', label: 'Delivered', count: counts.delivered },
    { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
  ]

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="orders"
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />

      {(error || notice) && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: error ? '#FEF2F2' : '#ECFDF5',
            color: error ? '#991B1B' : '#166534',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {error || notice}
        </div>
      )}

      <DashboardSearchField
        value={query}
        onChange={value => {
          setQuery(value)
          if (value.trim()) setTab('all')
        }}
        placeholder="Search order number, item, buyer, seller…"
        label="Search orders"
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
          <p style={{ color: 'var(--text-3)' }}>Loading orders…</p>
        ) : filtered.length === 0 ? (
          <DashboardEmptyState
            icon={SECTION.icon}
            color={SECTION.color}
            title={query.trim() ? `No orders found for “${query.trim()}”` : 'No marketplace orders yet'}
            hint={query.trim() ? 'Try a different search term.' : undefined}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(item => {
              const img = resolveOrderImage(item.itemImage)
              const tone = statusTone(item.status)
              const pay = paymentTone(item.paymentStatus)
              const busy = busyId === item.id
              return (
                <article
                  key={item.id}
                  className="order-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '88px 1fr auto',
                    gap: 14,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    alignItems: 'start',
                  }}
                >
                  <div
                    style={{
                      width: 88,
                      height: 72,
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: '#fff',
                      border: '1px solid var(--border)',
                      position: 'relative',
                    }}
                  >
                    {img ? (
                      <Image src={img} alt="" fill unoptimized style={{ objectFit: 'cover' }} />
                    ) : (
                      <DashboardThumbFallback
                        icon={SECTION.icon}
                        color={SECTION.color}
                        bg={SECTION.bg}
                      />
                    )}
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{item.itemName}</h3>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 100,
                          background: tone.bg,
                          color: tone.color,
                          border: `1px solid ${tone.border}`,
                        }}
                      >
                        {statusLabel(item.status)}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 100,
                          background: pay.bg,
                          color: pay.color,
                          border: `1px solid ${pay.border}`,
                        }}
                      >
                        {item.paymentStatus}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
                      {item.orderNumber} · {formatMwk(item.price)} × {item.quantity} ={' '}
                      {formatMwk(item.total)}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 8,
                      }}
                    >
                      <Meta
                        label="Buyer"
                        value={item.customerName || '—'}
                        sub={
                          partyContactLine(item.customerPhone, item.customerEmail) ||
                          'No phone or email'
                        }
                      />
                      <Meta
                        label="Seller"
                        value={item.merchantName || '—'}
                        sub={
                          partyContactLine(item.merchantPhone, item.merchantEmail) ||
                          'No phone or email'
                        }
                      />
                      <Meta
                        label="Delivery"
                        value={
                          [item.addressCity, item.addressDescription].filter(Boolean).join(' · ') ||
                          '—'
                        }
                      />
                      <Meta
                        label="Courier"
                        value={courierLabel(item.courierMethod)}
                        sub={item.tracking ? `Tracking: ${item.tracking}` : undefined}
                      />
                      <Meta label="Ordered" value={formatDateTime(item.orderDate)} />
                    </div>

                    {(item.proofUrl || courierTrackingUrl(item.courierMethod)) && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          marginTop: 10,
                        }}
                      >
                        {item.proofUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setProofPreview({
                                url: item.proofUrl!,
                                orderNumber: item.orderNumber,
                              })
                            }
                            style={{
                              padding: '7px 12px',
                              borderRadius: 10,
                              border: '1px solid #BAE6FD',
                              background: '#F0F9FF',
                              color: '#0369A1',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            View delivery proof
                          </button>
                        )}
                        {courierTrackingUrl(item.courierMethod) && (
                          <a
                            href={courierTrackingUrl(item.courierMethod)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '7px 12px',
                              borderRadius: 10,
                              border: '1px solid var(--border)',
                              background: '#fff',
                              color: 'var(--text-2)',
                              fontSize: 12,
                              fontWeight: 700,
                              textDecoration: 'none',
                            }}
                          >
                            Track {courierLabel(item.courierMethod)}
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      minWidth: 140,
                    }}
                  >
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-4)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Status
                    </label>
                    <select
                      value={item.status}
                      disabled={busy}
                      onChange={e => void setStatus(item.id, e.target.value as OrderStatus)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: '#fff',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-2)',
                      }}
                    >
                      {ORDER_STATUSES.map(status => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeOrder(item)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: '1px solid #FECACA',
                        background: busy ? '#FEE2E2' : '#FEF2F2',
                        color: '#B91C1C',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: busy ? 'wait' : 'pointer',
                        opacity: busy ? 0.7 : 1,
                      }}
                    >
                      {busy ? 'Removing…' : 'Delete'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <style>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        @media (max-width: 760px) {
          .order-row { grid-template-columns: 72px 1fr !important; }
          .order-row > div:last-child { grid-column: 1 / -1; }
        }
      `}</style>

      {proofPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Delivery proof"
          onClick={() => setProofPreview(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(17, 24, 39, 0.72)',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(920px, 100%)',
              maxHeight: '90vh',
              background: '#fff',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Delivery proof</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {proofPreview.orderNumber}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={proofPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '7px 12px',
                    borderRadius: 10,
                    background: '#0369A1',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Open full size
                </a>
                <button
                  type="button"
                  onClick={() => setProofPreview(null)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: 16,
                background: '#111827',
                display: 'grid',
                placeItems: 'center',
                minHeight: 280,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proofPreview.url}
                alt={`Delivery proof for ${proofPreview.orderNumber}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  borderRadius: 8,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Meta({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 10,
        background: '#fff',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-4)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div> : null}
    </div>
  )
}
