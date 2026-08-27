'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  type DigitalServiceOrder,
  type DigitalServiceOrderCounts,
} from '@/lib/digital-services'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import { formatDateTime, formatMwk } from '@/lib/vero-api'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { useConfirm, useConfirmDelete } from '../ConfirmDialog'
import { useAdminAlerts } from '../AdminAlertsProvider'

type Tab = 'subscriptions' | 'gift_cards' | 'pending' | 'all'

const SECTION = DASHBOARD_SECTION_MAP['digital-services']

const emptyCounts: DigitalServiceOrderCounts = {
  all: 0,
  paid: 0,
  pending: 0,
  subscriptions: 0,
  giftCards: 0,
  feeCredited: 0,
  feePending: 0,
  revenuePaid: 0,
  revenueCredited: 0,
}

function statusTone(o: DigitalServiceOrder): { label: string; bg: string; color: string } {
  if (o.status === 'pending_payment') {
    return { label: 'Pending payment', bg: '#FFF7ED', color: '#C2410C' }
  }
  if (o.status === 'fulfilled') {
    return { label: 'Fulfilled', bg: '#ECFDF5', color: '#166534' }
  }
  if (o.status === 'cancelled') {
    return { label: 'Cancelled', bg: '#F1F5F9', color: '#475569' }
  }
  return { label: 'Paid', bg: '#EFF6FF', color: '#1D4ED8' }
}

