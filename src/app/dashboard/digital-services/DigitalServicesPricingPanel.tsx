'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useConfirmDelete } from '../ConfirmDialog'
import type { PrepaidForgeProductConfig } from '@/lib/digital-services-prepaidforge'

type DigitalProductPriceConfig = {
  key: string
  name: string
  subtitle?: string
  category: string
  brandTag?: string
  fixedMwkPrice?: number | null
  usdAmounts?: number[]
  mwkPerUnit?: number | null
  unitLabel?: string
  maxOtherAmount?: number | null
  imageUrl?: string
  active?: boolean
  isHub?: boolean
  hubKey?: string | null
  planBadge?: string
  featureLines?: string[]
  recommended?: boolean
  prepaidForge?: PrepaidForgeProductConfig | null
}

type DigitalServicesConfig = {
  usdToMwkRate: number
  products: DigitalProductPriceConfig[]
  updatedAt?: string | null
  updatedByEmail?: string | null
}

type DraftProduct = DigitalProductPriceConfig & {
  usdAmountsText: string
}

function toDraft(p: DigitalProductPriceConfig): DraftProduct {
  return {
    ...p,
    usdAmountsText: (p.usdAmounts || []).join(', '),
  }
}

function linesFromText(raw: string | string[] | undefined): string[] {
  const text = Array.isArray(raw) ? raw.join('\n') : raw || ''
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function isHubProduct(p: { isHub?: boolean; key: string }): boolean {
  return p.isHub === true || p.key === 'chatgpt' || p.key === 'netflix'
}

function withPrepaidForge(
  p: DraftProduct,
  patch: Partial<PrepaidForgeProductConfig>,
): PrepaidForgeProductConfig {
  return {
    enabled: patch.enabled ?? p.prepaidForge?.enabled ?? false,
    region: patch.region ?? p.prepaidForge?.region ?? '',
    skuByUsd: patch.skuByUsd ?? p.prepaidForge?.skuByUsd ?? {},
    preferredCodeType:
      patch.preferredCodeType ?? p.prepaidForge?.preferredCodeType ?? 'TEXT',
  }
}

function fromDraft(p: DraftProduct): DigitalProductPriceConfig {
  const isSub = p.category === 'streaming' || p.category === 'subscription'
  const amounts = p.usdAmountsText
    .split(/[,\s]+/)
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x) && x > 0)
  const hub = isHubProduct(p)

  return {
    key: p.key,
    name: p.name.trim(),
    subtitle: (p.subtitle || '').trim() || undefined,
    category: p.category,
    brandTag: (p.brandTag || '').trim() || undefined,
    fixedMwkPrice: isSub
      ? hub
        ? null
        : Math.max(0, Math.round(Number(p.fixedMwkPrice) || 0))
      : null,
    usdAmounts: isSub ? [] : amounts,
    mwkPerUnit:
      !isSub && p.mwkPerUnit != null && Number(p.mwkPerUnit) > 0
        ? Math.round(Number(p.mwkPerUnit))
        : null,
    unitLabel: !isSub ? (p.unitLabel || '').trim() || undefined : undefined,
    maxOtherAmount:
      !isSub && p.maxOtherAmount != null && Number(p.maxOtherAmount) > 0
        ? Math.round(Number(p.maxOtherAmount) * 100) / 100
        : null,
    imageUrl: (p.imageUrl || '').trim() || undefined,
    active: p.active !== false,
    isHub: hub,
    hubKey: (p.hubKey || '').trim() || null,
    planBadge: (p.planBadge || '').trim() || undefined,
    featureLines: linesFromText(p.featureLines),
    recommended: p.recommended === true,
    prepaidForge: p.prepaidForge
      ? {
          enabled: p.prepaidForge.enabled === true,
          region: (p.prepaidForge.region || '').trim(),
          skuByUsd: p.prepaidForge.skuByUsd || {},
          preferredCodeType:
            p.prepaidForge.preferredCodeType === 'SCAN' ? 'SCAN' : 'TEXT',
        }
      : null,
  }
}

function chatGptPlanHint(key: string): string {
  switch (key) {
    case 'chatgpt_basic':
      return 'For students · shared login for up to 15 · school work · chats are not private · MWK 10,000'
    case 'chatgpt_plus':
      return 'Private · one account · work and personal use · MWK 65,000'
    default:
      return ''
  }
}

function netflixPlanHint(key: string): string {
  switch (key) {
    case 'netflix_mobile':
      return 'Fair · 480p · Phone/tablet · 1 stream · 1 download'
    case 'netflix_basic':
      return 'Good · 720p HD · TV/computer/phone/tablet · 1 stream · 1 download'
    case 'netflix_standard':
      return 'Great · 1080p Full HD · TV/computer/phone/tablet · 2 streams · 2 downloads'
    case 'netflix_premium':
      return 'Most popular · Best · 4K+HDR · Spatial audio · 4 streams · 6 downloads'
    default:
      return ''
  }
}

function slugKey(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  return base || `crypto_${Date.now()}`
}

