'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import Image from 'next/image'
import {
  ADMIN_ADVERT_CATEGORIES,
  ADMIN_ADVERT_DURATION_PRESETS,
  isAdvertLive,
  type HomepageAdvert,
  type HomepageAdvertCounts,
} from '@/lib/homepage-adverts'
import { formatDateTime, formatMwk } from '@/lib/vero-api'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardThumbFallback,
} from '@/app/dashboard/DashboardChrome'
import { useConfirm, useConfirmDelete } from '../ConfirmDialog'

type Tab = 'active' | 'pending' | 'expired' | 'all'

const SECTION = DASHBOARD_SECTION_MAP['homepage-ads']

const emptyCounts: HomepageAdvertCounts = {
  all: 0,
  active: 0,
  pending: 0,
  expired: 0,
  disabled: 0,
  feeCredited: 0,
  feePending: 0,
  revenuePaid: 0,
  revenueCredited: 0,
}

type FormState = {
  title: string
  description: string
  category: string
  planId: string
  productPrice: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  imageFile: File | null
}

const emptyForm = (): FormState => ({
  title: '',
  description: '',
  category: 'Other',
  planId: '7d',
  productPrice: '',
  ownerName: 'Vero360 Admin',
  ownerEmail: '',
  ownerPhone: '',
  imageFile: null,
})

function statusTone(ad: HomepageAdvert): { label: string; bg: string; color: string } {
  if (ad.status === 'pending_payment') {
    return { label: 'Pending payment', bg: '#FFF7ED', color: '#C2410C' }
  }
  if (ad.status === 'disabled') {
    return { label: 'Disabled', bg: '#F1F5F9', color: '#475569' }
  }
  if (isAdvertLive(ad)) {
    return { label: 'Live', bg: '#ECFDF5', color: '#166534' }
  }
  return { label: 'Ended', bg: '#FEF2F2', color: '#991B1B' }
}

