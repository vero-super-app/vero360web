'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  adminActionsFor,
  formatCourierEstimateMwk,
  formatDateTime,
  statusLabel,
  statusTone,
  type CourierDelivery,
  type CourierStatus,
} from '@/lib/courier'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardSearchField,
} from '@/app/dashboard/DashboardChrome'
import { useConfirm } from '../ConfirmDialog'

const SECTION = DASHBOARD_SECTION_MAP['vero-courier']

type Tab = 'all' | 'PENDING' | 'ACCEPTED' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED'

type Counts = {
  all: number
  pending: number
  accepted: number
  onTheWay: number
  delivered: number
  cancelled: number
}

const EMPTY_COUNTS: Counts = {
  all: 0,
  pending: 0,
  accepted: 0,
  onTheWay: 0,
  delivered: 0,
  cancelled: 0,
}

const ACTION_STYLES: Record<
  'accept' | 'coming' | 'deliver' | 'reject',
  { bg: string; color: string; border: string }
> = {
  accept: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  coming: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  deliver: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  reject: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
}

export default function VeroCourierAdminPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState<CourierDelivery[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [tab, setTab] = useState<Tab>('PENDING')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [cancelTarget, setCancelTarget] = useState<{
    id: number
    label: string
  } | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/courier', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load courier deliveries')
      setItems(data.items || [])
      setCounts(data.counts || EMPTY_COUNTS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courier deliveries')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byTab = tab === 'all' ? items : items.filter(item => item.status === tab)
    if (!q) return byTab

    return byTab.filter(item => {
      const tracking = item.trackingNumber.toLowerCase()
      const id = String(item.id)
      const hay = [
        tracking,
        id,
        item.phone,
        item.email,
        item.pickupLocation,
        item.dropoffLocation,
        item.senderName,
        item.recipientName,
        item.typeOfGoods,
        item.estimateSummary,
        item.estimatedPriceMwk != null ? String(item.estimatedPriceMwk) : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return (
        hay.includes(q) ||
        tracking.replace(/^vc/, '').includes(q.replace(/^vc/, ''))
      )
    })
  }, [items, tab, query])

  const setStatus = async (
    id: number,
    status: CourierStatus,
    label: string,
    cancelReasonText?: string,
  ) => {
    if (status === 'CANCELLED') {
      if (!cancelReasonText?.trim()) {
        setCancelTarget({ id, label })
        setCancelReason('')
        return
      }
    } else {
      if (
        !(await confirm({
          title: 'Confirm action?',
          message: `${label} for delivery #${id}?\n\nThe sender will get a push notification.`,
          confirmLabel: 'Yes',
          cancelLabel: 'No',
          danger: false,
        }))
      ) {
        return
      }
    }

    setError('')
    setNotice('')
    setBusyId(id)
    try {
      const payload: Record<string, string> = { status }
      if (status === 'CANCELLED' && cancelReasonText?.trim()) {
        payload.cancelReason = cancelReasonText.trim()
      }
      const res = await adminFetch(`/api/admin/courier/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Status update failed')
      const pushNote = data.notified
        ? ` Push sent${typeof data.fcmSent === 'number' && data.fcmSent > 0 ? ` (FCM ${data.fcmSent})` : ' (in-app alert)'}.`
        : data.notifyError
          ? ` Status saved, but push failed: ${data.notifyError}`
          : ' Status saved (no sender uid for push).'
      setNotice(`Delivery #${id} marked ${label}.${pushNote}`)
      setCancelTarget(null)
      setCancelReason('')
      if (status === 'ACCEPTED') setTab('ACCEPTED')
      else if (status === 'ON_THE_WAY') setTab('ON_THE_WAY')
      else if (status === 'DELIVERED') setTab('DELIVERED')
      else if (status === 'CANCELLED') setTab('CANCELLED')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed')
    } finally {
      setBusyId(null)
    }
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'PENDING', label: 'Needs action', count: counts.pending },
    { id: 'ACCEPTED', label: 'Accepted', count: counts.accepted },
    { id: 'ON_THE_WAY', label: 'Coming', count: counts.onTheWay },
    { id: 'DELIVERED', label: 'Delivered', count: counts.delivered },
    { id: 'CANCELLED', label: 'Rejected', count: counts.cancelled },
    { id: 'all', label: 'All', count: counts.all },
  ]

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="vero-courier"
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
        placeholder="Search courier / tracking number…"
        label="Search courier number"
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
          <p style={{ color: 'var(--text-3)' }}>Loading courier deliveries…</p>
        ) : filtered.length === 0 ? (
          <DashboardEmptyState
            icon={SECTION.icon}
            color={SECTION.color}
            title={
              query.trim()
                ? `No courier found for “${query.trim()}”`
                : tab === 'PENDING'
                  ? 'No pending courier requests'
                  : 'No courier deliveries in this view'
            }
            hint={
              query.trim()
                ? 'Try a different tracking number.'
                : tab === 'PENDING'
                  ? 'New requests will appear here for Accept / Reject.'
                  : undefined
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(item => {
              const tone = statusTone(item.status)
              const busy = busyId === item.id
              const actions = adminActionsFor(item.status)

              return (
                <article
                  key={item.id}
                  className="courier-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 16,
                    padding: 16,
                    borderRadius: 14,
                    border:
                      item.status === 'PENDING'
                        ? '1.5px solid var(--primary)'
                        : '1px solid var(--border)',
                    background: item.status === 'PENDING' ? 'var(--primary-50)' : 'var(--surface)',
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
                        #{item.id}
                        {item.trackingNumber ? ` · ${item.trackingNumber}` : ''}
                      </h3>
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
                      {item.estimatedPriceMwk != null && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            padding: '4px 10px',
                            borderRadius: 100,
                            background: '#ECFDF5',
                            color: '#047857',
                            border: '1px solid #A7F3D0',
                          }}
                          title={item.estimateSummary || 'App price estimate'}
                        >
                          Est. {formatCourierEstimateMwk(item.estimatedPriceMwk)}
                          {item.estimatedDistanceKm != null
                            ? ` · ${item.estimatedDistanceKm.toFixed(1)} km`
                            : ''}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <Meta
                        label="App estimate"
                        value={
                          formatCourierEstimateMwk(item.estimatedPriceMwk) ||
                          'Not provided'
                        }
                        sub={
                          item.estimatedDistanceKm != null
                            ? `${item.estimatedDistanceKm.toFixed(1)} km route · from app quote`
                            : item.estimateSummary ||
                              'Older bookings may not include a quote'
                        }
                        emphasize={item.estimatedPriceMwk != null}
                      />
                      <Meta
                        label="Sender"
                        value={item.senderName || item.phone || '—'}
                        sub={item.email || item.phone}
                      />
                      <Meta label="City" value={item.city || '—'} />
                      <Meta label="Pickup" value={item.pickupLocation || '—'} />
                      <Meta label="Drop-off" value={item.dropoffLocation || '—'} />
                      {item.recipientName && (
                        <Meta
                          label="Recipient"
                          value={item.recipientName}
                          sub={item.recipientPhone || undefined}
                        />
                      )}
                      {item.typeOfGoods && (
                        <Meta
                          label="Goods"
                          value={item.typeOfGoods}
                          sub={item.descriptionOfGoods || undefined}
                        />
                      )}
                      {item.cancelReason && (
                        <Meta
                          label="Rejection reason"
                          value={item.cancelReason}
                          danger
                        />
                      )}
                      {item.notes && <Meta label="Notes" value={item.notes} />}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-4)' }}>
                      Created {formatDateTime(item.createdAt)}
                      {item.updatedAt ? ` · Updated ${formatDateTime(item.updatedAt)}` : ''}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      alignItems: 'stretch',
                      minWidth: 150,
                    }}
                  >
                    {actions.length > 0 ? (
                      <>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--text-4)',
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                          }}
                        >
                          Update user
                        </span>
                        {actions.map(action => {
                          const style = ACTION_STYLES[action.kind]
                          return (
                            <button
                              key={action.status}
                              type="button"
                              disabled={busy}
                              onClick={() => void setStatus(item.id, action.status, action.label)}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: `1px solid ${style.border}`,
                                background: style.bg,
                                fontSize: 13,
                                fontWeight: 700,
                                color: style.color,
                                opacity: busy ? 0.6 : 1,
                              }}
                            >
                              {action.label}
                            </button>
                          )
                        })}
                      </>
                    ) : (
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', maxWidth: 160 }}>
                        {item.status === 'DELIVERED'
                          ? 'Completed. User was notified as Delivered.'
                          : 'Rejected. User was notified.'}
                      </p>
                    )}
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
          .courier-row { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {cancelTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="courier-cancel-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
            padding: 16,
          }}
          onClick={() => {
            if (busyId == null) {
              setCancelTarget(null)
              setCancelReason('')
            }
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 14,
              padding: 20,
              width: 'min(480px, 100%)',
              border: '1px solid var(--border)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 id="courier-cancel-title" style={{ marginTop: 0 }}>
              Reject delivery #{cancelTarget.id}?
            </h3>
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 0 }}>
              The sender will get a push notification and see this reason in the app.
            </p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={4}
              placeholder="Reason for rejection…"
              style={{
                width: '100%',
                borderRadius: 10,
                border: '1px solid var(--border)',
                padding: 10,
                resize: 'vertical',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 14,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                disabled={busyId != null}
                onClick={() => {
                  setCancelTarget(null)
                  setCancelReason('')
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="button"
                disabled={busyId != null || !cancelReason.trim()}
                onClick={() =>
                  void setStatus(
                    cancelTarget.id,
                    'CANCELLED',
                    cancelTarget.label,
                    cancelReason.trim(),
                  )
                }
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: '1px solid #FECACA',
                  background: '#B91C1C',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: busyId != null || !cancelReason.trim() ? 'not-allowed' : 'pointer',
                  opacity: busyId != null || !cancelReason.trim() ? 0.6 : 1,
                }}
              >
                {busyId === cancelTarget.id ? 'Rejecting…' : 'Reject & notify'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Meta({
  label,
  value,
  sub,
  emphasize,
  danger,
}: {
  label: string
  value: string
  sub?: string
  emphasize?: boolean
  danger?: boolean
}) {
  const bg = danger ? '#FEF2F2' : emphasize ? '#ECFDF5' : '#fff'
  const border = danger ? '#FECACA' : emphasize ? '#A7F3D0' : 'var(--border)'
  const labelColor = danger ? '#B91C1C' : emphasize ? '#047857' : 'var(--text-4)'
  const valueColor = danger ? '#991B1B' : emphasize ? '#065F46' : 'var(--text)'
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 10,
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: labelColor,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: emphasize || danger ? 15 : 13,
          fontWeight: 800,
          color: valueColor,
        }}
      >
        {value}
      </div>
      {sub ? <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div> : null}
    </div>
  )
}
