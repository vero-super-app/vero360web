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
import Image from 'next/image'
import {
  formatDateTime,
  jobStatusTone,
  regionLabel,
  resolveJobImage,
  sourceLabel,
  type JobPost,
  type JobRegion,
} from '@/lib/jobs'
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

type Tab = 'all' | 'active' | 'inactive' | 'malawi' | 'international'

type Counts = {
  all: number
  active: number
  inactive: number
  malawi: number
  international: number
  manual: number
  synced: number
}

type FormState = {
  position: string
  description: string
  jobLink: string
  photoUrl: string
  company: string
  location: string
  region: JobRegion
  isActive: boolean
  isRemote: boolean
}

const EMPTY_COUNTS: Counts = {
  all: 0,
  active: 0,
  inactive: 0,
  malawi: 0,
  international: 0,
  manual: 0,
  synced: 0,
}

const EMPTY_FORM: FormState = {
  position: '',
  description: '',
  jobLink: '',
  photoUrl: '',
  company: '',
  location: '',
  region: 'malawi',
  isActive: true,
  isRemote: false,
}

function formFromJob(j: JobPost): FormState {
  return {
    position: j.position,
    description: j.description,
    jobLink: j.jobLink,
    photoUrl: j.photoUrl || '',
    company: j.company || '',
    location: j.location || '',
    region: j.region,
    isActive: j.isActive,
    isRemote: j.isRemote,
  }
}

