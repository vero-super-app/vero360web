'use client'

import { useState } from 'react'
import DownloadAppModal from './landing/DownloadAppModal'

export default function CTASection() {
  const [downloadOpen, setDownloadOpen] = useState(false)

  return (
    <section style={{ padding: '80px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(160deg, #9A3412 0%, #EA580C 55%, #F97316 100%)',
          borderRadius: 28, padding: '72px 56px',
          position: 'relative', overflow: 'hidden',
          textAlign: 'center',
        }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.12)', borderRadius: 100,
              padding: '6px 18px', marginBottom: 24,
              border: '1px solid rgba(255,255,255,0.2)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 500 }}>Launching later this September</span>
            </div>

            <h2 style={{
              fontSize: 'clamp(32px,5vw,56px)', color: '#fff',
              fontWeight: 900, letterSpacing: '-1px',
              marginBottom: 20, fontFamily: 'var(--font-display)',
            }}>
              Your everyday life, one tap away
            </h2>
            <p style={{
              fontSize: 18, color: 'rgba(255,255,255,0.75)',
              maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.7,
            }}>
              Shop, ride, eat, stay, and work from one secure platform built for Malawi.
            </p>

            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/get-started" className="cta-primary">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Get started
              </a>
              <button
                type="button"
                className="cta-secondary"
                onClick={() => setDownloadOpen(true)}
              >
                Notify me at launch
              </button>
            </div>

            <p style={{ marginTop: 32, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
              Secure payments · iOS &amp; Android · Lilongwe first
            </p>
          </div>
        </div>
      </div>
      <style>{`
        .cta-primary {
          padding: 15px 32px; border-radius: 12px;
          background: #fff; color: var(--primary-dark);
          font-weight: 700; font-size: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          display: inline-flex; align-items: center; gap: 8;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.2);
        }
        .cta-secondary {
          padding: 15px 32px; border-radius: 12px;
          border: 1.5px solid rgba(255,255,255,0.35);
          color: #fff; font-weight: 600; font-size: 16px;
          background: rgba(255,255,255,0.08);
          transition: background 0.2s;
          cursor: pointer;
        }
        .cta-secondary:hover { background: rgba(255,255,255,0.15); }
      `}</style>

      <DownloadAppModal open={downloadOpen} onClose={() => setDownloadOpen(false)} />
    </section>
  )
}
