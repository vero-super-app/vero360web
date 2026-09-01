'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import Logo from './Logo'
import { VeroIcon } from './icons'

const links = {
    Product: ['Marketplace', 'Vero Ride', 'Food & Courier', 'Accommodation','Jobs','digital services'],
    Company: ['About Vero360', 'Careers'],
    Partners: ['Become a merchant', 'Customers', 'Driver signup', 'Partner support'],
    Support: ['Help center', 'Contact us', 'Privacy policy', 'Terms of service'],
  }

const linkHrefs: Record<string, string> = {
  'Marketplace': '/#services',
  'Vero Ride': '/#services',
  'Food & Courier': '/#services',
  'Accommodation': '/#services',
  'About Vero360': '/#about-us',
  'Careers': '/careers',
  'Become a merchant': '/get-started?role=merchant',
  'Customers': '/get-started?role=customer',
  'Driver signup': '/get-started?role=driver',
  'Partner support': '/#contact',
  'Contact us': '/#contact',
  'Privacy policy': '/privacy',
  'Terms of service': '/terms',
}

function openHelpCenter() {
  window.dispatchEvent(new Event('verochat:open'))
}

  export default function Footer() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState<'idle' | 'success' | 'exists' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState('')

    const handleSubscribe = async (e: FormEvent) => {
      e.preventDefault()
      setLoading(true)
      setStatus('idle')
      setErrorMsg('')

      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Something went wrong')

        setStatus(data.alreadySubscribed ? 'exists' : 'success')
        setEmail('')
      } catch (err) {
        setStatus('error')
        setErrorMsg(err instanceof Error ? err.message : 'Could not subscribe. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    return (
      <footer style={{ background: '#0f172a', color: '#fff', padding: '64px 24px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Top row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '240px repeat(4, 1fr)',
            gap: 40, marginBottom: 56,
          }} className="footer-grid">
            {/* Brand */}
            <div>
              <div style={{ marginBottom: 16 }}>
                <Logo height={36} textColor="#fff" />
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 24 }}>
                Malawi&apos;s all-in-one super app. Marketplace, rides, food, courier, jobs, and more on one secure platform.
              </p>
              {/* Contact */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                  <VeroIcon name="mail" size={16} color="rgba(255,255,255,0.45)" />
                  <a href="mailto:info@vero360.app" style={{ color: 'inherit' }}>info@vero360.app</a>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                  <VeroIcon name="map-pin" size={16} color="rgba(255,255,255,0.45)" />
                  <span>Lilongwe Area 14, Malawi</span>
                </div>
              </div>
            </div>
  
            {/* Link columns */}
            {Object.entries(links).map(([col, items]) => (
              <div key={col}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 20 }}>{col}</h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {items.map(link => (
                    <li key={link}>
                      {link === 'Help center' ? (
                        <button
                          type="button"
                          onClick={openHelpCenter}
                          className="footer-link"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                            font: 'inherit',
                          }}
                        >
                          Help center
                        </button>
                      ) : (
                        <Link href={linkHrefs[link] ?? '#'} className="footer-link">{link}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Newsletter */}
          <div className="footer-newsletter" style={{
            background: 'linear-gradient(135deg, rgba(249,115,22,0.15) 0%, rgba(249,115,22,0.05) 100%)',
            borderRadius: 20,
            border: '1px solid rgba(249,115,22,0.35)',
            padding: '36px 40px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 40, flexWrap: 'wrap', gap: 24,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <div style={{ flex: '1 1 280px' }}>
              <span style={{
                display: 'inline-block', padding: '4px 12px', marginBottom: 12,
                background: 'var(--primary)', color: '#fff',
                borderRadius: 100, fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 0.6,
              }}>Newsletter</span>
              <h4 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: '#fff', fontFamily: 'var(--font-display)' }}>
                Stay in the loop
              </h4>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, maxWidth: 400 }}>
                Get updates on new cities, features, and product news. No spam  unsubscribe anytime.
              </p>
            </div>
            <form
              onSubmit={handleSubscribe}
              className="footer-newsletter-form"
              style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: '1 1 320px', maxWidth: 440 }}
            >
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <input
                  type="email"
                  name="email"
                  required
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    if (status !== 'idle') setStatus('idle')
                  }}
                  placeholder="Enter your email"
                  disabled={loading}
                  autoComplete="email"
                  className="footer-email-input"
                  style={{
                    flex: 1,
                    background: '#fff',
                    border: '2px solid transparent',
                    borderRadius: 12, padding: '14px 18px',
                    color: 'var(--text)', fontSize: 15, outline: 'none',
                    minWidth: 0,
                  }}
                />
                <button className="footer-subscribe-btn" type="submit" disabled={loading}>
                  {loading ? '…' : 'Subscribe'}
                </button>
              </div>
              {status === 'success' && (
                <p style={{ fontSize: 13, color: '#86EFAC', margin: 0 }}>
                  You&apos;re subscribed. Thanks for joining Vero360!
                </p>
              )}
              {status === 'exists' && (
                <p style={{ fontSize: 13, color: '#86EFAC', margin: 0 }}>
                  You&apos;re already on the list. Thanks!
                </p>
              )}
              {status === 'error' && (
                <p style={{ fontSize: 13, color: '#FCA5A5', margin: 0 }}>
                  {errorMsg}
                </p>
              )}
            </form>
          </div>
  
          {/* Bottom bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 12,
            paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              © {new Date().getFullYear()} Vero360 Technologies Ltd. All rights reserved.
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
              <Link href="/panel" className="footer-legal-link">Panel</Link>
              <Link href="/privacy" className="footer-legal-link">Privacy</Link>
              <Link href="/terms" className="footer-legal-link">Terms</Link>
            </div>
          </div>
        </div>
  
        <style>{`
          .footer-link {
            font-size: 14px; color: rgba(255,255,255,0.5);
            transition: color 0.2s;
          }
          .footer-link:hover { color: #fff; }
          .footer-subscribe-btn {
            background: var(--primary); color: #fff;
            padding: 14px 28px; border-radius: 12px;
            font-weight: 700; font-size: 15px;
            white-space: nowrap;
            box-shadow: 0 4px 16px rgba(249,115,22,0.4);
            transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
            cursor: pointer;
            border: none;
          }
          .footer-subscribe-btn:hover:not(:disabled) {
            background: var(--primary-dark);
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(249,115,22,0.5);
          }
          .footer-subscribe-btn:disabled {
            opacity: 0.7;
            cursor: wait;
          }
          .footer-email-input:focus {
            border-color: var(--primary) !important;
            box-shadow: 0 0 0 3px rgba(249,115,22,0.25);
          }
          .footer-email-input::placeholder { color: var(--text-4); }
          @media (max-width: 600px) {
            .footer-newsletter-form > div { flex-direction: column !important; }
            .footer-newsletter-form { max-width: 100% !important; }
            .footer-subscribe-btn { width: 100%; text-align: center; }
          }
          .footer-legal-link {
            font-size: 13px; color: rgba(255,255,255,0.4);
            transition: color 0.2s;
          }
          .footer-legal-link:hover { color: #fff; }
          @media (max-width: 900px) {
            .footer-grid { grid-template-columns: 1fr 1fr !important; }
          }
          @media (max-width: 540px) { .footer-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </footer>
    )
  }
