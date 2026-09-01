'use client'

import { useState, type CSSProperties, type FocusEvent, type FormEvent } from 'react'
import { VeroIcon } from './icons'

const CONTACT_EMAIL = 'info@vero360.app'
const CONTACT_LOCATION = 'Lilongwe Area 14, Malawi'

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: '1.5px solid var(--border)',
  fontSize: 15,
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  background: '#fff',
  color: 'var(--text)',
}

function onInputFocus(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--primary)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.15)'
}

function onInputBlur(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--border)'
  e.currentTarget.style.boxShadow = 'none'
}

export default function ContactSection() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setStatus('idle')
    setErrorMsg('')

    try {
      const res = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')

      setStatus('success')
      setName('')
      setEmail('')
      setSubject('')
      setMessage('')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send inquiry')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="contact" style={{ padding: '100px 24px', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{
            display: 'inline-block', padding: '6px 16px',
            background: 'var(--primary-light)', color: 'var(--primary-dark)',
            borderRadius: 100, fontSize: 13, fontWeight: 600, marginBottom: 16,
          }}>Contact us</span>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', letterSpacing: '-0.5px', marginBottom: 16 }}>
            Send an inquiry
          </h2>
          <p style={{ fontSize: 17, color: 'var(--text-3)', lineHeight: 1.7 }}>
            Have a question or want to partner with Vero360? Fill out the form below and we&apos;ll get back to you.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 16,
              marginTop: 28,
            }}
          >
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 18px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: '#fff',
                color: 'var(--text-2)',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <VeroIcon name="mail" size={18} color="var(--primary)" />
              {CONTACT_EMAIL}
            </a>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 18px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: '#fff',
                color: 'var(--text-2)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <VeroIcon name="map-pin" size={18} color="var(--primary)" />
              {CONTACT_LOCATION}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            background: '#fff', borderRadius: 20,
            border: '1px solid var(--border)',
            padding: '36px 32px',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label htmlFor="inquiry-name" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                Your name
              </label>
              <input
                id="inquiry-name"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="vero user"
                style={inputStyle}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
              />
            </div>

            <div>
              <label htmlFor="inquiry-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                Your email
              </label>
              <input
                id="inquiry-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
              />
            </div>

            <div>
              <label htmlFor="inquiry-subject" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                Subject <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="inquiry-subject"
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Partnership, support, general question…"
                style={inputStyle}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
              />
            </div>

            <div>
              <label htmlFor="inquiry-message" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                Message
              </label>
              <textarea
                id="inquiry-message"
                required
                rows={5}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us how we can help…"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
              />
            </div>

            {status === 'success' && (
              <p style={{
                padding: '12px 16px', borderRadius: 10,
                background: '#ECFDF5', color: '#166534',
                fontSize: 14, fontWeight: 500,
              }}>
                Your inquiry was sent successfully. We&apos;ll be in touch soon.
              </p>
            )}

            {status === 'error' && (
              <p style={{
                padding: '12px 16px', borderRadius: 10,
                background: '#FEF2F2', color: '#991B1B',
                fontSize: 14, fontWeight: 500,
              }}>
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inquiry-send-btn"
              style={{
                marginTop: 4, padding: '14px 28px', borderRadius: 12,
                border: 'none', width: '100%',
                background: loading ? 'var(--primary-light)' : 'var(--primary)',
                color: '#fff', fontWeight: 700, fontSize: 16,
                boxShadow: 'var(--shadow-primary)',
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.85 : 1,
              }}
            >
              {loading ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .inquiry-send-btn:hover:not(:disabled) {
          background: var(--primary-dark);
          transform: translateY(-1px);
        }
        @media (max-width: 540px) {
          form { padding: 28px 20px !important; }
        }
      `}</style>
    </section>
  )
}
