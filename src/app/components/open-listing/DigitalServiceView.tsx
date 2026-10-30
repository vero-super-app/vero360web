'use client'

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'
import { formatMwk } from '@/lib/vero-api'

export type DigitalServicePublicDetail = {
  key: string
  name: string
  subtitle: string | null
  categoryLabel: string
  brandTag: string | null
  image: string | null
  priceLabel: string | null
  amountsLabel: string | null
  rateLabel: string | null
  fixedMwkPrice: number | null
  usdAmounts: number[]
  usdToMwkRate: number
  unitLabel?: string | null
  isFixedPrice: boolean
  /** Back link — Netflix plans return to Choose your plan. */
  backHref?: string
  backLabel?: string
  category?: string | null
  payoutKind?: 'cny' | 'usdt' | null
  prepaidForgeRegion?: string | null
  prepaidForgeLocksCustomAmount?: boolean
}

const page: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--surface)',
}
const top: CSSProperties = {
  background: 'linear-gradient(135deg, #9A3412 0%, #F97316 45%, #EA580C 100%)',
  padding: '28px 24px 36px',
}
const body: CSSProperties = {
  maxWidth: 560,
  margin: '-28px auto 0',
  padding: '0 24px 80px',
}
const card: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 20,
  padding: 20,
  boxShadow: 'var(--shadow)',
  marginTop: 18,
}
const label: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 700,
  color: '#374151',
  marginBottom: 6,
}
const input: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontSize: 15,
  fontFamily: 'inherit',
  background: '#fff',
  boxSizing: 'border-box',
}
const btn: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'center',
  textDecoration: 'none',
  borderRadius: 14,
  padding: '14px 16px',
  fontWeight: 800,
  marginTop: 10,
  border: 'none',
  cursor: 'pointer',
  fontSize: 15,
  fontFamily: 'inherit',
}