export default function JobsAdminPage() {
  const confirmDelete = useConfirmDelete()
  const [items, setItems] = useState<JobPost[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<number | 'new' | 'sync' | 'sync-malawi' | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/jobs?activeOnly=false', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load jobs')
      setItems(data.items || [])
      setCounts(data.counts || EMPTY_COUNTS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
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
        setBusyId('sync-malawi')
        setError('')
        setNotice('')
      }
      try {
        const res = await adminFetch('/api/admin/jobs/sync-malawi', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Malawi sync failed')
        const parts = (data.sources || [])
          .map(
            (s: { source: string; ok: boolean; fetched: number; error?: string }) =>
              s.ok ? `${s.source}: ${s.fetched}` : `${s.source}: failed`,
          )
          .join(' · ')
        const message = opts?.quiet
          ? `Auto-sync — fetched ${data.fetched ?? 0}, added ${data.created ?? 0}, skipped ${data.skipped ?? 0}.`
          : `Malawi sync done — fetched ${data.fetched ?? 0}, added ${data.created ?? 0}, skipped ${data.skipped ?? 0}${
              parts ? ` (${parts})` : ''
            }. Sources: onlinejobmw.com, jobsearchmalawi.com, mwayi.mw.`
        setNotice(message)
        if (Array.isArray(data.errors) && data.errors.length) {
          setError(data.errors.slice(0, 3).join(' · '))
        }
        await load()
      } catch (err) {
        if (!opts?.quiet) {
          setError(err instanceof Error ? err.message : 'Malawi sync failed')
        } else {
          console.warn('Jobs auto-sync failed:', err)
        }
      } finally {
        if (!opts?.quiet) setBusyId(null)
      }
    },
    [load],
  )

  useEffect(() => {
    if (!shouldRunAutoSync('jobs')) return
    markAutoSyncRan('jobs')
    void syncMalawi({ quiet: true })
  }, [syncMalawi])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(j => {
      if (tab === 'active' && !j.isActive) return false
      if (tab === 'inactive' && j.isActive) return false
      if (tab === 'malawi' && j.region !== 'malawi') return false
      if (tab === 'international' && j.region !== 'international') return false
      if (!q) return true
      return (
        j.position.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        (j.company || '').toLowerCase().includes(q) ||
        (j.location || '').toLowerCase().includes(q) ||
        j.jobLink.toLowerCase().includes(q) ||
        sourceLabel(j.source).toLowerCase().includes(q) ||
        String(j.id).includes(q)
      )
    })
  }, [items, tab, query])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
    setError('')
    setNotice('')
  }

  const openEdit = (j: JobPost) => {
    setEditingId(j.id)
    setForm(formFromJob(j))
    setFormOpen(true)
    setError('')
    setNotice('')
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusyId(editingId ?? 'new')
    setError('')
    setNotice('')
    try {
      const position = form.position.trim()
      const description = form.description.trim()
      if (!position) throw new Error('Position is required')
      if (!description) throw new Error('Description is required')

      const payload: Record<string, unknown> = {
        position,
        description,
        jobLink: form.jobLink.trim() || 'https://vero360.app/careers',
        region: form.region,
        isActive: form.isActive,
        isRemote: form.isRemote,
      }
      if (form.photoUrl.trim()) payload.photoUrl = form.photoUrl.trim()
      if (form.company.trim()) payload.company = form.company.trim()
      if (form.location.trim()) payload.location = form.location.trim()

      const isEdit = editingId != null
      const res = await adminFetch(
        isEdit ? `/api/admin/jobs/${editingId}` : '/api/admin/jobs',
        {
          method: isEdit ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          (data && typeof data === 'object' && 'error' in data
            ? String((data as { error?: unknown }).error || '')
            : '') || `Save failed (${res.status})`,
        )
      }

      setNotice(
        isEdit
          ? `Updated “${position}” — visible in the app when Active`
          : `Posted “${position}” — pull to refresh Jobs in the app`,
      )
      closeForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusyId(null)
    }
  }

  const toggleActive = async (j: JobPost) => {
    setBusyId(j.id)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/jobs/${j.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !j.isActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setNotice(
        data.item?.isActive
          ? `“${j.position}” is now active in the app`
          : `“${j.position}” hidden from active listings`,
      )
      if (data.item) {
        setItems(prev => prev.map(x => (x.id === j.id ? data.item : x)))
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (j: JobPost) => {
    if (
      !(await confirmDelete(
        j.position,
        'This permanently removes the job from Nest / the app.',
      ))
    ) {
      return
    }
    setBusyId(j.id)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/jobs/${j.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice(`Deleted “${j.position}”`)
      setItems(prev => prev.filter(x => x.id !== j.id))
      if (editingId === j.id) closeForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const syncExternal = async () => {
    setBusyId('sync')
    setError('')
    setNotice('')
    try {
      const res = await adminFetch('/api/admin/jobs/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setNotice('External job sync finished (Remotive / Jooble).')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setBusyId(null)
    }
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'active', label: 'Active', count: counts.active },
    { id: 'inactive', label: 'Inactive', count: counts.inactive },
    { id: 'malawi', label: 'Malawi', count: counts.malawi },
    { id: 'international', label: 'International', count: counts.international },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <DashboardBackLink />

      <DashboardPageHeader
        sectionId="jobs"
        description={`Post, edit, and sync listings for the Vero360 app. Malawi boards auto-sync when you open this page (every ${AUTO_SYNC_INTERVAL_MS / (60 * 60 * 1000)}h). International listings sync on the Nest server every 6h.`}
        actions={
          <>
            <button
              type="button"
              onClick={() => void syncMalawi()}
              disabled={busyId === 'sync-malawi' || busyId === 'sync' || loading}
              style={btnGhost}
            >
              {busyId === 'sync-malawi' ? 'Syncing Malawi…' : 'Sync Malawi'}
            </button>
            <button
              type="button"
              onClick={() => void syncExternal()}
              disabled={busyId === 'sync' || busyId === 'sync-malawi' || loading}
              style={btnGhost}
            >
              {busyId === 'sync' ? 'Syncing…' : 'Sync international'}
            </button>
            <DashboardRefreshButton
              onClick={() => void load()}
              disabled={loading}
              label={loading ? 'Refreshing…' : 'Refresh'}
            />
            <button type="button" onClick={openCreate} style={btnPrimary}>
              + Post job
            </button>
          </>
        }
      />

      {error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}

      {formOpen ? (
        <form onSubmit={save} noValidate style={{ ...card, marginBottom: 18 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 17 }}>
            {editingId != null ? `Edit job #${editingId}` : 'New job post'}
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6B7280', lineHeight: 1.45 }}>
            Required: position + description. Application link can be any website
            (we add <code>https://</code> if missing). Leave it blank to use the
            Vero360 careers page.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            <Field label="Position *">
              <input
                required
                value={form.position}
                onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                placeholder="e.g. Front-end Developer"
                style={input}
                maxLength={160}
              />
            </Field>
            <Field label="Company">
              <input
                value={form.company}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                placeholder="Acme Corp"
                style={input}
                maxLength={200}
              />
            </Field>
            <Field label="Location">
              <input
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Lilongwe"
                style={input}
                maxLength={200}
              />
            </Field>
            <Field label="Region">
              <select
                value={form.region}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    region: e.target.value === 'international' ? 'international' : 'malawi',
                  }))
                }
                style={input}
              >
                <option value="malawi">Malawi</option>
                <option value="international">International</option>
              </select>
            </Field>
            <Field label="Application link">
              <input
                type="text"
                value={form.jobLink}
                onChange={e => setForm(f => ({ ...f, jobLink: e.target.value }))}
                placeholder="https://… or leave blank"
                style={input}
              />
            </Field>
            <Field label="Photo URL (optional)">
              <input
                type="text"
                value={form.photoUrl}
                onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))}
                placeholder="https://… (optional)"
                style={input}
              />
            </Field>
          </div>

          <Field label="Description *" style={{ marginTop: 12 }}>
            <textarea
              required
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Role summary, requirements…"
              rows={5}
              style={{ ...input, resize: 'vertical', minHeight: 110 }}
            />
          </Field>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              />
              Active in app
            </label>
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={form.isRemote}
                onChange={e => setForm(f => ({ ...f, isRemote: e.target.checked }))}
              />
              Remote
            </label>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <button
              type="submit"
              disabled={
                busyId === 'new' || (editingId != null && busyId === editingId)
              }
              style={btnPrimary}
            >
              {busyId === 'new' || (editingId != null && busyId === editingId)
                ? 'Saving…'
                : editingId != null
                  ? 'Save changes'
                  : 'Publish job'}
            </button>
            <button type="button" onClick={closeForm} style={btnGhost}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              ...chip,
              background: tab === t.id ? '#0F766E' : '#F3F4F6',
              color: tab === t.id ? '#fff' : '#374151',
            }}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <DashboardSearchField
        value={query}
        onChange={setQuery}
        placeholder="Search title, company, location…"
        label="Search jobs"
        onClear={() => setQuery('')}
      />

      <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 12px' }}>
        {counts.manual} admin-posted · {counts.synced} synced from providers
      </p>

      {loading && items.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>Loading jobs…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '28px 0' }}>
          No jobs match. Post one or sync external listings.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(j => {
            const status = jobStatusTone(j.isActive)
            const img = resolveJobImage(j.photoUrl)
            const busy = busyId === j.id
            return (
              <div key={j.id} style={card}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: img ? '88px 1fr' : '1fr',
                    gap: 14,
                  }}
                >
                  {img ? (
                    <div
                      style={{
                        position: 'relative',
                        width: 88,
                        height: 88,
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: '#F3F4F6',
                      }}
                    >
                      <Image
                        src={img}
                        alt=""
                        fill
                        sizes="88px"
                        style={{ objectFit: 'cover' }}
                        unoptimized
                      />
                    </div>
                  ) : null}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{j.position}</div>
                        <div style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
                          {[j.company, j.location || (j.isRemote ? 'Remote' : null), regionLabel(j.region)]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <span
                        style={{
                          alignSelf: 'flex-start',
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: status.bg,
                          color: status.color,
                          border: `1px solid ${status.border}`,
                        }}
                      >
                        {status.label}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: '10px 0 0',
                        fontSize: 13,
                        color: '#4B5563',
                        lineHeight: 1.45,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {j.description || '—'}
                    </p>

                    <div style={{ marginTop: 10, fontSize: 12, color: '#9CA3AF' }}>
                      #{j.id} · {sourceLabel(j.source)}
                      {j.isRemote ? ' · Remote' : ''}
                      {' · '}
                      Posted {formatDateTime(j.createdAt)}
                      {j.jobLink ? (
                        <>
                          {' · '}
                          <a
                            href={j.jobLink}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#0F766E' }}
                          >
                            Apply link
                          </a>
                        </>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => openEdit(j)}
                        disabled={busy}
                        style={btnGhost}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(j)}
                        disabled={busy}
                        style={btnGhost}
                      >
                        {busy ? '…' : j.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(j)}
                        disabled={busy}
                        style={{ ...btnGhost, color: '#B91C1C', borderColor: '#FECACA' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  children,
  style,
}: {
  label: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <label style={{ display: 'block', ...style }}>
      <span
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: '#6B7280',
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function Banner({ tone, children }: { tone: 'error' | 'ok'; children: ReactNode }) {
  const styles =
    tone === 'error'
      ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }
      : { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }
  return (
    <div
      style={{
        ...styles,
        padding: '10px 14px',
        borderRadius: 8,
        marginBottom: 14,
        fontSize: 14,
      }}
    >
      {children}
    </div>
  )
}

const card: CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 16,
  border: '1px solid #E5E7EB',
}

const input: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #E5E7EB',
  fontSize: 14,
  boxSizing: 'border-box',
}

const chip: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const btnPrimary: CSSProperties = {
  border: 'none',
  background: '#0F766E',
  color: '#fff',
  borderRadius: 8,
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const btnGhost: CSSProperties = {
  border: '1px solid #D1D5DB',
  background: '#fff',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const checkLabel: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
}
