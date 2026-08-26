'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  formatTenderDate,
  isClosed,
  isClosingSoon,
  sourceLabel,
  type Tender,
} from '@/lib/tenders'
import {
  DashboardBackLink,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardSearchField,
} from '@/app/dashboard/DashboardChrome'
import { useConfirmDelete } from '../ConfirmDialog'
import {
  AUTO_SYNC_INTERVAL_MS,
  markAutoSyncRan,
  shouldRunAutoSync,
} from '@/lib/auto-sync-client'

type Tab = 'all' | 'open' | 'malawitenders' | 'ppda' | 'maneps' | 'manual'

type Counts = {
  all: number
  active: number
  inactive: number
  open: number
  malawitenders: number
  maneps: number
  ppda: number
  manual: number
}

const EMPTY_COUNTS: Counts = {
  all: 0,
  active: 0,
  inactive: 0,
  open: 0,
  malawitenders: 0,
  maneps: 0,
  ppda: 0,
  manual: 0,
}

type FormState = {
  title: string
  description: string
  buyer: string
  reference: string
  location: string
  tenderUrl: string
  documentUrl: string
  closingAt: string
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  buyer: '',
  reference: '',
  location: 'Malawi',
  tenderUrl: '',
  documentUrl: '',
  closingAt: '',
}