export function DigitalServicesPricingPanel() {
  const confirmDelete = useConfirmDelete()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [rate, setRate] = useState(4700)
  const [products, setProducts] = useState<DraftProduct[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [updatedBy, setUpdatedBy] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('USDT')
  const [newAmounts, setNewAmounts] = useState('10, 50, 100')
  const [newRate, setNewRate] = useState(4700)
  const [newMaxOther, setNewMaxOther] = useState(1000)
  const [newImageUrl, setNewImageUrl] = useState('')
  const [pfLoading, setPfLoading] = useState(false)
  const [pfStatus, setPfStatus] = useState<{
    enabled: boolean
    configured: boolean
    error: string
    minBalanceEur?: number
  }>({ enabled: false, configured: false, error: '' })
  const [pfCatalog, setPfCatalog] = useState<
    Array<{ sku: string; name: string; brand: string | null; countries: string[] }>
  >([])
  const [pfBalance, setPfBalance] = useState<{
    amount: number
    currency?: string
  } | null>(null)
  const [pfStocks, setPfStocks] = useState<
    Record<string, { quantity: number; purchasePrice: number; type: string }>
  >({})

  const [subName, setSubName] = useState('')
  const [subImageUrl, setSubImageUrl] = useState('')
  const [subAsHub, setSubAsHub] = useState(true)
  const [subSimplePrice, setSubSimplePrice] = useState(15000)
  const [subStudentName, setSubStudentName] = useState('Student plan')
  const [subStudentPrice, setSubStudentPrice] = useState(10000)
  const [subStudentFeatures, setSubStudentFeatures] = useState(
    'Shared account for students\nBest for school work\nChats are not private',
  )
  const [subPrivateName, setSubPrivateName] = useState('Private plan')
  const [subPrivatePrice, setSubPrivatePrice] = useState(65000)
  const [subPrivateFeatures, setSubPrivateFeatures] = useState(
    'Your own account. Not shared with anyone\nBest for work and personal use\nYour chats stay private',
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/digital-services/pricing', {
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load pricing')
      const config = data.config as DigitalServicesConfig
      setRate(config.usdToMwkRate || 4700)
      setProducts((config.products || []).map(toDraft))
      setUpdatedAt(config.updatedAt || null)
      setUpdatedBy(config.updatedByEmail || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPrepaidForge = useCallback(async () => {
    setPfLoading(true)
    try {
      const [prodRes, balRes] = await Promise.all([
        adminFetch('/api/admin/digital-services/prepaidforge?view=products', {
          cache: 'no-store',
        }),
        adminFetch('/api/admin/digital-services/prepaidforge?view=balance', {
          cache: 'no-store',
        }),
      ])
      const data = await prodRes.json()
      const bal = await balRes.json().catch(() => ({}))
      setPfStatus({
        enabled: data.enabled === true,
        configured: data.configured === true,
        error: data.error || '',
        minBalanceEur: data.minBalanceEur,
      })
      setPfCatalog(Array.isArray(data.products) ? data.products : [])
      const amount = Number(bal?.balance?.amount)
      setPfBalance(
        Number.isFinite(amount)
          ? { amount, currency: bal?.balance?.currency || 'EUR' }
          : null,
      )
    } catch (err) {
      setPfStatus({
        enabled: false,
        configured: false,
        error: err instanceof Error ? err.message : 'Could not reach PrepaidForge',
      })
      setPfCatalog([])
      setPfBalance(null)
    } finally {
      setPfLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    void loadPrepaidForge()
  }, [load, loadPrepaidForge])

  useEffect(() => {
    const skus = Array.from(
      new Set(
        products.flatMap((p) =>
          Object.values(p.prepaidForge?.skuByUsd || {})
            .map((s) => String(s || '').trim())
            .filter(Boolean),
        ),
      ),
    )
    if (!skus.length || !pfStatus.enabled || !pfStatus.configured) {
      setPfStocks({})
      return
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await adminFetch(
            `/api/admin/digital-services/prepaidforge?view=stocks&skus=${encodeURIComponent(skus.join(','))}`,
            { cache: 'no-store' },
          )
          const data = await res.json()
          const next: Record<
            string,
            { quantity: number; purchasePrice: number; type: string }
          > = {}
          for (const raw of Array.isArray(data.stocks) ? data.stocks : []) {
            const sku = String(raw.product || '').trim()
            if (!sku) continue
            const type = String(raw.type || '').toUpperCase()
            const prev = next[sku]
            if (!prev || type === 'TEXT') {
              next[sku] = {
                quantity: Number(raw.quantity),
                purchasePrice: Number(raw.purchasePrice),
                type,
              }
            }
          }
          setPfStocks(next)
        } catch {
          setPfStocks({})
        }
      })()
    }, 500)
    return () => window.clearTimeout(timer)
  }, [products, pfStatus.enabled, pfStatus.configured])

  const save = async (overrideProducts?: DraftProduct[]) => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const list = overrideProducts ?? products
      const payload = {
        usdToMwkRate: Number(rate),
        products: list.map(fromDraft),
      }
      const res = await adminFetch('/api/admin/digital-services/pricing', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setNotice(
        data.message ||
          'Pricing saved. App users see new rates on next open/refresh.',
      )
      const config = data.config as DigitalServicesConfig
      if (config) {
        setRate(config.usdToMwkRate)
        setProducts((config.products || []).map(toDraft))
        setUpdatedAt(config.updatedAt || null)
        setUpdatedBy(config.updatedByEmail || null)
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  const updateProduct = (key: string, patch: Partial<DraftProduct>) => {
    setProducts((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    )
  }

  /** Toggle stock / visibility in the app — saves immediately. */
  const toggleActive = async (key: string, active: boolean) => {
    const next = products.map((p) =>
      p.key === key ? { ...p, active } : p,
    )
    setProducts(next)
    const name = next.find((p) => p.key === key)?.name || key
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch('/api/admin/digital-services/pricing', {
        method: 'PUT',
        body: JSON.stringify({
          usdToMwkRate: Number(rate),
          products: next.map(fromDraft),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not update stock')
      const config = data.config as DigitalServicesConfig
      if (config) {
        setRate(config.usdToMwkRate)
        setProducts((config.products || []).map(toDraft))
        setUpdatedAt(config.updatedAt || null)
        setUpdatedBy(config.updatedByEmail || null)
      }
      setNotice(
        active
          ? `${name} is active in the app again.`
          : `${name} deactivated. Hidden in the app (out of stock).`,
      )
    } catch (err) {
      setProducts((prev) =>
        prev.map((p) => (p.key === key ? { ...p, active: !active } : p)),
      )
      setError(err instanceof Error ? err.message : 'Could not update stock')
    } finally {
      setSaving(false)
    }
  }

  const uploadImage = async (file: File, target: 'new' | string) => {
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await adminFetch('/api/admin/digital-services/product-image', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const url = String(data.imageUrl || '')
      if (!url) throw new Error('No image URL returned')
      if (target === 'new') setNewImageUrl(url)
      else if (target === 'sub') setSubImageUrl(url)
      else updateProduct(target, { imageUrl: url })
      setNotice('Picture uploaded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const createCryptoCard = async () => {
    const name = newName.trim()
    if (!name) {
      setError('Enter a name (e.g. USDT, Yuan, BNB).')
      return
    }
    const unit = newUnit.trim() || name
    const amounts = newAmounts
      .split(/[,\s]+/)
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x) && x > 0)
    if (!amounts.length) {
      setError('Enter at least one amount (e.g. 10, 50, 100).')
      return
    }
    const mwkPerUnit = Math.round(Number(newRate) || 0)
    if (mwkPerUnit < 1) {
      setError('Rate (MWK per unit) must be at least 1.')
      return
    }
    const maxOther = Math.round(Number(newMaxOther) || 0)
    if (maxOther < 1) {
      setError('Max other amount must be at least 1.')
      return
    }

    let key = slugKey(name)
    const existing = new Set(products.map((p) => p.key))
    if (existing.has(key)) {
      key = `${key}_${Date.now().toString(36).slice(-4)}`
    }

    const draft: DraftProduct = {
      key,
      name,
      subtitle: `${unit} digital card`,
      category: 'crypto',
      brandTag: unit,
      unitLabel: unit,
      mwkPerUnit,
      maxOtherAmount: maxOther,
      usdAmounts: amounts,
      usdAmountsText: amounts.join(', '),
      imageUrl: newImageUrl.trim() || undefined,
      fixedMwkPrice: null,
      active: true,
    }

    const next = [...products, draft]
    const ok = await save(next)
    if (ok) {
      setNewName('')
      setNewUnit('USDT')
      setNewAmounts('10, 50, 100')
      setNewRate(4700)
      setNewMaxOther(1000)
      setNewImageUrl('')
      setNotice(`${name} created and live in the app.`)
    }
  }

  const uniqueKey = (() => {
    const existing = new Set(products.map((p) => p.key))
    return (base: string) => {
      let key = slugKey(base)
      if (existing.has(key)) key = `${key}_${Date.now().toString(36).slice(-4)}`
      existing.add(key)
      return key
    }
  })()

  const createSubscription = async () => {
    const name = subName.trim()
    if (!name) {
      setError('Enter a subscription name (e.g. Claude, Canva).')
      return
    }
    const hubKey = uniqueKey(name)
    const imageUrl = subImageUrl.trim() || undefined
    const next: DraftProduct[] = [...products]

    if (subAsHub) {
      const studentPrice = Math.round(Number(subStudentPrice) || 0)
      const privatePrice = Math.round(Number(subPrivatePrice) || 0)
      if (studentPrice < 1 && privatePrice < 1) {
        setError('Set at least one plan price in MWK.')
        return
      }
      next.push({
        key: hubKey,
        name,
        subtitle: 'Choose a plan',
        category: 'streaming',
        brandTag: name,
        imageUrl,
        fixedMwkPrice: null,
        usdAmounts: [],
        usdAmountsText: '',
        isHub: true,
        active: true,
      })
      if (studentPrice >= 1) {
        const studentName = subStudentName.trim() || 'Student plan'
        next.push({
          key: uniqueKey(`${hubKey}_student`),
          name: studentName,
          subtitle: linesFromText(subStudentFeatures).join(' · ') || studentName,
          category: 'streaming',
          brandTag: 'Students',
          hubKey,
          planBadge: 'For students',
          featureLines: linesFromText(subStudentFeatures),
          recommended: true,
          fixedMwkPrice: studentPrice,
          usdAmounts: [],
          usdAmountsText: '',
          active: true,
        })
      }
      if (privatePrice >= 1) {
        const privateName = subPrivateName.trim() || 'Private plan'
        next.push({
          key: uniqueKey(`${hubKey}_private`),
          name: privateName,
          subtitle: linesFromText(subPrivateFeatures).join(' · ') || privateName,
          category: 'streaming',
          brandTag: 'Private',
          hubKey,
          planBadge: 'Private',
          featureLines: linesFromText(subPrivateFeatures),
          recommended: false,
          fixedMwkPrice: privatePrice,
          usdAmounts: [],
          usdAmountsText: '',
          active: true,
        })
      }
    } else {
      const price = Math.round(Number(subSimplePrice) || 0)
      if (price < 1) {
        setError('MWK price must be at least 1.')
        return
      }
      next.push({
        key: hubKey,
        name,
        subtitle: '1-month subscription',
        category: 'streaming',
        brandTag: name,
        imageUrl,
        fixedMwkPrice: price,
        usdAmounts: [],
        usdAmountsText: '',
        isHub: false,
        active: true,
      })
    }

    const ok = await save(next)
    if (ok) {
      setSubName('')
      setSubImageUrl('')
      setSubSimplePrice(15000)
      setNotice(
        subAsHub
          ? `${name} is live. App users tap it, then pick Student or Private — like ChatGPT.`
          : `${name} is live in the app.`,
      )
    }
  }

  const removeProduct = async (key: string) => {
    const name = products.find((p) => p.key === key)?.name || key
    const extra = products.some((p) => p.hubKey === key)
      ? ' Its plans will be removed too.'
      : ''
    if (!(await confirmDelete(name, `It will disappear from the app.${extra}`))) return
    const next = products.filter((p) => p.key !== key && p.hubKey !== key)
    await save(next)
  }

  const subs = products.filter(
    (p) => p.category === 'streaming' || p.category === 'subscription',
  )
  const netflixPlans = subs.filter((p) => p.key.startsWith('netflix_') || p.hubKey === 'netflix')
  const chatGptPlans = subs.filter(
    (p) =>
      p.hubKey === 'chatgpt' ||
      p.key === 'chatgpt_basic' ||
      p.key === 'chatgpt_plus',
  )
  const customHubs = subs.filter(
    (p) => isHubProduct(p) && p.key !== 'netflix' && p.key !== 'chatgpt',
  )
  const otherSubs = subs.filter(
    (p) =>
      !p.key.startsWith('netflix') &&
      p.key !== 'chatgpt' &&
      p.key !== 'chatgpt_basic' &&
      p.key !== 'chatgpt_plus' &&
      p.hubKey !== 'netflix' &&
      p.hubKey !== 'chatgpt' &&
      !isHubProduct(p) &&
      !p.hubKey,
  )
  const cryptos = products.filter((p) => p.category === 'crypto')
  const gifts = products.filter(
    (p) =>
      p.category !== 'streaming' &&
      p.category !== 'subscription' &&
      p.category !== 'crypto',
  )

  const newPreview = useMemo(() => {
    const amounts = newAmounts
      .split(/[,\s]+/)
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x) && x > 0)
    const r = Math.round(Number(newRate) || 0)
    const first = amounts[0] || 0
    return {
      first,
      final: first > 0 && r > 0 ? Math.round(first * r) : 0,
      unit: newUnit.trim() || 'unit',
      rate: r,
    }
  }, [newAmounts, newRate, newUnit])

  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: 22,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
            Prices & USD → MWK rate
          </h2>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13.5 }}>
            Uncheck <strong>Active</strong> when you are out of stock. That product
            hides in the Vero360 app immediately. Check it again when stock returns.
            Price edits still need <strong>Save prices</strong>.
          </p>
          {(updatedAt || updatedBy) && (
            <p style={{ margin: '6px 0 0', color: '#9A3412', fontSize: 12.5, fontWeight: 600 }}>
              Last saved{updatedBy ? ` by ${updatedBy}` : ''}
              {updatedAt ? ` · ${new Date(updatedAt).toLocaleString()}` : ''}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => void load()} disabled={loading || saving} style={ghostBtn}>
            Reload
          </button>
          <button type="button" onClick={() => void save()} disabled={loading || saving} style={primaryBtn}>
            {saving ? 'Saving…' : 'Save prices'}
          </button>
        </div>
      </div>

      {(error || notice) && (
        <div
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 12,
            background: error ? '#FEF2F2' : '#ECFDF5',
            color: error ? '#991B1B' : '#166534',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {error || notice}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading pricing…</p>
      ) : (
        <>
          <label style={labelStyle}>
            USD → MWK rate (gift cards & gaming)
            <input
              type="number"
              min={100}
              max={100000}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value) || 0)}
              style={inputStyle}
            />
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>
              Example: $10 gift card = MWK {(10 * (Number(rate) || 0)).toLocaleString()}
            </span>
          </label>

          <h3 style={sectionTitle}>Create subscription</h3>
          <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 13 }}>
            Same as a gift card, but for apps like Claude or Canva. Turn on plan
            picker to add a student plan and a private plan — the same steps as ChatGPT.
          </p>
          <article style={{ ...cardStyle, borderColor: '#FDBA74', background: '#FFF7ED' }}>
            <div style={rowStyle}>
              <label style={fieldLabel}>
                Name
                <input
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="Claude"
                  style={inputStyle}
                />
              </label>
              <label style={{ ...checkLabel, alignSelf: 'end', paddingBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={subAsHub}
                  onChange={(e) => setSubAsHub(e.target.checked)}
                />
                Plan picker (student / private)
              </label>
            </div>
            <div style={rowStyle}>
              <label style={fieldLabel}>
                Picture URL (optional)
                <input
                  value={subImageUrl}
                  onChange={(e) => setSubImageUrl(e.target.value)}
                  placeholder="https://…"
                  style={inputStyle}
                />
              </label>
              <label style={fieldLabel}>
                Or upload picture
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading || saving}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadImage(file, 'sub')
                    e.target.value = ''
                  }}
                  style={{ ...inputStyle, padding: 8 }}
                />
              </label>
            </div>
            {subImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={subImageUrl}
                alt=""
                style={{
                  marginTop: 12,
                  width: 72,
                  height: 72,
                  objectFit: 'cover',
                  borderRadius: 12,
                  border: '1px solid #FDBA74',
                }}
              />
            ) : null}
            {subAsHub ? (
              <>
                <div style={rowStyle}>
                  <label style={fieldLabel}>
                    Student plan name
                    <input
                      value={subStudentName}
                      onChange={(e) => setSubStudentName(e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldLabel}>
                    Student MWK / month
                    <input
                      type="number"
                      min={0}
                      value={subStudentPrice}
                      onChange={(e) => setSubStudentPrice(Number(e.target.value) || 0)}
                      style={inputStyle}
                    />
                  </label>
                </div>
                <label style={{ ...fieldLabel, marginTop: 10 }}>
                  Student steps (one per line)
                  <textarea
                    value={subStudentFeatures}
                    onChange={(e) => setSubStudentFeatures(e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </label>
                <div style={rowStyle}>
                  <label style={fieldLabel}>
                    Private plan name
                    <input
                      value={subPrivateName}
                      onChange={(e) => setSubPrivateName(e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldLabel}>
                    Private MWK / month
                    <input
                      type="number"
                      min={0}
                      value={subPrivatePrice}
                      onChange={(e) => setSubPrivatePrice(Number(e.target.value) || 0)}
                      style={inputStyle}
                    />
                  </label>
                </div>
                <label style={{ ...fieldLabel, marginTop: 10 }}>
                  Private steps (one per line)
                  <textarea
                    value={subPrivateFeatures}
                    onChange={(e) => setSubPrivateFeatures(e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </label>
              </>
            ) : (
              <label style={{ ...fieldLabel, marginTop: 10, maxWidth: 280 }}>
                MWK price / month
                <input
                  type="number"
                  min={1}
                  value={subSimplePrice}
                  onChange={(e) => setSubSimplePrice(Number(e.target.value) || 0)}
                  style={inputStyle}
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => void createSubscription()}
              disabled={saving || uploading}
              style={{ ...primaryBtn, marginTop: 12 }}
            >
              {saving ? 'Creating…' : 'Create subscription'}
            </button>
          </article>

          <h3 style={sectionTitle}>Create crypto / FX gift card</h3>
          <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 13 }}>
            Build USDT, Yuan, BNB, or any unit: picture, name, amounts, your MWK rate,
            and live final price.
          </p>
          <article style={{ ...cardStyle, borderColor: '#FDBA74', background: '#FFF7ED' }}>
            <div style={rowStyle}>
              <label style={fieldLabel}>
                Name
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="USDT"
                  style={inputStyle}
                />
              </label>
              <label style={fieldLabel}>
                Unit label
                <input
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="USDT / CNY / BNB"
                  style={inputStyle}
                />
              </label>
            </div>
            <div style={rowStyle}>
              <label style={fieldLabel}>
                Amounts (comma-separated)
                <input
                  value={newAmounts}
                  onChange={(e) => setNewAmounts(e.target.value)}
                  placeholder="10, 50, 100"
                  style={inputStyle}
                />
              </label>
              <label style={fieldLabel}>
                Rate (MWK per unit)
                <input
                  type="number"
                  min={1}
                  value={newRate}
                  onChange={(e) => setNewRate(Number(e.target.value) || 0)}
                  style={inputStyle}
                />
              </label>
            </div>
            <div style={rowStyle}>
              <label style={fieldLabel}>
                Max other amount ({newUnit.trim() || 'unit'})
                <input
                  type="number"
                  min={1}
                  value={newMaxOther}
                  onChange={(e) => setNewMaxOther(Number(e.target.value) || 0)}
                  placeholder="1000"
                  style={inputStyle}
                />
              </label>
              <p style={{ margin: 0, fontSize: 12.5, color: '#6B7280', alignSelf: 'end', paddingBottom: 10 }}>
                App “other amount” field uses this unit + max (not a fixed $500).
              </p>
            </div>
            <div style={rowStyle}>
              <label style={fieldLabel}>
                Picture URL (optional)
                <input
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://…"
                  style={inputStyle}
                />
              </label>
              <label style={fieldLabel}>
                Or upload picture
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading || saving}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadImage(file, 'new')
                    e.target.value = ''
                  }}
                  style={{ ...inputStyle, padding: 8 }}
                />
              </label>
            </div>
            {newImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={newImageUrl}
                alt=""
                style={{
                  marginTop: 12,
                  width: 72,
                  height: 72,
                  objectFit: 'cover',
                  borderRadius: 12,
                  border: '1px solid #FDBA74',
                }}
              />
            ) : null}
            <p
              style={{
                margin: '14px 0 0',
                fontSize: 14,
                fontWeight: 800,
                color: '#9A3412',
              }}
            >
              Final price preview:{' '}
              {newPreview.first > 0
                ? `${newPreview.first} ${newPreview.unit} × MWK ${newPreview.rate.toLocaleString()} = MWK ${newPreview.final.toLocaleString()}`
                : 'Enter amount + rate'}
            </p>
            <button
              type="button"
              onClick={() => void createCryptoCard()}
              disabled={saving || uploading}
              style={{ ...primaryBtn, marginTop: 12 }}
            >
              {saving ? 'Creating…' : 'Create gift card'}
            </button>
          </article>

          {cryptos.length > 0 && (
            <>
              <h3 style={sectionTitle}>Your crypto / FX cards</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {cryptos.map((p) => {
                  const amounts = (p.usdAmountsText || '')
                    .split(/[,\s]+/)
                    .map((x) => Number(x.trim()))
                    .filter((x) => Number.isFinite(x) && x > 0)
                  const unitRate = Math.round(Number(p.mwkPerUnit) || 0)
                  const first = amounts[0] || 0
                  const final =
                    first > 0 && unitRate > 0 ? Math.round(first * unitRate) : 0
                  return (
                    <article
                      key={p.key}
                      style={{
                        ...cardStyle,
                        opacity: p.active === false ? 0.72 : 1,
                        borderColor: p.active === false ? '#FECACA' : '#E5E7EB',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <strong style={{ fontSize: 14 }}>
                          {p.name}{' '}
                          <span style={{ color: '#6B7280', fontWeight: 600 }}>
                            · {p.unitLabel || 'unit'}
                          </span>
                        </strong>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <label style={checkLabel}>
                            <input
                              type="checkbox"
                              checked={p.active !== false}
                              disabled={saving}
                              onChange={(e) =>
                                void toggleActive(p.key, e.target.checked)
                              }
                            />
                            {p.active !== false ? 'Active in app' : 'Out of stock'}
                          </label>
                          <button
                            type="button"
                            onClick={() => void removeProduct(p.key)}
                            disabled={saving}
                            style={{
                              ...ghostBtn,
                              padding: '6px 10px',
                              color: '#B91C1C',
                              borderColor: '#FECACA',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            style={{
                              width: 56,
                              height: 56,
                              objectFit: 'cover',
                              borderRadius: 10,
                              border: '1px solid #E5E7EB',
                            }}
                          />
                        ) : null}
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={rowStyle}>
                            <label style={fieldLabel}>
                              Display name
                              <input
                                value={p.name}
                                onChange={(e) =>
                                  updateProduct(p.key, { name: e.target.value })
                                }
                                style={inputStyle}
                              />
                            </label>
                            <label style={fieldLabel}>
                              Unit
                              <input
                                value={p.unitLabel || ''}
                                onChange={(e) =>
                                  updateProduct(p.key, {
                                    unitLabel: e.target.value,
                                    brandTag: e.target.value,
                                  })
                                }
                                style={inputStyle}
                              />
                            </label>
                          </div>
                          <div style={rowStyle}>
                            <label style={fieldLabel}>
                              Amounts
                              <input
                                value={p.usdAmountsText}
                                onChange={(e) =>
                                  updateProduct(p.key, {
                                    usdAmountsText: e.target.value,
                                  })
                                }
                                style={inputStyle}
                              />
                            </label>
                            <label style={fieldLabel}>
                              MWK per unit
                              <input
                                type="number"
                                min={1}
                                value={p.mwkPerUnit ?? 0}
                                onChange={(e) =>
                                  updateProduct(p.key, {
                                    mwkPerUnit: Number(e.target.value) || 0,
                                  })
                                }
                                style={inputStyle}
                              />
                            </label>
                          </div>
                          <div style={rowStyle}>
                            <label style={fieldLabel}>
                              Max other amount ({p.unitLabel || 'unit'})
                              <input
                                type="number"
                                min={1}
                                value={p.maxOtherAmount ?? ''}
                                placeholder="e.g. 1000"
                                onChange={(e) =>
                                  updateProduct(p.key, {
                                    maxOtherAmount:
                                      e.target.value === ''
                                        ? null
                                        : Number(e.target.value) || 0,
                                  })
                                }
                                style={inputStyle}
                              />
                            </label>
                          </div>
                          <label style={{ ...fieldLabel, marginTop: 10 }}>
                            Picture
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploading || saving}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) void uploadImage(file, p.key)
                                e.target.value = ''
                              }}
                              style={{ ...inputStyle, padding: 8 }}
                            />
                          </label>
                          <p
                            style={{
                              margin: '10px 0 0',
                              fontSize: 13,
                              fontWeight: 800,
                              color: '#9A3412',
                            }}
                          >
                            Final:{' '}
                            {first > 0
                              ? `${first} ${p.unitLabel || 'unit'} × ${unitRate.toLocaleString()} = MWK ${final.toLocaleString()}`
                              : 'Set amount + rate'}
                          </p>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}

          <h3 style={sectionTitle}>Netflix plans (MWK / month)</h3>
          <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
            App users tap Netflix → Choose your plan. Set each monthly price here.
            Turn a plan off when out of stock. Premium is marked Most popular in the app.
          </p>
          <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
            {netflixPlans.map((p) => (
              <article
                key={p.key}
                style={{
                  ...cardStyle,
                  opacity: p.active === false ? 0.72 : 1,
                  borderColor:
                    p.key === 'netflix_premium'
                      ? '#FDBA74'
                      : p.active === false
                        ? '#FECACA'
                        : '#E5E7EB',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong style={{ fontSize: 14 }}>
                    {p.name}
                    {p.key === 'netflix_premium' ? (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#EA580C',
                        }}
                      >
                        Most popular
                      </span>
                    ) : null}
                  </strong>
                  <label style={checkLabel} title="When off, this plan is hidden in the app">
                    <input
                      type="checkbox"
                      checked={p.active !== false}
                      disabled={saving}
                      onChange={(e) => void toggleActive(p.key, e.target.checked)}
                    />
                    {p.active !== false ? 'Active in app' : 'Out of stock'}
                  </label>
                </div>
                <p style={{ margin: '6px 0 0', color: '#6B7280', fontSize: 12.5, lineHeight: 1.4 }}>
                  {p.subtitle || netflixPlanHint(p.key)}
                </p>
                <div style={rowStyle}>
                  <label style={fieldLabel}>
                    Display name
                    <input
                      value={p.name}
                      onChange={(e) => updateProduct(p.key, { name: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldLabel}>
                    MWK price / month
                    <input
                      type="number"
                      min={0}
                      value={p.fixedMwkPrice ?? 0}
                      onChange={(e) =>
                        updateProduct(p.key, {
                          fixedMwkPrice: Number(e.target.value) || 0,
                        })
                      }
                      style={inputStyle}
                    />
                  </label>
                </div>
              </article>
            ))}
            {netflixPlans.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                Netflix plans will appear after you reload prices (defaults: Mobile, Basic,
                Standard, Premium).
              </p>
            ) : null}
          </div>

          <h3 style={sectionTitle}>ChatGPT plans (MWK / month)</h3>
          <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
            App and website users tap ChatGPT, then Choose your plan. Basic is the
            shared student login (up to 15). ChatGPT Plus is one private account.
          </p>
          <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
            {chatGptPlans.map((p) => (
              <article
                key={p.key}
                style={{
                  ...cardStyle,
                  opacity: p.active === false ? 0.72 : 1,
                  borderColor:
                    p.key === 'chatgpt_plus'
                      ? '#FDBA74'
                      : p.active === false
                        ? '#FECACA'
                        : '#E5E7EB',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong style={{ fontSize: 14 }}>
                    {p.name}
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#EA580C',
                      }}
                    >
                      {p.key === 'chatgpt_basic' ? 'For students' : 'Private'}
                    </span>
                  </strong>
                  <label style={checkLabel} title="When off, this plan is hidden">
                    <input
                      type="checkbox"
                      checked={p.active !== false}
                      disabled={saving}
                      onChange={(e) => void toggleActive(p.key, e.target.checked)}
                    />
                    {p.active !== false ? 'Active' : 'Out of stock'}
                  </label>
                </div>
                <p style={{ margin: '6px 0 0', color: '#6B7280', fontSize: 12.5, lineHeight: 1.4 }}>
                  {p.subtitle || chatGptPlanHint(p.key)}
                </p>
                <div style={rowStyle}>
                  <label style={fieldLabel}>
                    Display name
                    <input
                      value={p.name}
                      onChange={(e) => updateProduct(p.key, { name: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldLabel}>
                    MWK price / month
                    <input
                      type="number"
                      min={0}
                      value={p.fixedMwkPrice ?? 0}
                      onChange={(e) =>
                        updateProduct(p.key, {
                          fixedMwkPrice: Number(e.target.value) || 0,
                        })
                      }
                      style={inputStyle}
                    />
                  </label>
                </div>
                <label style={{ ...fieldLabel, marginTop: 10 }}>
                  Plan steps (one per line)
                  <textarea
                    value={(p.featureLines || []).join('\n')}
                    onChange={(e) =>
                      updateProduct(p.key, {
                        featureLines: linesFromText(e.target.value),
                      })
                    }
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </label>
              </article>
            ))}
            {chatGptPlans.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                ChatGPT plans will appear after you reload prices (Basic MWK 10,000 and
                Plus MWK 65,000).
              </p>
            ) : null}
          </div>

          {customHubs.length > 0 ? (
            <>
              <h3 style={sectionTitle}>Your subscriptions (plan picker)</h3>
              <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 13 }}>
                Each one opens a ChatGPT-style chooser in the app. Edit plan names,
                MWK prices, and the student/private steps.
              </p>
              <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
                {customHubs.map((hub) => {
                  const plans = subs.filter((p) => p.hubKey === hub.key)
                  return (
                    <article
                      key={hub.key}
                      style={{
                        ...cardStyle,
                        borderColor: '#FDBA74',
                        opacity: hub.active === false ? 0.72 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <strong style={{ fontSize: 15 }}>{hub.name}</strong>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <label style={checkLabel}>
                            <input
                              type="checkbox"
                              checked={hub.active !== false}
                              disabled={saving}
                              onChange={(e) => void toggleActive(hub.key, e.target.checked)}
                            />
                            {hub.active !== false ? 'Active' : 'Out of stock'}
                          </label>
                          <button
                            type="button"
                            onClick={() => void removeProduct(hub.key)}
                            style={{ ...ghostBtn, color: '#B91C1C' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div style={rowStyle}>
                        <label style={fieldLabel}>
                          Display name
                          <input
                            value={hub.name}
                            onChange={(e) => updateProduct(hub.key, { name: e.target.value })}
                            style={inputStyle}
                          />
                        </label>
                        <label style={fieldLabel}>
                          Subtitle
                          <input
                            value={hub.subtitle || ''}
                            onChange={(e) =>
                              updateProduct(hub.key, { subtitle: e.target.value })
                            }
                            style={inputStyle}
                          />
                        </label>
                      </div>
                      {plans.map((plan) => (
                        <div
                          key={plan.key}
                          style={{
                            marginTop: 12,
                            padding: 12,
                            borderRadius: 12,
                            border: '1px solid #FED7AA',
                            background: '#fff',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <strong style={{ fontSize: 13 }}>
                              {plan.name}
                              {plan.planBadge ? (
                                <span style={{ marginLeft: 8, fontSize: 11, color: '#EA580C' }}>
                                  {plan.planBadge}
                                </span>
                              ) : null}
                            </strong>
                            <label style={checkLabel}>
                              <input
                                type="checkbox"
                                checked={plan.active !== false}
                                disabled={saving}
                                onChange={(e) => void toggleActive(plan.key, e.target.checked)}
                              />
                              {plan.active !== false ? 'Active' : 'Hidden'}
                            </label>
                          </div>
                          <div style={rowStyle}>
                            <label style={fieldLabel}>
                              Plan name
                              <input
                                value={plan.name}
                                onChange={(e) =>
                                  updateProduct(plan.key, { name: e.target.value })
                                }
                                style={inputStyle}
                              />
                            </label>
                            <label style={fieldLabel}>
                              Badge
                              <input
                                value={plan.planBadge || ''}
                                onChange={(e) =>
                                  updateProduct(plan.key, { planBadge: e.target.value })
                                }
                                placeholder="For students"
                                style={inputStyle}
                              />
                            </label>
                            <label style={fieldLabel}>
                              MWK / month
                              <input
                                type="number"
                                min={0}
                                value={plan.fixedMwkPrice ?? 0}
                                onChange={(e) =>
                                  updateProduct(plan.key, {
                                    fixedMwkPrice: Number(e.target.value) || 0,
                                  })
                                }
                                style={inputStyle}
                              />
                            </label>
                          </div>
                          <label style={{ ...fieldLabel, marginTop: 10 }}>
                            Steps (one per line)
                            <textarea
                              value={(plan.featureLines || []).join('\n')}
                              onChange={(e) =>
                                updateProduct(plan.key, {
                                  featureLines: linesFromText(e.target.value),
                                })
                              }
                              rows={3}
                              style={{ ...inputStyle, resize: 'vertical' }}
                            />
                          </label>
                        </div>
                      ))}
                    </article>
                  )
                })}
              </div>
            </>
          ) : null}

          <h3 style={sectionTitle}>Other subscriptions (fixed MWK)</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {otherSubs.map((p) => (
              <article
                key={p.key}
                style={{
                  ...cardStyle,
                  opacity: p.active === false ? 0.72 : 1,
                  borderColor: p.active === false ? '#FECACA' : '#E5E7EB',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong style={{ fontSize: 14 }}>{p.name}</strong>
                  <label style={checkLabel} title="When off, this product is hidden in the app">
                    <input
                      type="checkbox"
                      checked={p.active !== false}
                      disabled={saving}
                      onChange={(e) =>
                        void toggleActive(p.key, e.target.checked)
                      }
                    />
                    {p.active !== false ? 'Active in app' : 'Out of stock'}
                  </label>
                </div>
                <div style={rowStyle}>
                  <label style={fieldLabel}>
                    Display name
                    <input
                      value={p.name}
                      onChange={(e) => updateProduct(p.key, { name: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  {p.key === 'netflix' || p.key === 'chatgpt' ? (
                    <p style={{ margin: 0, fontSize: 12.5, color: '#6B7280', alignSelf: 'end', paddingBottom: 10 }}>
                      {p.key === 'chatgpt'
                        ? 'Hub only. Prices are on the ChatGPT plans above.'
                        : 'Hub only. Prices are on the Netflix plans above.'}
                    </p>
                  ) : (
                    <label style={fieldLabel}>
                      MWK price / month
                      <input
                        type="number"
                        min={0}
                        value={p.fixedMwkPrice ?? 0}
                        onChange={(e) =>
                          updateProduct(p.key, {
                            fixedMwkPrice: Number(e.target.value) || 0,
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                  )}
                </div>
                <label style={fieldLabel}>
                  Subtitle
                  <input
                    value={p.subtitle || ''}
                    onChange={(e) =>
                      updateProduct(p.key, { subtitle: e.target.value })
                    }
                    style={inputStyle}
                  />
                </label>
              </article>
            ))}
          </div>

          <h3 style={sectionTitle}>Gift cards & gaming (USD amounts)</h3>
          <div
            style={{
              margin: '0 0 14px',
              padding: '12px 14px',
              borderRadius: 12,
              background: '#FFF7ED',
              border: '1px solid #FED7AA',
              fontSize: 13,
              color: '#9A3412',
              display: 'grid',
              gap: 8,
            }}
          >
            <strong>PrepaidForge auto-fulfill</strong>
            <span>
              {pfStatus.enabled
                ? pfStatus.configured
                  ? `Backend is on. Map exact USD amounts to a live SKU; only new stamped orders auto-buy a PIN. Historical paid orders stay manual.`
                  : `PREPAIDFORGE_ENABLED is on but email/password are missing on vero-backend.`
                : `Off until PREPAIDFORGE_ENABLED=true on vero-backend. Checkout, PawaPay, and admin Send details stay manual.`}
            </span>
            {pfBalance ? (
              <span>
                EUR float: {pfBalance.amount} {pfBalance.currency || 'EUR'}
                {pfStatus.minBalanceEur
                  ? ` · auto-buy pauses below ${pfStatus.minBalanceEur}`
                  : ''}
              </span>
            ) : null}
            <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
              <li>KYC at app.prepaidforge.com</li>
              <li>Deposit EUR working capital</li>
              <li>Whitelist the vero-backend public IP</li>
              <li>Reload this catalog and map one gift/gaming SKU at a time</li>
              <li>Set PREPAIDFORGE_ENABLED=true only after a test order</li>
            </ol>
            {pfStatus.error ? <span>{pfStatus.error}</span> : null}
            <button
              type="button"
              onClick={() => void loadPrepaidForge()}
              disabled={pfLoading}
              style={ghostBtn}
            >
              {pfLoading ? 'Loading catalog…' : `Reload catalog (${pfCatalog.length} SKUs)`}
            </button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {gifts.map((p) => (
              <article
                key={p.key}
                style={{
                  ...cardStyle,
                  opacity: p.active === false ? 0.72 : 1,
                  borderColor: p.active === false ? '#FECACA' : '#E5E7EB',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong style={{ fontSize: 14 }}>
                    {p.name}{' '}
                    <span style={{ color: '#6B7280', fontWeight: 600 }}>
                      · {p.category}
                    </span>
                  </strong>
                  <label style={checkLabel} title="When off, this product is hidden in the app">
                    <input
                      type="checkbox"
                      checked={p.active !== false}
                      disabled={saving}
                      onChange={(e) =>
                        void toggleActive(p.key, e.target.checked)
                      }
                    />
                    {p.active !== false ? 'Active in app' : 'Out of stock'}
                  </label>
                </div>
                <div style={rowStyle}>
                  <label style={fieldLabel}>
                    Display name
                    <input
                      value={p.name}
                      onChange={(e) => updateProduct(p.key, { name: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldLabel}>
                    USD amounts (comma-separated)
                    <input
                      value={p.usdAmountsText}
                      onChange={(e) =>
                        updateProduct(p.key, { usdAmountsText: e.target.value })
                      }
                      placeholder="10, 25, 50, 100"
                      style={inputStyle}
                    />
                  </label>
                </div>
                {!(
                  p.prepaidForge?.enabled &&
                  Object.keys(p.prepaidForge.skuByUsd || {}).length
                ) ? (
                  <div style={rowStyle}>
                    <label style={fieldLabel}>
                      Max other amount (USD)
                      <input
                        type="number"
                        min={1}
                        value={p.maxOtherAmount ?? ''}
                        placeholder="e.g. 500"
                        onChange={(e) =>
                          updateProduct(p.key, {
                            maxOtherAmount:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value) || 0,
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12.5,
                        color: '#6B7280',
                        alignSelf: 'end',
                        paddingBottom: 10,
                      }}
                    >
                      Caps the app “other amount” field for this card only.
                    </p>
                  </div>
                ) : (
                  <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#6B7280' }}>
                    Custom “other amount” is hidden on app and web while PrepaidForge is mapped.
                  </p>
                )}
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    background: '#F8FAFC',
                    border: '1px solid #E5E7EB',
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <label style={checkLabel}>
                    <input
                      type="checkbox"
                      checked={p.prepaidForge?.enabled === true}
                      onChange={(e) =>
                        updateProduct(p.key, {
                          prepaidForge: withPrepaidForge(p, {
                            enabled: e.target.checked,
                          }),
                        })
                      }
                    />
                    Auto-fulfill via PrepaidForge
                  </label>
                  <div style={rowStyle}>
                    <label style={fieldLabel}>
                      Redeem region (shown to customers)
                      <input
                        value={p.prepaidForge?.region || ''}
                        placeholder="US"
                        onChange={(e) =>
                          updateProduct(p.key, {
                            prepaidForge: withPrepaidForge(p, {
                              region: e.target.value,
                            }),
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={fieldLabel}>
                      Code type
                      <select
                        value={p.prepaidForge?.preferredCodeType || 'TEXT'}
                        onChange={(e) =>
                          updateProduct(p.key, {
                            prepaidForge: withPrepaidForge(p, {
                              preferredCodeType:
                                e.target.value === 'SCAN' ? 'SCAN' : 'TEXT',
                            }),
                          })
                        }
                        style={inputStyle}
                      >
                        <option value="TEXT">TEXT (PIN)</option>
                        <option value="SCAN">SCAN (image)</option>
                      </select>
                    </label>
                  </div>
                  {(p.usdAmountsText || '')
                    .split(/[,\s]+/)
                    .map((x) => Number(x.trim()))
                    .filter((x) => Number.isFinite(x) && x > 0)
                    .map((usd) => {
                      const key = String(usd)
                      const sku = p.prepaidForge?.skuByUsd?.[key] || ''
                      const stock = sku ? pfStocks[sku] : undefined
                      const soldOut = stock?.quantity === 0
                      const stockHint = !sku
                        ? ''
                        : !stock
                          ? pfStatus.enabled && pfStatus.configured
                            ? 'No live stock yet'
                            : ''
                          : soldOut
                            ? 'Sold out — skip this denomination until restocked'
                            : `${stock.quantity < 0 ? 'Orderable' : `${stock.quantity} in stock`}${
                                Number.isFinite(stock.purchasePrice)
                                  ? ` · wholesale €${stock.purchasePrice}`
                                  : ''
                              }${stock.type ? ` · ${stock.type}` : ''}`
                      return (
                        <label key={usd} style={fieldLabel}>
                          SKU for ${usd}
                          {soldOut ? ' (sold out)' : ''}
                          <input
                            list={`pf-skus-${p.key}`}
                            value={sku}
                            placeholder="e.g. Google-Play-10-USD"
                            onChange={(e) =>
                              updateProduct(p.key, {
                                prepaidForge: withPrepaidForge(p, {
                                  skuByUsd: {
                                    ...(p.prepaidForge?.skuByUsd || {}),
                                    [key]: e.target.value.trim(),
                                  },
                                }),
                              })
                            }
                            style={{
                              ...inputStyle,
                              opacity: soldOut ? 0.65 : 1,
                              border: soldOut
                                ? '1px solid #FECACA'
                                : inputStyle.border,
                            }}
                          />
                          {stockHint ? (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: soldOut ? '#991B1B' : '#6B7280',
                              }}
                            >
                              {stockHint}
                            </span>
                          ) : null}
                        </label>
                      )
                    })}
                  <datalist id={`pf-skus-${p.key}`}>
                    {pfCatalog
                      .filter((item) => {
                        const blob = `${item.sku} ${item.name} ${item.brand || ''}`.toLowerCase()
                        const name = (p.name || '').toLowerCase()
                        return !name || blob.includes(name.split(' ')[0] || '')
                      })
                      .slice(0, 40)
                      .map((item) => (
                        <option key={item.sku} value={item.sku}>
                          {item.name}
                          {item.countries?.length
                            ? ` · ${item.countries.join(',').toUpperCase()}`
                            : ''}
                        </option>
                      ))}
                  </datalist>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

const primaryBtn: CSSProperties = {
  border: 'none',
  borderRadius: 12,
  padding: '10px 14px',
  background: '#FF8A00',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}

const ghostBtn: CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: 12,
  padding: '10px 14px',
  background: '#fff',
  color: '#374151',
  fontWeight: 700,
  cursor: 'pointer',
}

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
  color: '#374151',
  marginBottom: 18,
  maxWidth: 360,
}

const fieldLabel: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 12.5,
  fontWeight: 700,
  color: '#4B5563',
  flex: 1,
  minWidth: 160,
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: '1px solid #D1D5DB',
  padding: '10px 12px',
  fontSize: 14,
  fontWeight: 500,
  background: '#F9FAFB',
}

const sectionTitle: CSSProperties = {
  margin: '22px 0 10px',
  fontSize: 15,
  fontWeight: 900,
  color: '#111827',
}

const cardStyle: CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: 14,
  padding: 14,
  background: '#FFFCFA',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 10,
}

const checkLabel: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12.5,
  fontWeight: 700,
  color: '#374151',
}