export default function DigitalServicesAdminPage() {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()
  const { markDigitalSeen, digitalNew } = useAdminAlerts().payments

  useEffect(() => {
    markDigitalSeen()
  }, [markDigitalSeen, digitalNew])
  const [items, setItems] = useState<DigitalServiceOrder[]>([])
  const [counts, setCounts] = useState<DigitalServiceOrderCounts>(emptyCounts)
  const [tab, setTab] = useState<Tab>('subscriptions')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/digital-services', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load digital services')
      setItems(data.items || [])
      setCounts(data.counts || emptyCounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load digital services')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let list = items
    if (tab === 'subscriptions') list = items.filter(o => o.kind === 'subscription')
    else if (tab === 'gift_cards') list = items.filter(o => o.kind !== 'subscription')
    else if (tab === 'pending') list = items.filter(o => o.status === 'pending_payment')

    const query = q.trim().toLowerCase()
    if (!query) return list
    return list.filter(o => {
      const hay = [
        o.productName,
        o.productKey,
        o.brandTag,
        o.buyerName,
        o.buyerEmail,
        o.buyerUid,
        o.txRef,
        o.kind,
        o.periodLabel,
        o.status,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(query)
    })
  }, [items, tab, q])

  const setStatus = async (
    id: string,
    status: 'paid' | 'fulfilled' | 'cancelled' | 'pending_payment',
  ) => {
    const order = items.find(o => o.id === id)
    const ok = await confirm({
      title: `Mark as ${status}?`,
      message: `Update “${order?.productName || id}” for ${order?.buyerName || 'buyer'} to ${status}.`,
      confirmLabel: 'Update',
      cancelLabel: 'Cancel',
      danger: status === 'cancelled',
    })
    if (!ok) return

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/digital-services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setNotice(`Order marked ${status}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const creditOne = async (id: string) => {
    const order = items.find(o => o.id === id)
    const ok = await confirm({
      title: 'Credit platform wallet?',
      message: `Credit ${formatMwk(order?.amountMwk || 0)} from “${order?.productName || id}” into the Vero main (platform fee) wallet.`,
      confirmLabel: 'Credit fee',
      cancelLabel: 'Cancel',
    })
    if (!ok) return

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/digital-services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'credit_platform_fee' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Credit failed')
      setNotice(data.message || 'Platform fee credited')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credit failed')
    } finally {
      setBusy(false)
    }
  }

  const creditAllPending = async () => {
    if (counts.feePending <= 0) {
      setNotice('No pending digital fees to credit')
      return
    }
    const ok = await confirm({
      title: 'Credit all pending digital payments?',
      message: `This credits the full paid amount for ${counts.feePending} order(s) into the platform wallet (100% each — no percentage cut).`,
      confirmLabel: 'Credit all full amounts',
      cancelLabel: 'Cancel',
    })
    if (!ok) return

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch('/api/admin/digital-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'credit_pending_fees' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk credit failed')
      setNotice(
        `Credited ${data.credited || 0} order(s) · ${formatMwk(data.totalAmount || 0)} → platform wallet`,
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk credit failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    const order = items.find(o => o.id === id)
    if (
      !(await confirmDelete(
        order?.productName || id,
        'This permanently deletes the digital service order.',
      ))
    ) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await adminFetch(`/api/admin/digital-services/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice('Order deleted')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'subscriptions', label: `Subscriptions (${counts.subscriptions})` },
    { id: 'gift_cards', label: `Gift cards (${counts.giftCards})` },
    { id: 'pending', label: `Pending (${counts.pending})` },
    { id: 'all', label: `All (${counts.all})` },
  ]

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="digital-services"
        description="Spotify, Apple Music, Netflix, ChatGPT subscriptions (monthly) and gift-card purchases — revenue goes to the Vero platform wallet."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void creditAllPending()}
              disabled={busy || loading || counts.feePending <= 0}
              style={primaryBtn}
            >
              Credit pending full amounts ({counts.feePending})
            </button>
            <DashboardRefreshButton onClick={() => void load()} disabled={loading || busy} />
          </div>
        }
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Metric label="Paid orders" value={String(counts.paid)} />
        <Metric label="Subscriptions" value={String(counts.subscriptions)} />
        <Metric label="Gift cards" value={String(counts.giftCards)} />
        <Metric label="Revenue paid" value={formatMwk(counts.revenuePaid)} />
        <Metric label="In platform wallet" value={formatMwk(counts.revenueCredited)} />
        <Metric label="Fees pending" value={String(counts.feePending)} />
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                ...chip,
                background: tab === t.id ? '#FFF7ED' : '#fff',
                borderColor: tab === t.id ? '#F97316' : 'var(--border)',
                color: tab === t.id ? '#C2410C' : 'var(--text-2)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search product, buyer, email, tx ref…"
          style={search}
        />

        {loading && items.length === 0 ? (
          <p style={{ color: 'var(--muted)', marginTop: 24 }}>Loading digital orders…</p>
        ) : filtered.length === 0 ? (
          <DashboardEmptyState
            icon={SECTION.icon}
            color={SECTION.color}
            title="No orders in this view"
            hint="Paid Spotify / Netflix / gift-card purchases from the app appear here."
          />
        ) : (
          <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
            {filtered.map(o => {
              const tone = statusTone(o)
              const isSub = o.kind === 'subscription'
              return (
                <article
                  key={o.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{o.productName}</h3>
                    <span style={{ ...badge, background: tone.bg, color: tone.color }}>{tone.label}</span>
                    <span
                      style={{
                        ...badge,
                        background: isSub ? '#F5F3FF' : '#FFF7ED',
                        color: isSub ? '#6D28D9' : '#C2410C',
                      }}
                    >
                      {isSub ? 'Subscription' : 'Gift card'}
                    </span>
                    {o.platformFeeCredited ? (
                      <span style={{ ...badge, background: '#ECFDF5', color: '#166534' }}>
                        Fee in wallet
                      </span>
                    ) : o.amountMwk > 0 && o.status !== 'pending_payment' ? (
                      <span style={{ ...badge, background: '#FFF7ED', color: '#C2410C' }}>
                        Fee pending
                      </span>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: 8,
                      marginTop: 12,
                      fontSize: 13,
                    }}
                  >
                    {isSub ? (
                      <>
                        <Field label="Subscriber" value={o.buyerName || '—'} />
                        <Field label="Email" value={o.buyerEmail || '—'} />
                        <Field label="Period" value={o.periodLabel || o.period || 'monthly'} />
                        <Field label="Amount" value={formatMwk(o.amountMwk)} />
                        <Field label="Subscribed" value={formatDateTime(o.paidAt || o.createdAt)} />
                      </>
                    ) : (
                      <>
                        <Field label="Buyer" value={o.buyerName || '—'} />
                        <Field label="Email" value={o.buyerEmail || '—'} />
                        <Field label="Gift card" value={o.productName} />
                        <Field
                          label="Face value"
                          value={
                            o.selectedUsd != null
                              ? `$${o.selectedUsd} · ${formatMwk(o.amountMwk)}`
                              : formatMwk(o.amountMwk)
                          }
                        />
                        <Field label="Date" value={formatDateTime(o.paidAt || o.createdAt)} />
                      </>
                    )}
                    <Field label="Phone" value={o.buyerPhone || '—'} />
                    <Field label="Buyer UID" value={o.buyerUid || '—'} mono />
                    <Field label="Tx ref" value={o.txRef || '—'} mono />
                    <Field label="Brand" value={o.brandTag || o.productKey || '—'} />
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {!o.platformFeeCredited &&
                    o.amountMwk > 0 &&
                    o.status !== 'pending_payment' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void creditOne(o.id)}
                        style={primaryBtn}
                      >
                        Credit full amount
                      </button>
                    ) : null}
                    {o.status !== 'fulfilled' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(o.id, 'fulfilled')}
                        style={outlineBtn}
                      >
                        Mark fulfilled
                      </button>
                    ) : null}
                    {o.status === 'pending_payment' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(o.id, 'paid')}
                        style={outlineBtn}
                      >
                        Mark paid
                      </button>
                    ) : null}
                    {o.status !== 'cancelled' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(o.id, 'cancelled')}
                        style={{ ...outlineBtn, color: '#BE123C', borderColor: '#FECDD3' }}
                      >
                        Cancel
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(o.id)}
                      style={{ ...outlineBtn, color: '#BE123C', borderColor: '#FECDD3' }}
                    >
                      Delete
                    </button>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4, letterSpacing: '-0.3px' }}>
        {value}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-3)',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 2,
          fontWeight: 650,
          color: 'var(--text)',
          wordBreak: 'break-word',
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
          fontSize: mono ? 12 : 13,
        }}
      >
        {value}
      </div>
    </div>
  )
}

const chip: CSSProperties = {
  border: '1px solid',
  borderRadius: 999,
  padding: '7px 12px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  background: '#fff',
}

const badge: CSSProperties = {
  borderRadius: 999,
  padding: '3px 9px',
  fontSize: 11,
  fontWeight: 800,
}

const search: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
}

const primaryBtn: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '9px 12px',
  background: '#F97316',
  color: '#fff',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
}

const outlineBtn: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '9px 12px',
  background: '#fff',
  color: 'var(--text)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
}