export default function TendersAdminPage() {
  const confirmDelete = useConfirmDelete()
  const [items, setItems] = useState<Tender[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | 'new' | 'sync' | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/tenders', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load tenders')
      setItems(data.items || [])
      setCounts(data.counts || EMPTY_COUNTS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const syncMalawi = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) {
        setBusyId('sync')
        setError('')
        setNotice('')
      }
      try {
        const res = await adminFetch('/api/admin/tenders/sync', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Sync failed')
        const parts = (data.sources || [])
          .map(
            (s: { source: string; ok: boolean; fetched: number }) =>
              s.ok ? `${s.source}: ${s.fetched}` : `${s.source}: failed`,
          )
          .join(' · ')
        const message = opts?.quiet
          ? `Auto-sync — fetched ${data.fetched ?? 0}, added ${data.created ?? 0}, updated ${data.updated ?? 0}.`
          : `Malawi sync done — fetched ${data.fetched ?? 0}, added ${data.created ?? 0}, updated ${data.updated ?? 0}${
              parts ? ` (${parts})` : ''
            }.`
        setNotice(message)
        if (Array.isArray(data.errors) && data.errors.length) {
          setError(data.errors.slice(0, 3).join(' · '))
        }
        await load()
      } catch (err) {
        if (!opts?.quiet) {
          setError(err instanceof Error ? err.message : 'Sync failed')
        } else {
          console.warn('Tenders auto-sync failed:', err)
        }
      } finally {
        if (!opts?.quiet) setBusyId(null)
      }
    },
    [load],
  )

  useEffect(() => {
    if (!shouldRunAutoSync('tenders')) return
    markAutoSyncRan('tenders')
    void syncMalawi({ quiet: true })
  }, [syncMalawi])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(t => {
      if (tab === 'open') {
        if (!t.active || isClosed(t.closingAt)) return false
      } else if (tab !== 'all' && t.source !== tab) {
        return false
      }
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        (t.buyer || '').toLowerCase().includes(q) ||
        (t.reference || '').toLowerCase().includes(q) ||
        (t.location || '').toLowerCase().includes(q) ||
        sourceLabel(t.source).toLowerCase().includes(q)
      )
    })
  }, [items, tab, query])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusyId('new')
    setError('')
    setNotice('')
    try {
      const res = await adminFetch('/api/admin/tenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          buyer: form.buyer.trim() || null,
          reference: form.reference.trim() || null,
          location: form.location.trim() || 'Malawi',
          tenderUrl: form.tenderUrl.trim(),
          documentUrl: form.documentUrl.trim() || null,
          closingAt: form.closingAt ? new Date(form.closingAt).toISOString() : null,
          active: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed')
      setNotice(`Posted “${form.title.trim()}”`)
      setFormOpen(false)
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusyId(null)
    }
  }

  const toggleActive = async (t: Tender) => {
    setBusyId(t.id)
    setError('')
    try {
      const res = await adminFetch(`/api/admin/tenders/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !t.active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setNotice(`${!t.active ? 'Activated' : 'Hidden'} “${t.title}”`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (t: Tender) => {
    if (!(await confirmDelete(t.title, 'This permanently removes the tender from the panel.'))) {
      return
    }
    setBusyId(t.id)
    setError('')
    try {
      const res = await adminFetch(`/api/admin/tenders/${t.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice(`Deleted “${t.title}”`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'open', label: 'Open', count: counts.open },
    { id: 'malawitenders', label: 'MalawiTenders', count: counts.malawitenders },
    { id: 'ppda', label: 'PPDA', count: counts.ppda },
    { id: 'maneps', label: 'MANEPS', count: counts.maneps },
    { id: 'manual', label: 'Manual', count: counts.manual },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <DashboardBackLink />
      <DashboardPageHeader
        sectionId="tenders"
        description={`Sync Malawi procurement notices from malawitenders.com, maneps.mw, and ppda.mw — auto-syncs when you open this page (every ${AUTO_SYNC_INTERVAL_MS / (60 * 60 * 1000)}h), or post one manually.`}
        actions={
          <>
            <button
              type="button"
              onClick={() => void syncMalawi()}
              disabled={busyId === 'sync' || loading}
              style={btnGhost}
            >
              {busyId === 'sync' ? 'Syncing…' : 'Sync Malawi'}
            </button>
            <DashboardRefreshButton
              onClick={() => void load()}
              disabled={loading}
              label={loading ? 'Refreshing…' : 'Refresh'}
            />
            <button
              type="button"
              onClick={() => {
                setForm(EMPTY_FORM)
                setFormOpen(true)
              }}
              style={btnPrimary}
            >
              + Post tender
            </button>
          </>
        }
      />

      {error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}

      {formOpen ? (
        <form onSubmit={save} style={{ ...card, marginBottom: 18 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 17 }}>New tender</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            <Field label="Title *">
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                style={input}
              />
            </Field>
            <Field label="Buyer / institution">
              <input
                value={form.buyer}
                onChange={e => setForm(f => ({ ...f, buyer: e.target.value }))}
                style={input}
              />
            </Field>
            <Field label="Reference">
              <input
                value={form.reference}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                style={input}
              />
            </Field>
            <Field label="Location">
              <input
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                style={input}
              />
            </Field>
            <Field label="Tender / notice link *">
              <input
                required
                value={form.tenderUrl}
                onChange={e => setForm(f => ({ ...f, tenderUrl: e.target.value }))}
                placeholder="https://"
                style={input}
              />
            </Field>
            <Field label="Document link">
              <input
                value={form.documentUrl}
                onChange={e => setForm(f => ({ ...f, documentUrl: e.target.value }))}
                placeholder="PDF / attachment URL"
                style={input}
              />
            </Field>
            <Field label="Closing date">
              <input
                type="date"
                value={form.closingAt}
                onChange={e => setForm(f => ({ ...f, closingAt: e.target.value }))}
                style={input}
              />
            </Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={4}
                style={{ ...input, resize: 'vertical' }}
              />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="submit" disabled={busyId === 'new'} style={btnPrimary}>
              {busyId === 'new' ? 'Saving…' : 'Publish'}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} style={btnGhost}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <DashboardSearchField
        value={query}
        onChange={setQuery}
        placeholder="Search title, buyer, reference…"
        onClear={() => setQuery('')}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
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
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.label} ({t.count})
            </button>
          )
        })}
      </div>

      <section style={card}>
        {loading ? (
          <p style={{ color: 'var(--text-3)' }}>Loading tenders…</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--text-3)' }}>
            No tenders yet. Click <strong>Sync Malawi</strong> to pull from the three portals.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(t => {
              const closed = isClosed(t.closingAt)
              const soon = isClosingSoon(t.closingAt)
              return (
                <article
                  key={t.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 14,
                    background: 'var(--surface)',
                    opacity: t.active ? 1 : 0.72,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, flex: 1 }}>
                      {t.title}
                    </h3>
                    <Chip>{sourceLabel(t.source)}</Chip>
                    {!t.active ? <Chip tone="muted">Hidden</Chip> : null}
                    {closed ? <Chip tone="danger">Closed</Chip> : null}
                    {!closed && soon ? <Chip tone="warn">Closing soon</Chip> : null}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
                    {[t.buyer, t.reference, t.location].filter(Boolean).join(' · ') || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                    Published {formatTenderDate(t.publishedAt)} · Closes{' '}
                    {formatTenderDate(t.closingAt)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <a href={t.tenderUrl} target="_blank" rel="noreferrer" style={linkBtn}>
                      Open notice
                    </a>
                    {t.documentUrl ? (
                      <a href={t.documentUrl} target="_blank" rel="noreferrer" style={linkBtn}>
                        Document
                      </a>
                    ) : null}
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => void toggleActive(t)}
                      style={btnGhost}
                    >
                      {t.active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => void remove(t)}
                      style={{ ...btnGhost, color: '#B91C1C', borderColor: '#FECACA' }}
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

function Banner({ tone, children }: { tone: 'error' | 'ok'; children: ReactNode }) {
  const styles =
    tone === 'error'
      ? { background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }
      : { background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857' }
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        ...styles,
        marginBottom: 14,
        padding: '12px 14px',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
      {label}
      {children}
    </label>
  )
}

function Chip({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'muted' | 'danger' | 'warn'
}) {
  const map = {
    default: { bg: '#F0FDFA', color: '#0F766E', border: '#99F6E4' },
    muted: { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
    danger: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
    warn: { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  }[tone]
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 100,
        background: map.bg,
        color: map.color,
        border: `1px solid ${map.border}`,
      }}
    >
      {children}
    </span>
  )
}

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 18,
  padding: 22,
  boxShadow: 'var(--shadow-sm)',
}

const input: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  fontSize: 14,
  fontWeight: 500,
}

const btnPrimary: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const btnGhost: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: '#fff',
  color: 'var(--text-2)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const linkBtn: CSSProperties = {
  ...btnGhost,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
}