export default function HomepageAdsAdminPage() {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()
  const [items, setItems] = useState<HomepageAdvert[]>([])
  const [counts, setCounts] = useState<HomepageAdvertCounts>(emptyCounts)
  const [tab, setTab] = useState<Tab>('active')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  const previewUrl = useMemo(() => {
    if (!form.imageFile) return ''
    return URL.createObjectURL(form.imageFile)
  }, [form.imageFile])

  useEffect(() => {
    if (!previewUrl.startsWith('blob:')) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/homepage-adverts', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load homepage ads')
      setItems(data.items || [])
      setCounts(data.counts || emptyCounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load homepage ads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let list = items
    if (tab === 'active') list = items.filter(a => isAdvertLive(a))
    else if (tab === 'pending') list = items.filter(a => a.status === 'pending_payment')
    else if (tab === 'expired') {
      list = items.filter(
        a =>
          a.status === 'disabled' ||
          a.status === 'expired' ||
          (a.status === 'active' && !isAdvertLive(a)),
      )
    }

    const query = q.trim().toLowerCase()
    if (!query) return list
    return list.filter(a => {
      const hay = [
        a.title,
        a.description,
        a.category,
        a.ownerName,
        a.ownerEmail,
        a.ownerUid,
        a.txRef,
        a.planId,
        a.status,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(query)
    })
  }, [items, tab, q])

  const publishFree = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.imageFile) {
      setError('Upload a photo for the advert')
      return
    }
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = new FormData()
      body.set('title', form.title.trim())
      body.set('description', form.description.trim())
      body.set('category', form.category)
      body.set('planId', form.planId)
      body.set('ownerName', form.ownerName.trim() || 'Vero360 Admin')
      if (form.ownerEmail.trim()) body.set('ownerEmail', form.ownerEmail.trim())
      if (form.ownerPhone.trim()) body.set('ownerPhone', form.ownerPhone.trim())
      if (form.productPrice.trim()) body.set('productPrice', form.productPrice.trim())
      body.set('image', form.imageFile)

      const res = await adminFetch('/api/admin/homepage-adverts', {
        method: 'POST',
        body,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not publish advert')
      setNotice(`Published “${form.title.trim()}” — live on the app homepage (no payment).`)
      setForm(emptyForm())
      setFormOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish advert')
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (id: string, status: 'active' | 'disabled' | 'expired') => {
    const ad = items.find(a => a.id === id)
    const ok = await confirm({
      title: status === 'active' ? 'Activate advert?' : status === 'disabled' ? 'Disable advert?' : 'Mark ended?',
      message: `Update “${ad?.title || id}” to ${status}.`,
      confirmLabel: 'Update',
      cancelLabel: 'Cancel',
      danger: status !== 'active',
    })
    if (!ok) return

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/homepage-adverts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setNotice(`Advert marked ${status}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const creditOne = async (id: string) => {
    const ad = items.find(a => a.id === id)
    const ok = await confirm({
      title: 'Credit platform fee?',
      message: `Credit ${formatMwk(ad?.amountPaid || 0)} from “${ad?.title || id}” into the platform fee wallet.`,
      confirmLabel: 'Credit fee',
      cancelLabel: 'Cancel',
    })
    if (!ok) return

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/homepage-adverts/${id}`, {
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
      setNotice('No pending advert fees to credit')
      return
    }
    const ok = await confirm({
      title: 'Credit all pending advert fees?',
      message: `This credits ${counts.feePending} paid advert(s) into the platform fee wallet (Finance → Wallets).`,
      confirmLabel: 'Credit all',
      cancelLabel: 'Cancel',
    })
    if (!ok) return

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch('/api/admin/homepage-adverts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'credit_pending_fees' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk credit failed')
      setNotice(
        `Credited ${data.credited || 0} advert fee(s) · ${formatMwk(data.totalAmount || 0)} → platform wallet`,
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk credit failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    const ad = items.find(a => a.id === id)
    if (!(await confirmDelete(ad?.title || id, 'This permanently deletes the homepage advert.'))) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await adminFetch(`/api/admin/homepage-adverts/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice('Advert deleted')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'active', label: `Live (${counts.active})` },
    { id: 'pending', label: `Pending (${counts.pending})` },
    { id: 'expired', label: `Ended (${counts.expired + counts.disabled})` },
    { id: 'all', label: `All (${counts.all})` },
  ]

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="homepage-ads"
        description="Post complimentary homepage slider ads from the panel (no PayChangu) — or manage paid ads from the app."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm())
                setFormOpen(true)
                setError('')
                setNotice('')
              }}
              style={primaryBtn}
            >
              + Post free ad
            </button>
            <button
              type="button"
              onClick={() => void creditAllPending()}
              disabled={busy || loading || counts.feePending <= 0}
              style={outlineBtn}
            >
              Credit pending fees ({counts.feePending})
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

      {formOpen ? (
        <form
          onSubmit={publishFree}
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: 22,
            boxShadow: 'var(--shadow-sm)',
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Post free homepage ad</h2>
              <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: 13 }}>
                Goes live immediately in the app slider — no payment required.
              </p>
            </div>
            <button type="button" onClick={() => setFormOpen(false)} style={outlineBtn}>
              Cancel
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
              marginTop: 16,
            }}
          >
            <label style={fieldLabel}>
              Title *
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                style={input}
                placeholder="e.g. Weekend special"
              />
            </label>
            <label style={fieldLabel}>
              Category
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                style={input}
              >
                {ADMIN_ADVERT_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldLabel}>
              Duration
              <select
                value={form.planId}
                onChange={e => setForm(f => ({ ...f, planId: e.target.value }))}
                style={input}
              >
                {ADMIN_ADVERT_DURATION_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label} (free)
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldLabel}>
              Product price (optional, MWK)
              <input
                value={form.productPrice}
                onChange={e => setForm(f => ({ ...f, productPrice: e.target.value }))}
                style={input}
                inputMode="numeric"
                placeholder="Buy now price"
              />
            </label>
            <label style={fieldLabel}>
              Display name
              <input
                value={form.ownerName}
                onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
                style={input}
              />
            </label>
            <label style={fieldLabel}>
              Contact email
              <input
                type="email"
                value={form.ownerEmail}
                onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))}
                style={input}
              />
            </label>
            <label style={fieldLabel}>
              Contact phone
              <input
                value={form.ownerPhone}
                onChange={e => setForm(f => ({ ...f, ownerPhone: e.target.value }))}
                style={input}
              />
            </label>
          </div>

          <label style={{ ...fieldLabel, marginTop: 12, display: 'flex' }}>
            Description
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              style={{ ...input, resize: 'vertical' }}
            />
          </label>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Photo *</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <label
                style={{
                  ...outlineBtn,
                  display: 'inline-flex',
                  cursor: 'pointer',
                }}
              >
                Choose image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={e => {
                    const file = e.target.files?.[0] || null
                    setForm(f => ({ ...f, imageFile: file }))
                  }}
                />
              </label>
              {previewUrl ? (
                <div
                  style={{
                    width: 160,
                    height: 96,
                    borderRadius: 12,
                    overflow: 'hidden',
                    position: 'relative',
                    background: '#F8FAFC',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Image src={previewUrl} alt="" fill style={{ objectFit: 'cover' }} unoptimized />
                </div>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>JPEG, PNG, WebP, or GIF · max 8MB</span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="submit" disabled={busy} style={primaryBtn}>
              {busy ? 'Publishing…' : 'Publish free ad'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false)
                setForm(emptyForm())
              }}
              style={outlineBtn}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Metric label="Live ads" value={String(counts.active)} />
        <Metric label="Paid package revenue" value={formatMwk(counts.revenuePaid)} />
        <Metric label="Credited to platform fee" value={formatMwk(counts.revenueCredited)} />
        <Metric label="Fees still pending" value={String(counts.feePending)} />
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
          placeholder="Search title, owner, email, tx ref…"
          style={search}
        />

        {loading && items.length === 0 ? (
          <p style={{ color: 'var(--muted)', marginTop: 24 }}>Loading homepage ads…</p>
        ) : filtered.length === 0 ? (
          <DashboardEmptyState
            icon={SECTION.icon}
            color={SECTION.color}
            title="No ads in this view"
            hint="Post a free ad above, or wait for paid ads from the app."
          />
        ) : (
          <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
            {filtered.map(ad => {
              const tone = statusTone(ad)
              const isComp = ad.amountPaid <= 0 || (ad.txRef || '').startsWith('admin_comp:')
              return (
                <article
                  key={ad.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 14,
                    display: 'grid',
                    gridTemplateColumns: '112px 1fr',
                    gap: 14,
                    alignItems: 'start',
                  }}
                >
                  <div
                    style={{
                      width: 112,
                      height: 72,
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: '#F8FAFC',
                      position: 'relative',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {ad.imageUrl ? (
                      <Image src={ad.imageUrl} alt="" fill style={{ objectFit: 'cover' }} unoptimized />
                    ) : (
                      <DashboardThumbFallback
                        icon={SECTION.icon}
                        color={SECTION.color}
                        bg={SECTION.bg}
                      />
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{ad.title}</h3>
                      <span style={{ ...badge, background: tone.bg, color: tone.color }}>{tone.label}</span>
                      {isComp ? (
                        <span style={{ ...badge, background: '#EEF2FF', color: '#4338CA' }}>Free / admin</span>
                      ) : null}
                      {ad.category ? (
                        <span style={{ ...badge, background: '#EFF6FF', color: '#1D4ED8' }}>{ad.category}</span>
                      ) : null}
                      {ad.platformFeeCredited ? (
                        <span style={{ ...badge, background: '#ECFDF5', color: '#166534' }}>Fee in wallet</span>
                      ) : ad.amountPaid > 0 && ad.status !== 'pending_payment' ? (
                        <span style={{ ...badge, background: '#FFF7ED', color: '#C2410C' }}>Fee pending</span>
                      ) : null}
                    </div>

                    <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: 13, lineHeight: 1.45 }}>
                      {ad.description || 'No description'}
                    </p>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 8,
                        marginTop: 12,
                        fontSize: 13,
                      }}
                    >
                      <Field label="Owner" value={ad.ownerName || '—'} />
                      <Field label="Owner email" value={ad.ownerEmail || '—'} />
                      <Field label="Owner UID" value={ad.ownerUid || '—'} mono />
                      <Field label="Amount paid" value={isComp ? 'Free' : formatMwk(ad.amountPaid)} />
                      <Field label="Plan" value={ad.planId || `${ad.durationDays || '—'}d`} />
                      <Field
                        label="Product price"
                        value={ad.productPrice != null ? formatMwk(ad.productPrice) : '—'}
                      />
                      <Field label="Starts" value={formatDateTime(ad.startsAt)} />
                      <Field label="Ends" value={formatDateTime(ad.endsAt)} />
                      <Field label="Paid at" value={formatDateTime(ad.paidAt)} />
                      <Field label="Tx ref" value={ad.txRef || '—'} mono />
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                      {!ad.platformFeeCredited &&
                      ad.amountPaid > 0 &&
                      ad.status !== 'pending_payment' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void creditOne(ad.id)}
                          style={primaryBtn}
                        >
                          Credit platform fee
                        </button>
                      ) : null}
                      {ad.status !== 'active' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setStatus(ad.id, 'active')}
                          style={outlineBtn}
                        >
                          Activate
                        </button>
                      ) : null}
                      {ad.status !== 'disabled' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setStatus(ad.id, 'disabled')}
                          style={outlineBtn}
                        >
                          Disable
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(ad.id)}
                        style={{ ...outlineBtn, color: '#BE123C', borderColor: '#FECDD3' }}
                      >
                        Delete
                      </button>
                    </div>
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
      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4, letterSpacing: '-0.3px' }}>{value}</div>
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
      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>
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

const fieldLabel: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text)',
}

const input: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  fontWeight: 500,
  outline: 'none',
}
