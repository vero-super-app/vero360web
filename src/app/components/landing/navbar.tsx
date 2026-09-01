'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import DownloadAppModal from './DownloadAppModal'
import Logo from './Logo'

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Explore services', href: '/#services' },
  { label: 'Contact', href: '/#contact' },
  { label: 'Our Team', href: '/#about-us' },
]

const moreLinks = [
  { label: 'Privacy policy', href: '/privacy' },
  { label: 'Terms of service', href: '/terms' },
  { label: 'Business certificate', href: '/business-certificate' },
  { label: 'Admin panel', href: '/panel' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!moreOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  const openDownload = () => {
    setMenuOpen(false)
    setMoreOpen(false)
    setDownloadOpen(true)
  }

  const linkStyle = (isScrolled: boolean) => ({
    padding: '8px 16px', borderRadius: 8,
    fontSize: 15, fontWeight: 500,
    color: isScrolled ? 'var(--text-2)' : 'rgba(255,255,255,0.85)',
    transition: 'all 0.2s',
  } as const)

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? 'rgba(255,255,255,0.96)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : 'none',
        transition: 'all 0.3s ease',
        padding: '0 24px',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 72,
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <Logo height={38} textColor={scrolled ? 'var(--text)' : '#fff'} />
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="nav-links">
            {navLinks.map(link => (
              <Link key={link.label} href={link.href} style={linkStyle(scrolled)}
                onMouseEnter={e => (e.currentTarget.style.background = scrolled ? 'var(--surface-2)' : 'rgba(255,255,255,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >{link.label}</Link>
            ))}

            <div ref={moreRef} style={{ position: 'relative' }}>
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                onClick={() => setMoreOpen(o => !o)}
                style={{
                  ...linkStyle(scrolled),
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: moreOpen
                    ? (scrolled ? 'var(--surface-2)' : 'rgba(255,255,255,0.15)')
                    : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                More
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
                  style={{ transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {moreOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: 180,
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: 6,
                    overflow: 'hidden',
                  }}
                >
                  {moreLinks.map(link => (
                    <Link
                      key={link.label}
                      href={link.href}
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      style={{
                        display: 'block',
                        padding: '10px 12px',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--text-2)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }} className="nav-cta">
            <Link href="/get-started" style={{
              padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              color: scrolled ? 'var(--primary)' : '#fff',
              border: `1.5px solid ${scrolled ? 'var(--primary)' : 'rgba(255,255,255,0.5)'}`,
              transition: 'all 0.2s',
            }}>Get started</Link>
            <button
              onClick={openDownload}
              style={{
                padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                background: scrolled ? 'var(--primary)' : '#fff',
                color: scrolled ? '#fff' : 'var(--primary-dark)',
                boxShadow: scrolled ? 'var(--shadow-primary)' : '0 2px 8px rgba(255,255,255,0.3)',
                transition: 'all 0.2s',
              }}
            >Coming soon</button>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="nav-hamburger"
            style={{ display: 'none', flexDirection: 'column', gap: 5, padding: 8 }}
            aria-label="Toggle menu"
          >
            {[0,1,2].map(i => (
              <span key={i} style={{
                display: 'block', width: 22, height: 2,
                background: scrolled ? 'var(--text)' : '#fff',
                borderRadius: 2, transition: 'all 0.2s',
                transform: menuOpen
                  ? i === 0 ? 'rotate(45deg) translate(5px,5px)'
                  : i === 2 ? 'rotate(-45deg) translate(5px,-5px)'
                  : 'scaleX(0)'
                  : 'none',
              }}/>
            ))}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div style={{
          position: 'fixed', top: 72, left: 0, right: 0, zIndex: 99,
          background: '#fff', borderBottom: '1px solid var(--border)',
          padding: '16px 24px 24px',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {navLinks.map(link => (
            <Link key={link.label} href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'block', padding: '14px 0',
                fontSize: 16, fontWeight: 500, color: 'var(--text-2)',
                borderBottom: '1px solid var(--border)',
              }}>{link.label}</Link>
          ))}
          <p style={{
            margin: '16px 0 8px',
            fontSize: 12, fontWeight: 700,
            color: 'var(--text-4)',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}>
            More
          </p>
          {moreLinks.map(link => (
            <Link key={link.label} href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'block', padding: '14px 0',
                fontSize: 16, fontWeight: 500, color: 'var(--text-2)',
                borderBottom: '1px solid var(--border)',
              }}>{link.label}</Link>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <Link href="/get-started" onClick={() => setMenuOpen(false)} style={{
              flex: 1, textAlign: 'center', padding: '12px',
              border: '1.5px solid var(--primary)', borderRadius: 10,
              color: 'var(--primary)', fontWeight: 600, fontSize: 15,
            }}>Get started</Link>
            <button
              onClick={openDownload}
              style={{
                flex: 1, padding: '12px',
                background: 'var(--primary)', borderRadius: 10,
                color: '#fff', fontWeight: 600, fontSize: 15,
              }}
            >Coming soon</button>
          </div>
        </div>
      )}

      <DownloadAppModal open={downloadOpen} onClose={() => setDownloadOpen(false)} />

      <style>{`
        @media (max-width: 768px) {
          .nav-links, .nav-cta { display: none !important; }
          .nav-hamburger { display: flex !important; }
        }
      `}</style>
    </>
  )
}