export default function DigitalServiceView({
  product,
}: {
  product: DigitalServicePublicDetail
}) {
  const presets = product.usdAmounts.length
    ? product.usdAmounts
    : [10, 25, 50, 100]
  const [selectedUsd, setSelectedUsd] = useState<number>(presets[0])
  const [customUsd, setCustomUsd] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [network, setNetwork] = useState<'airtel' | 'tnm'>('airtel')
  const [payMethod, setPayMethod] = useState<'momo' | 'bank'>('momo')
  const [bank, setBank] = useState<{
    enabled: boolean
    bankName?: string
    accountName?: string
    accountNumber?: string
    branch?: string
  } | null>(null)
  const [bankOrder, setBankOrder] = useState<{
    txRef: string
    amountMwk: number
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [paid, setPaid] = useState(false)
  const [depositId, setDepositId] = useState('')
  const [error, setError] = useState('')
  const [binanceId, setBinanceId] = useState('')
  const [binanceAddress, setBinanceAddress] = useState('')
  const [kycUrls, setKycUrls] = useState<Record<string, string>>({})
  const [kycBusy, setKycBusy] = useState('')

  const unit = (product.unitLabel || '').trim() || 'USD'
  const formatUnit = (n: number) =>
    unit === 'USD' ? `$${n}` : `${n} ${unit}`

  const amountMwk = useMemo(() => {
    if (product.isFixedPrice && product.fixedMwkPrice) {
      return Math.round(product.fixedMwkPrice)
    }
    const custom = Number(customUsd)
    const usd =
      product.prepaidForgeLocksCustomAmount ||
      !(Number.isFinite(custom) && custom > 0)
        ? selectedUsd
        : custom
    return Math.round(usd * Math.max(1, product.usdToMwkRate || 4700))
  }, [
    product.isFixedPrice,
    product.fixedMwkPrice,
    product.usdToMwkRate,
    product.prepaidForgeLocksCustomAmount,
    selectedUsd,
    customUsd,
  ])

  useEffect(() => {
    let cancelled = false
    fetch('/api/public/bank-transfer', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        setBank(data && data.enabled ? data : { enabled: false })
      })
      .catch(() => {
        if (!cancelled) setBank({ enabled: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const digits = phone.replace(/\D/g, '')
    const local = digits.startsWith('265') ? `0${digits.slice(3)}` : digits
    if (local.startsWith('09')) setNetwork('airtel')
    else if (local.startsWith('08')) setNetwork('tnm')
  }, [phone])

  useEffect(() => {
    if (!waiting || !depositId || paid) return
    let cancelled = false
    let timer = 0

    async function check() {
      try {
        const res = await fetch(
          `/api/public/payments/pawapay/status?deposit_id=${encodeURIComponent(depositId)}`,
          { cache: 'no-store' },
        )
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (data.paid) {
          setPaid(true)
          setWaiting(false)
          setSubmitting(false)
          return
        }
        if (data.status === 'failed') {
          setWaiting(false)
          setSubmitting(false)
          setError(
            data.failure ||
              data.error ||
              'The prompt was not approved. Try again.',
          )
          return
        }
      } catch {
        if (cancelled) return
      }
      timer = window.setTimeout(check, 3000)
    }

    timer = window.setTimeout(check, 2500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [waiting, depositId, paid])

  async function uploadKyc(slot: string, file: File | undefined) {
    if (!file) return
    setKycBusy(slot)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/public/digital-services/kyc-upload', {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const url = String(data.imageUrl || '').trim()
      if (!url) throw new Error('Upload failed')
      setKycUrls(prev => ({ ...prev, [slot]: url }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setKycBusy('')
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (waiting || paid || bankOrder) return
    setError('')
    if (payMethod === 'bank' && !kycUrls.bankProofUrl) {
      setError('Upload a photo of your transfer slip so we can confirm the payment.')
      return
    }
    setSubmitting(true)
    try {
      const custom = Number(customUsd)
      const usdPayload = product.isFixedPrice
        ? null
        : product.prepaidForgeLocksCustomAmount
          ? selectedUsd
          : Number.isFinite(custom) && custom >= 1
            ? custom
            : selectedUsd

      const payoutKind = product.payoutKind || null
      const payoutKyc = payoutKind
        ? {
            kind: payoutKind,
            alipayWechatCodeUrl: kycUrls.alipayWechatCodeUrl || '',
            idInHandUrl: kycUrls.idInHandUrl || '',
            faceUrl: kycUrls.faceUrl || '',
            binanceId: binanceId.trim(),
            binanceAddress: binanceAddress.trim(),
            binanceCodeUrl: kycUrls.binanceCodeUrl || '',
          }
        : null

      const res = await fetch('/api/public/digital-services/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productKey: product.key,
          buyerName: name.trim(),
          buyerEmail: email.trim(),
          buyerPhone: phone.trim(),
          selectedUsd: usdPayload,
          network,
          method: payMethod === 'bank' ? 'bank_transfer' : 'momo',
          payoutKyc,
          proofUrl: payMethod === 'bank' ? kycUrls.bankProofUrl || '' : '',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Could not start payment')
      }
      if (payMethod === 'bank' || data.method === 'bank_transfer') {
        setBankOrder({
          txRef: String(data.txRef || '').trim(),
          amountMwk: Number(data.amountMwk) || amountMwk,
        })
        setSubmitting(false)
        return
      }
      const id = String(data.depositId || '').trim()
      if (!id) throw new Error('PawaPay did not start the payment.')
      setDepositId(id)
      setWaiting(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setSubmitting(false)
    }
  }

  return (
    <main style={page}>
      <header style={top}>
        <div
          style={{
            maxWidth: 560,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Logo />
          </Link>
          <Link
            href={product.backHref || '/browse/digital-services'}
            style={{
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            {product.backLabel || 'All digital'}
          </Link>
        </div>
      </header>

      <div style={body}>
        <div style={card}>
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: product.image?.endsWith('.svg') ? 96 : 72,
                height: product.image?.endsWith('.svg') ? 60 : 72,
                borderRadius: 16,
                overflow: 'hidden',
                background: 'linear-gradient(145deg, #FFF7ED, #FFEDD5)',
                border: '1px solid #FED7AA',
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {product.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: product.image.endsWith('.svg') ? 'cover' : 'contain',
                    padding: product.image.endsWith('.svg') ? 0 : 8,
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <span style={{ fontWeight: 900, color: '#EA580C', fontSize: 22 }}>
                  {(product.brandTag || product.name).slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#EA580C',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {product.categoryLabel}
              </div>
              <h1
                style={{
                  margin: '4px 0 0',
                  fontSize: 24,
                  letterSpacing: '-0.4px',
                  lineHeight: 1.15,
                }}
              >
                {product.name}
              </h1>
              {product.subtitle ? (
                <p
                  style={{
                    margin: '6px 0 0',
                    color: 'var(--text-3)',
                    fontSize: 14,
                  }}
                >
                  {product.subtitle}
                </p>
              ) : null}
              {product.prepaidForgeRegion ? (
                <p
                  style={{
                    margin: '6px 0 0',
                    color: '#9A3412',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Redeemable in {product.prepaidForgeRegion}
                </p>
              ) : null}
            </div>
          </div>

          <form onSubmit={onSubmit}>
            {!product.isFixedPrice ? (
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Amount (USD)</label>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  {presets.map(usd => {
                    const active = !customUsd && selectedUsd === usd
                    return (
                      <button
                        key={usd}
                        type="button"
                        onClick={() => {
                          setSelectedUsd(usd)
                          setCustomUsd('')
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 999,
                          border: active
                            ? '2px solid #EA580C'
                            : '1px solid var(--border)',
                          background: active ? '#FFF7ED' : '#fff',
                          fontWeight: 800,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {formatUnit(usd)}
                      </button>
                    )
                  })}
                </div>
                {product.prepaidForgeLocksCustomAmount ? (
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 12.5,
                      color: '#6B7280',
                    }}
                  >
                    Choose a listed amount. Custom amounts are off for instant PIN delivery.
                  </p>
                ) : (
                  <input
                    style={input}
                    inputMode="decimal"
                    placeholder={`Or enter custom ${unit} amount`}
                    value={customUsd}
                    onChange={e => setCustomUsd(e.target.value)}
                  />
                )}
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: '#9A3412',
                    fontWeight: 700,
                  }}
                >
                  ≈ {formatMwk(amountMwk)} at {formatMwk(product.usdToMwkRate)} / {unit}
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: '#FFF7ED',
                  border: '1px solid #FED7AA',
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9A3412' }}>
                  Price
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: '#9A3412',
                    marginTop: 2,
                  }}
                >
                  {formatMwk(amountMwk)}
                </div>
                <div style={{ fontSize: 13, color: '#9A3412', marginTop: 4 }}>
                  1-month subscription
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={label} htmlFor="buyer-name">
                Full name
              </label>
              <input
                id="buyer-name"
                style={input}
                required
                minLength={2}
                autoComplete="name"
                placeholder="As on your mobile money account"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={label} htmlFor="buyer-phone">
                Malawi mobile number
              </label>
              <input
                id="buyer-phone"
                style={input}
                required
                disabled={waiting || paid}
                inputMode="tel"
                autoComplete="tel"
                placeholder="099 or 088 number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
            {bank?.enabled ? (
              <div style={{ marginBottom: 12 }}>
                <span style={label}>Pay with</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(
                    [
                      ['momo', 'Airtel / TNM'],
                      ['bank', 'Bank transfer'],
                    ] as const
                  ).map(([id, text]) => (
                    <button
                      key={id}
                      type="button"
                      disabled={waiting || paid || Boolean(bankOrder)}
                      onClick={() => setPayMethod(id)}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: 12,
                        border:
                          payMethod === id
                            ? '2px solid #EA580C'
                            : '1px solid var(--border)',
                        background: payMethod === id ? '#FFF7ED' : '#fff',
                        color: '#111827',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: waiting || paid || bankOrder ? 'default' : 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {payMethod === 'momo' ? (
            <div style={{ marginBottom: 12 }}>
              <span style={label}>Network</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {(
                  [
                    ['airtel', 'Airtel Money (099)'],
                    ['tnm', 'TNM Mpamba (088)'],
                  ] as const
                ).map(([id, text]) => (
                  <button
                    key={id}
                    type="button"
                    disabled={waiting || paid}
                    onClick={() => setNetwork(id)}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      borderRadius: 12,
                      border:
                        network === id
                          ? '2px solid #EA580C'
                          : '1px solid var(--border)',
                      background: network === id ? '#FFF7ED' : '#fff',
                      color: '#111827',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: waiting || paid ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
            ) : null}
            <div style={{ marginBottom: 12 }}>
              <label style={label} htmlFor="buyer-email">
                Email
              </label>
              <input
                id="buyer-email"
                style={input}
                required
                type="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
                Not signed in? We email card details and joining links here after payment.
              </p>
            </div>

            {product.payoutKind === 'cny' ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...label, marginBottom: 8 }}>Payout photos</div>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: '#9A3412', lineHeight: 1.45 }}>
                  For Chinese Yuan / USD TT upload your Alipay or WeChat code, your ID held in
                  your hands, and a photo of your face.
                </p>
                <KycFile
                  label="Alipay / WeChat code"
                  ready={Boolean(kycUrls.alipayWechatCodeUrl)}
                  busy={kycBusy === 'alipayWechatCodeUrl'}
                  onFile={file => void uploadKyc('alipayWechatCodeUrl', file)}
                />
                <KycFile
                  label="ID held in your hands"
                  ready={Boolean(kycUrls.idInHandUrl)}
                  busy={kycBusy === 'idInHandUrl'}
                  onFile={file => void uploadKyc('idInHandUrl', file)}
                />
                <KycFile
                  label="Your face"
                  ready={Boolean(kycUrls.faceUrl)}
                  busy={kycBusy === 'faceUrl'}
                  onFile={file => void uploadKyc('faceUrl', file)}
                />
              </div>
            ) : null}

            {product.payoutKind === 'usdt' ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...label, marginBottom: 8 }}>USDT destination</div>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: '#9A3412', lineHeight: 1.45 }}>
                  Enter your Binance ID or USDT address. You can also upload your Binance code.
                </p>
                <input
                  style={{ ...input, marginBottom: 8 }}
                  placeholder="Binance ID"
                  value={binanceId}
                  onChange={e => setBinanceId(e.target.value)}
                />
                <input
                  style={{ ...input, marginBottom: 8 }}
                  placeholder="USDT address (TRC20 / BEP20)"
                  value={binanceAddress}
                  onChange={e => setBinanceAddress(e.target.value)}
                />
                <KycFile
                  label="Binance code (optional)"
                  ready={Boolean(kycUrls.binanceCodeUrl)}
                  busy={kycBusy === 'binanceCodeUrl'}
                  onFile={file => void uploadKyc('binanceCodeUrl', file)}
                />
              </div>
            ) : null}

            {payMethod === 'bank' && bank?.enabled ? (
              <div
                style={{
                  marginBottom: 14,
                  padding: 14,
                  borderRadius: 14,
                  background: '#FFF7ED',
                  border: '1px solid #FED7AA',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: '#9A3412', marginBottom: 8 }}>
                  Transfer to this account
                </div>
                <BankLine label="Bank" value={bank.bankName || ''} />
                <BankLine label="Account name" value={bank.accountName || ''} />
                <BankLine label="Account number" value={bank.accountNumber || ''} />
                <BankLine label="Branch" value={bank.branch || ''} />
                {bankOrder?.txRef ? (
                  <BankLine label="Payment reference" value={bankOrder.txRef} />
                ) : null}
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9A3412', lineHeight: 1.45 }}>
                  Send the exact amount {formatMwk(bankOrder?.amountMwk || amountMwk)}. Use the
                  payment reference as the deposit description so we can match it.
                </p>
                <p
                  style={{
                    margin: '10px 0 0',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#B08968',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  🔒 Secured by Vero escrow
                </p>
                {!bankOrder ? (
                  <div style={{ marginTop: 12 }}>
                    <KycFile
                      label="Upload transfer slip / proof of payment"
                      ready={Boolean(kycUrls.bankProofUrl)}
                      busy={kycBusy === 'bankProofUrl'}
                      onFile={file => void uploadKyc('bankProofUrl', file)}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {paid ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: '#ECFDF5',
                  color: '#065F46',
                  fontWeight: 600,
                  fontSize: 14,
                  marginBottom: 10,
                }}
              >
                Payment received. We’ll email fulfilment details shortly.
              </div>
            ) : null}

            {waiting ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: '#FFF7ED',
                  color: '#9A3412',
                  fontWeight: 600,
                  fontSize: 14,
                  marginBottom: 10,
                  lineHeight: 1.5,
                }}
              >
                A prompt was sent to your phone. Approve it with your PIN.
                Secured by PawaPay.
              </div>
            ) : null}

            {error ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: '#FEF2F2',
                  color: '#991B1B',
                  fontWeight: 600,
                  fontSize: 14,
                  marginBottom: 10,
                }}
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={
                submitting ||
                waiting ||
                paid ||
                Boolean(kycBusy) ||
                Boolean(bankOrder) ||
                (payMethod === 'bank' && !kycUrls.bankProofUrl)
              }
              style={{
                ...btn,
                background: 'linear-gradient(135deg, #EA580C, #F97316)',
                color: '#fff',
                opacity:
                  submitting ||
                  waiting ||
                  paid ||
                  kycBusy ||
                  bankOrder ||
                  (payMethod === 'bank' && !kycUrls.bankProofUrl)
                    ? 0.7
                    : 1,
              }}
            >
              {paid
                ? 'Payment received'
                : bankOrder
                  ? 'Transfer recorded — we’ll confirm it'
                  : waiting
                    ? 'Waiting for approval…'
                    : submitting
                      ? payMethod === 'bank'
                        ? 'Saving order…'
                        : 'Sending prompt…'
                      : payMethod === 'bank'
                        ? `Send proof · ${formatMwk(amountMwk)}`
                        : `Pay ${formatMwk(amountMwk)} with mobile money`}
            </button>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-3)',
                lineHeight: 1.5,
                margin: '12px 0 0',
                textAlign: 'center',
              }}
            >
              {payMethod === 'bank'
                ? 'Secured by Vero escrow. We’ll confirm your order when the transfer lands, then email fulfilment details.'
                : 'Approve the prompt on your Airtel Money or TNM Mpamba phone. Secured by PawaPay. We’ll email fulfilment details after payment.'}
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}

function BankLine({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 13,
        marginBottom: 6,
      }}
    >
      <span style={{ color: '#9A3412', fontWeight: 700 }}>{label}</span>
      <span style={{ color: '#111827', fontWeight: 800, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function KycFile({
  label,
  ready,
  busy,
  onFile,
}: {
  label: string
  ready: boolean
  busy: boolean
  onFile: (file: File | undefined) => void
}) {
  return (
    <label
      style={{
        display: 'block',
        marginBottom: 8,
        padding: '10px 12px',
        borderRadius: 12,
        border: `1px solid ${ready ? '#F97316' : 'var(--border)'}`,
        background: ready ? '#FFF7ED' : '#fff',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {busy ? `${label} · uploading…` : ready ? `${label} · attached` : label}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        disabled={busy}
        onChange={e => onFile(e.target.files?.[0])}
      />
    </label>
  )
}
