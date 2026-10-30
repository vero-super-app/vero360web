'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  getSubscriptionTiming,
  isDigitalCrypto,
  isDigitalGiftCard,
  isDigitalOrderPaid,
  isDigitalOrderPending,
  isDigitalSubscription,
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
import { DigitalServicesPricingPanel } from './DigitalServicesPricingPanel'

type Tab =
  | 'subscriptions'
  | 'active_subs'
  | 'expired_subs'
  | 'gift_cards'
  | 'crypto'
  | 'pending'
  | 'all'

type ViewMode = 'orders' | 'pricing'

const SECTION = DASHBOARD_SECTION_MAP['digital-services']

const emptyCounts: DigitalServiceOrderCounts = {
  all: 0,
  paid: 0,
  pending: 0,
  subscriptions: 0,
  giftCards: 0,
  giftCardsPaid: 0,
  giftCardsPending: 0,
  activeSubscriptions: 0,
  expiredSubscriptions: 0,
  feeCredited: 0,
  feePending: 0,
  revenuePaid: 0,
  revenueCredited: 0,
  crypto: 0,
}

function statusTone(o: DigitalServiceOrder): { label: string; bg: string; color: string } {
  if (isDigitalOrderPending(o) && o.bankProofUrl) {
    return { label: 'Bank proof received', bg: '#FEF3C7', color: '#92400E' }
  }
  if (isDigitalOrderPending(o)) {
    return { label: 'Pending payment', bg: '#FFF7ED', color: '#C2410C' }
  }
  if (o.status === 'fulfilled') {
    return { label: 'Fulfilled', bg: '#ECFDF5', color: '#166534' }
  }
  if (o.status === 'cancelled') {
    return { label: 'Cancelled', bg: '#F1F5F9', color: '#475569' }
  }
  if (isDigitalOrderPaid(o)) {
    return { label: 'Paid', bg: '#EFF6FF', color: '#1D4ED8' }
  }
  return { label: o.status || 'Unknown', bg: '#F1F5F9', color: '#475569' }
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
  const [view, setView] = useState<ViewMode>('orders')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sendId, setSendId] = useState('')
  const [cardDetails, setCardDetails] = useState('')
  const [joiningLink, setJoiningLink] = useState('')
  const [sendNotes, setSendNotes] = useState('')
  const [sendFileUrls, setSendFileUrls] = useState<string[]>([])
  const [sendUploading, setSendUploading] = useState(false)

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
    if (tab === 'subscriptions') {
      list = items.filter(o => isDigitalSubscription(o))
    } else if (tab === 'active_subs') {
      list = items.filter(o => {
        if (!isDigitalSubscription(o)) return false
        if (o.status === 'cancelled' || isDigitalOrderPending(o)) return false
        const timing = getSubscriptionTiming(o)
        return !timing.isExpired
      })
    } else if (tab === 'expired_subs') {
      list = items.filter(o => {
        if (!isDigitalSubscription(o)) return false
        if (o.status === 'cancelled' || isDigitalOrderPending(o)) return false
        const timing = getSubscriptionTiming(o)
        return timing.isExpired
      })
    } else if (tab === 'gift_cards') {
      // Paid / fulfilled gift cards only — pending ones live under Pending.
      list = items.filter(o => isDigitalGiftCard(o) && isDigitalOrderPaid(o))
    } else if (tab === 'crypto') {
      list = items.filter(o => isDigitalCrypto(o))
    } else if (tab === 'pending') {
      list = items.filter(o => isDigitalOrderPending(o))
    }

    const query = q.trim().toLowerCase()
    if (!query) return list
    return list.filter(o => {
      const timing = isDigitalSubscription(o) ? getSubscriptionTiming(o) : null
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
        timing?.startDate || '',
        timing?.endDate || '',
        timing?.label || '',
        o.payoutKyc?.binanceId || '',
        o.payoutKyc?.binanceAddress || '',
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
      message: `This credits the full paid amount for ${counts.feePending} order(s) into the platform wallet (100% each, no percentage cut).`,
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

  const openSend = (o: DigitalServiceOrder) => {
    setSendId(o.id)
    setCardDetails(o.fulfillment?.cardDetails || '')
    setJoiningLink(o.fulfillment?.joiningLink || '')
    setSendNotes(o.fulfillment?.notes || '')
    setSendFileUrls(o.fulfillment?.fileUrls || [])
  }

  const uploadSendFile = async (file: File) => {
    setSendUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await adminFetch('/api/admin/digital-services/fulfillment-file', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const url = String(data.fileUrl || '')
      if (!url) throw new Error('No file URL returned')
      setSendFileUrls((prev) => [...prev, url])
      setNotice('File attached. Send to buyer when ready.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSendUploading(false)
    }
  }

  const sendDetails = async (id: string) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/digital-services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_fulfillment',
          cardDetails,
          joiningLink,
          notes: sendNotes,
          fileUrls: sendFileUrls,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setNotice(data.message || 'Details sent')
      setSendId('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'subscriptions', label: `Subscriptions (${counts.subscriptions})` },
    { id: 'active_subs', label: `Active (${counts.activeSubscriptions})` },
    { id: 'expired_subs', label: `Expired (${counts.expiredSubscriptions})` },
    { id: 'gift_cards', label: `Gift cards paid (${counts.giftCardsPaid})` },
    { id: 'crypto', label: `Crypto / FX (${counts.crypto})` },
    { id: 'pending', label: `Pending (${counts.pending})` },
    { id: 'all', label: `All (${counts.all})` },
  ]

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="digital-services"
        description="Spotify, Apple Music, Netflix plans (Mobile / Basic / Standard / Premium), ChatGPT, and gift cards. Set monthly prices here; revenue goes to the Vero platform wallet."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setView('pricing')}
              style={{
                ...primaryBtn,
                background: view === 'pricing' ? '#C2410C' : '#FFF7ED',
                color: view === 'pricing' ? '#fff' : '#C2410C',
                border: '1px solid #FDBA74',
              }}
            >
              Prices & rate
            </button>
            <button
              type="button"
              onClick={() => setView('orders')}
              style={{
                ...primaryBtn,
                background: view === 'orders' ? '#FF8A00' : '#fff',
                color: view === 'orders' ? '#fff' : '#374151',
                border: '1px solid #E5E7EB',
              }}
            >
              Orders
            </button>
            {view === 'orders' ? (
              <button
                type="button"
                onClick={() => void creditAllPending()}
                disabled={busy || loading || counts.feePending <= 0}
                style={primaryBtn}
              >
                Credit pending full amounts ({counts.feePending})
              </button>
            ) : null}
            <DashboardRefreshButton
              onClick={() => void load()}
              disabled={loading || busy}
            />
          </div>
        }
      />

      {view === 'pricing' ? (
        <DigitalServicesPricingPanel />
      ) : (
        <>
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
        <Metric label="Subscriptions" value={String(counts.subscriptions)} />
        <Metric label="Active subs" value={String(counts.activeSubscriptions)} />
        <Metric label="Expired subs" value={String(counts.expiredSubscriptions)} />
        <Metric label="Gift cards paid" value={String(counts.giftCardsPaid)} />
        <Metric label="Crypto / FX" value={String(counts.crypto ?? 0)} />
        <Metric label="Gift cards pending" value={String(counts.giftCardsPending)} />
        <Metric label="Paid orders" value={String(counts.paid)} />
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
          placeholder="Search product, buyer, email, tx ref, dates…"
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
              const isSub = isDigitalSubscription(o)
              const isCrypto = isDigitalCrypto(o)
              const isPending = isDigitalOrderPending(o)
              const isPaid = isDigitalOrderPaid(o)
              const timing = isSub ? getSubscriptionTiming(o) : null
              const kyc = o.payoutKyc

              return (
                <article
                  key={o.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 18,
                    background: '#fff',
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
                      {isSub ? 'Subscription' : isCrypto ? 'Crypto / FX' : 'Gift card'}
                    </span>
                    {isSub && timing && !isPending && o.status !== 'cancelled' ? (
                      <span
                        style={{
                          ...badge,
                          background: timing.isExpired
                            ? '#FEF2F2'
                            : timing.isExpiringSoon
                              ? '#FEF3C7'
                              : '#ECFDF5',
                          color: timing.isExpired
                            ? '#991B1B'
                            : timing.isExpiringSoon
                              ? '#92400E'
                              : '#166534',
                        }}
                      >
                        {timing.isExpired
                          ? `Expired · ${timing.label}`
                          : timing.isExpiringSoon
                            ? `Expiring soon · ${timing.label}`
                            : `Active · ${timing.label}`}
                      </span>
                    ) : null}
                    {o.isGuest ? (
                      <span style={{ ...badge, background: '#FFF7ED', color: '#C2410C' }}>
                        Guest · email
                      </span>
                    ) : (
                      <span style={{ ...badge, background: '#EFF6FF', color: '#1D4ED8' }}>
                        In-app account
                      </span>
                    )}
                    {o.fulfillment ? (
                      <span style={{ ...badge, background: '#ECFDF5', color: '#166534' }}>
                        Details sent
                      </span>
                    ) : null}
                    {o.platformFeeCredited ? (
                      <span style={{ ...badge, background: '#ECFDF5', color: '#166534' }}>
                        Fee in wallet
                      </span>
                    ) : o.amountMwk > 0 && isPaid ? (
                      <span style={{ ...badge, background: '#FFF7ED', color: '#C2410C' }}>
                        Fee pending
                      </span>
                    ) : null}
                    {o.fulfillmentMode === 'auto' && !o.fulfillment ? (
                      <span style={{ ...badge, background: '#EFF6FF', color: '#1D4ED8' }}>
                        Auto PIN
                      </span>
                    ) : null}
                    {o.fulfillmentError ? (
                      <span style={{ ...badge, background: '#FEF2F2', color: '#991B1B' }}>
                        Auto-fulfill error
                      </span>
                    ) : null}
                  </div>
                  {o.fulfillmentError ? (
                    <p style={{ margin: '10px 0 0', fontSize: 13, color: '#991B1B' }}>
                      PrepaidForge: {o.fulfillmentError} Send details by hand if needed.
                    </p>
                  ) : null}

                  {/* Linked Subscription Period Banner */}
                  {isSub && timing && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: '10px 14px',
                        borderRadius: 12,
                        background:
                          o.status === 'cancelled'
                            ? '#F8FAFC'
                            : timing.isExpired
                              ? '#FEF2F2'
                              : '#F0FDF4',
                        border: `1px solid ${
                          o.status === 'cancelled'
                            ? 'var(--border)'
                            : timing.isExpired
                              ? '#FECDD3'
                              : '#BBF7D0'
                        }`,
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                          fontSize: 13,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            color:
                              o.status === 'cancelled'
                                ? 'var(--text-3)'
                                : timing.isExpired
                                  ? '#991B1B'
                                  : '#166534',
                          }}
                        >
                          Subscription Period:
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                          {formatDateTime(timing.startDate)}
                        </span>
                        <span style={{ color: 'var(--muted)', fontWeight: 800 }}>→</span>
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              o.status === 'cancelled'
                                ? 'var(--text-3)'
                                : timing.isExpired
                                  ? '#DC2626'
                                  : '#16A34A',
                          }}
                        >
                          {formatDateTime(timing.endDate)}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                          ({o.periodLabel || o.period || '1 month'})
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          Subscription end date:
                        </span>
                        <strong
                          style={{
                            fontSize: 12,
                            color:
                              o.status === 'cancelled'
                                ? 'var(--text-3)'
                                : timing.isExpired
                                  ? '#991B1B'
                                  : '#15803D',
                          }}
                        >
                          {formatDateTime(timing.endDate)}
                        </strong>
                      </div>
                    </div>
                  )}

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
                        <Field label="Start date" value={formatDateTime(timing?.startDate)} />
                        <Field label="End date (linked)" value={formatDateTime(timing?.endDate)} />
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
                    <Field
                      label="Pay method"
                      value={
                        o.paymentProvider === 'bank_transfer'
                          ? 'Bank transfer (National Bank)'
                          : o.paymentProvider || '—'
                      }
                    />
                    <Field label="Buyer UID" value={o.buyerUid || '—'} mono />
                    <Field label="Tx ref" value={o.txRef || '—'} mono />
                    <Field label="Brand" value={o.brandTag || o.productKey || '—'} />
                  </div>

                  {o.bankProofUrl ? (
                    <div
                      style={{
                        marginTop: 14,
                        padding: 12,
                        borderRadius: 12,
                        background: '#FEF3C7',
                        border: '1px solid #FCD34D',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
                        Bank transfer proof
                      </div>
                      <KycThumb label="Transfer slip" url={o.bankProofUrl} />
                    </div>
                  ) : null}

                  {kyc ? (
                    <div
                      style={{
                        marginTop: 14,
                        padding: 12,
                        borderRadius: 12,
                        background: '#FFF7ED',
                        border: '1px solid #FED7AA',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
                        Payout / identity uploads
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: 8,
                        }}
                      >
                        {kyc.binanceId ? <Field label="Binance ID" value={kyc.binanceId} mono /> : null}
                        {kyc.binanceAddress ? (
                          <Field label="USDT address" value={kyc.binanceAddress} mono />
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
                        <KycThumb label="Alipay / WeChat" url={kyc.alipayWechatCodeUrl} />
                        <KycThumb label="ID in hands" url={kyc.idInHandUrl} />
                        <KycThumb label="Face" url={kyc.faceUrl} />
                        <KycThumb label="Binance code" url={kyc.binanceCodeUrl} />
                      </div>
                    </div>
                  ) : null}

                  {o.fulfillment ? (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 12,
                        background: '#ECFDF5',
                        border: '1px solid #BBF7D0',
                        fontSize: 13,
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Sent to buyer</div>
                      {o.fulfillment.cardDetails ? (
                        <div>
                          <strong>Card details:</strong> {o.fulfillment.cardDetails}
                        </div>
                      ) : null}
                      {o.fulfillment.joiningLink ? (
                        <div>
                          <strong>Link:</strong> {o.fulfillment.joiningLink}
                        </div>
                      ) : null}
                      {o.fulfillment.notes ? <div>{o.fulfillment.notes}</div> : null}
                      {(o.fulfillment.fileUrls || []).length ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                          {o.fulfillment.fileUrls.map((url) => {
                            const isPdf = url.toLowerCase().includes('.pdf')
                            return isPdf ? (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontWeight: 700, color: '#166534' }}
                              >
                                Open PDF
                              </a>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <a key={url} href={url} target="_blank" rel="noreferrer">
                                <img
                                  src={url}
                                  alt=""
                                  style={{
                                    width: 72,
                                    height: 72,
                                    objectFit: 'cover',
                                    borderRadius: 10,
                                    border: '1px solid #BBF7D0',
                                  }}
                                />
                              </a>
                            )
                          })}
                        </div>
                      ) : null}
                      <div style={{ color: '#166534', marginTop: 4, fontWeight: 700 }}>
                        Via {(o.fulfillment.sentVia || []).join(' + ') || 'saved'}
                      </div>
                    </div>
                  ) : null}

                  {sendId === o.id ? (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: '#F8FAFC',
                        display: 'grid',
                        gap: 8,
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 13 }}>
                        Send card details / joining link
                        {o.isGuest ? ' · guest email' : ' · in-app + email'}
                      </div>
                      <textarea
                        value={cardDetails}
                        onChange={e => setCardDetails(e.target.value)}
                        placeholder="Card number, PIN, login, or account details"
                        rows={3}
                        style={{ ...search, minHeight: 72, resize: 'vertical' }}
                      />
                      <input
                        value={joiningLink}
                        onChange={e => setJoiningLink(e.target.value)}
                        placeholder="Joining / invite link"
                        style={search}
                      />
                      <input
                        value={sendNotes}
                        onChange={e => setSendNotes(e.target.value)}
                        placeholder="Optional note for the buyer"
                        style={search}
                      />
                      <label style={{ fontSize: 13, fontWeight: 700 }}>
                        Picture or file
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          disabled={busy || sendUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) void uploadSendFile(file)
                            e.target.value = ''
                          }}
                          style={{ ...search, marginTop: 6, padding: 8 }}
                        />
                      </label>
                      {sendFileUrls.length ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {sendFileUrls.map((url) => (
                            <div key={url} style={{ position: 'relative' }}>
                              {url.toLowerCase().includes('.pdf') ? (
                                <a href={url} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
                                  PDF attached
                                </a>
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={url}
                                  alt=""
                                  style={{
                                    width: 64,
                                    height: 64,
                                    objectFit: 'cover',
                                    borderRadius: 8,
                                    border: '1px solid var(--border)',
                                  }}
                                />
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setSendFileUrls((prev) => prev.filter((u) => u !== url))
                                }
                                style={{
                                  ...outlineBtn,
                                  marginLeft: 6,
                                  padding: '4px 8px',
                                  fontSize: 12,
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          disabled={busy || sendUploading}
                          onClick={() => void sendDetails(o.id)}
                          style={primaryBtn}
                        >
                          Send to {o.isGuest ? o.buyerEmail || 'email' : 'buyer'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setSendId('')}
                          style={outlineBtn}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {!o.platformFeeCredited && o.amountMwk > 0 && isPaid ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void creditOne(o.id)}
                        style={primaryBtn}
                      >
                        Credit full amount
                      </button>
                    ) : null}
                    {!isPending && o.status !== 'cancelled' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openSend(o)}
                        style={primaryBtn}
                      >
                        Send card / link
                      </button>
                    ) : null}
                    {o.status !== 'fulfilled' && !isPending ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(o.id, 'fulfilled')}
                        style={outlineBtn}
                      >
                        Mark fulfilled
                      </button>
                    ) : null}
                    {isPending ? (
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
        </>
      )}
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

function KycThumb({ label, url }: { label: string; url: string }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div style={{ width: 108 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          style={{
            width: 108,
            height: 108,
            objectFit: 'cover',
            borderRadius: 10,
            border: '1px solid #FED7AA',
            background: '#fff',
          }}
        />
        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: '#9A3412' }}>
          {label}
        </div>
      </div>
    </a>
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
