'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import DownloadAppModal from './DownloadAppModal'
import { IconBadge, VeroIcon, type VeroIconName } from './icons'

const stats = [
  { value: '8+', label: 'Services in one app' },
  { value: '5K+', label: 'Community target' },
  { value: '20K+', label: 'Merchant partners' },
]

const quickServices: { icon: VeroIconName; label: string }[] = [
  { icon: 'car', label: 'Vero Ride' },
  { icon: 'plane', label: 'Airport' },
  { icon: 'truck', label: 'Courier' },
  { icon: 'bike', label: 'Vero Bike' },
  { icon: 'forex', label: 'Forex' },
  { icon: 'food', label: 'Food' },
  { icon: 'briefcase', label: 'Jobs' },
  { icon: 'bed', label: 'Stay' },
]

const navItems: { icon: VeroIconName; label: string; active?: boolean }[] = [
  { icon: 'home', label: 'Home', active: true },
  { icon: 'store', label: 'Market' },
  { icon: 'cart', label: 'Cart' },
  { icon: 'chat', label: 'Chat' },
  { icon: 'grid', label: 'More' },
]

function getGreeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatPhoneTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false })
}

export default function HeroSection() {
  const phoneRef = useRef<HTMLDivElement>(null)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    const update = () => setNow(new Date())
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const el = phoneRef.current
    if (!el) return
    let frame: number
    let start: number
    const animate = (ts: number) => {
      if (!start) start = ts
      const t = (ts - start) / 1000
      el.style.transform = `translateY(${Math.sin(t * 0.8) * 10}px)`
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <section style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #9A3412 0%, #EA580C 55%, #F97316 100%)',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
    }}>
      <div style={{
        position: 'absolute', top: -120, right: -80,
        width: 420, height: 420, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        pointerEvents: 'none',
      }}/>

      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '120px 24px 80px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60,
        alignItems: 'center', width: '100%', position: 'relative',
      }} className="hero-grid">

        <div className="hero-content">
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 100, padding: '6px 16px', marginBottom: 28,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}/>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 500 }}>Malawi&apos;s First Super App</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(40px, 5vw, 64px)',
            fontWeight: 900, color: '#fff',
            lineHeight: 1.1, letterSpacing: '-1.5px',
            marginBottom: 24,
          }}>
            One app.{' '}
            <span style={{ display: 'inline-block' }}>Everything.</span>
          </h1>

          <p style={{
            fontSize: 18, color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.7, marginBottom: 40, maxWidth: 480,
          }}>
            Welcome to Vero360   a smarter way to connect with everyday services. From marketplace
            and transport to food delivery, jobs, accommodation, and more in one secure platform.
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 52 }} className="hero-ctas">
              <Link href="/get-started" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#fff', color: 'var(--primary-dark)',
                padding: '14px 28px', borderRadius: 12,
                fontWeight: 700, fontSize: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(0,0,0,0.2)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'none'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.15)'
              }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Get started
              </Link>
              <button
                type="button"
                onClick={() => setDownloadOpen(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  border: '1.5px solid rgba(255,255,255,0.35)',
                  color: '#fff', padding: '14px 28px', borderRadius: 12,
                  fontWeight: 600, fontSize: 16,
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(8px)',
                  transition: 'background 0.2s',
                }}
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <path d="M12 3v12M7 10l5 5 5-5M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Coming soon
              </button>
            </div>

          <div style={{
            display: 'flex', gap: 32, flexWrap: 'wrap',
            paddingTop: 28,
            borderTop: '1px solid rgba(255,255,255,0.15)',
          }} className="hero-stats">
            {stats.map(s => (
              <div key={s.value}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>{s.value}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Phone mockup — Vero360 super app home */}
        <div className="hero-phone" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="hero-phone-scale">
          <div ref={phoneRef} style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: -40,
              background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)',
              borderRadius: '50%',
            }}/>

            <div style={{
              width: 280, height: 580,
              background: '#f3f4f6',
              borderRadius: 44,
              border: '8px solid #1e293b',
              boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Orange header */}
              <div style={{
                background: 'linear-gradient(160deg, #F97316 0%, #FB923C 55%, #FDBA74 100%)',
                padding: '10px 14px 14px',
                position: 'relative',
                flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: -20, right: -10,
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                }}/>
                <div style={{
                  position: 'absolute', top: 30, right: 40,
                  width: 50, height: 50, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                }}/>

                {/* Status bar */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 10,
                }}>
                  <span style={{ color: '#fff', fontSize: 9, fontWeight: 600 }}>
                    {now ? formatPhoneTime(now) : '--:--'}
                  </span>
                  <div style={{ width: 60, height: 14, background: 'rgba(0,0,0,0.25)', borderRadius: 10 }}/>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {[3, 4, 5].map(h => <div key={h} style={{ width: 2, height: h, background: '#fff', borderRadius: 1 }}/>)}
                  </div>
                </div>

                {/* Logo row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Image
                      src="/logo.png"
                      alt="Vero360"
                      width={24}
                      height={24}
                      style={{ height: 24, width: 'auto', borderRadius: 6 }}
                    />
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, fontFamily: 'var(--font-display)' }}>Vero360</span>
                  </div>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <VeroIcon name="bell" size={13} color="#fff" strokeWidth={2} />
                  </div>
                </div>

                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, marginBottom: 2 }}>
                  {now ? getGreeting(now.getHours()) : 'Good day'}
                </p>
                <p style={{ color: '#fff', fontWeight: 800, fontSize: 17, fontFamily: 'var(--font-display)', marginBottom: 2, letterSpacing: '-0.3px' }}>Hi, there</p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, marginBottom: 10 }}>What do you need today?</p>

                {/* Search */}
                <div style={{
                  background: '#fff', borderRadius: 10, padding: '9px 12px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                }}>
                  <VeroIcon name="search" size={12} color="var(--text-4)" strokeWidth={2} />
                  <span style={{ color: 'var(--text-4)', fontSize: 10 }}>what are you looking for?</span>
                </div>
              </div>

              {/* Scrollable body */}
              <div style={{ flex: 1, overflow: 'hidden', padding: '10px 12px 0', background: '#f3f4f6' }}>
                <p style={{ fontSize: 9, color: 'var(--text-4)', marginBottom: 8 }}>No stories right now.</p>

                {/* Pills */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{
                    padding: '5px 10px', borderRadius: 100, fontSize: 9, fontWeight: 600,
                    background: 'var(--primary)', color: '#fff', whiteSpace: 'nowrap',
                  }}>Deals</div>
                  <div style={{
                    padding: '5px 10px', borderRadius: 100, fontSize: 9, fontWeight: 500,
                    background: '#fff', color: 'var(--text-2)', whiteSpace: 'nowrap',
                    border: '1px solid var(--border)',
                  }}>Nearby</div>
                  <div style={{
                    padding: '5px 10px', borderRadius: 100, fontSize: 9, fontWeight: 500,
                    background: '#fff', color: 'var(--text-2)', whiteSpace: 'nowrap',
                    border: '1px solid var(--border)',
                  }}>Top rated</div>
                </div>

                {/* Quick Services card */}
                <div style={{
                  background: '#fff', borderRadius: 14, padding: '12px 10px 10px',
                  marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  <p style={{ fontWeight: 800, fontSize: 12, color: 'var(--text)', marginBottom: 2, fontFamily: 'var(--font-display)' }}>Quick Services</p>
                  <p style={{ fontSize: 9, color: 'var(--text-4)', marginBottom: 10 }}>Everything at your fingertips</p>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
                  }}>
                    {quickServices.map(s => (
                      <div key={s.label} style={{ textAlign: 'center' }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 12,
                          background: 'var(--primary-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto 4px',
                        }}>
                          <VeroIcon name={s.icon} size={18} color="var(--primary-dark)" />
                        </div>
                        <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-2)', lineHeight: 1.2, display: 'block' }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Nearby Services */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>Nearby Services</p>
                    <p style={{ fontSize: 8, color: 'var(--text-4)' }}>Popular around you</p>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--primary)' }}>See all</span>
                </div>
                <div style={{
                  background: '#fff', borderRadius: 12, padding: '10px 12px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--primary-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <VeroIcon name="food" size={16} color="var(--primary-dark)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>Food & Restaurants</p>
                    <p style={{ fontSize: 8, color: 'var(--text-4)' }}>Order from nearby vendors</p>
                  </div>
                </div>
              </div>

              {/* Bottom nav */}
              <div style={{
                display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                padding: '8px 4px 12px',
                background: '#fff',
                borderTop: '1px solid var(--border)',
                flexShrink: 0,
              }}>
                {navItems.map(n => (
                  <div key={n.label} style={{ textAlign: 'center', minWidth: 40 }}>
                    <div style={{
                      marginBottom: 2,
                      background: n.active ? 'var(--primary-light)' : 'transparent',
                      borderRadius: 8, padding: '4px 6px',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <VeroIcon
                        name={n.icon}
                        size={14}
                        color={n.active ? 'var(--primary)' : 'var(--text-4)'}
                        strokeWidth={2}
                      />
                    </div>
                    <div style={{
                      fontSize: 7, fontWeight: n.active ? 700 : 500,
                      color: n.active ? 'var(--primary)' : 'var(--text-4)',
                    }}>{n.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0 }}>
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 80 }}>
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#fff"/>
        </svg>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            text-align: center;
            gap: 32px;
            padding-bottom: 60px;
          }
          .hero-content {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .hero-content > div:first-child { justify-content: center; }
          .hero-content p { margin-left: auto; margin-right: auto; }
          .hero-ctas { justify-content: center; }
          .hero-stats { justify-content: center; }
          .hero-phone { width: 100%; margin-top: 8px; }
          .hero-phone-scale { transform: scale(0.88); transform-origin: top center; }
        }
        @media (max-width: 400px) {
          .hero-phone-scale { transform: scale(0.78); }
        }
      `}</style>
      <DownloadAppModal open={downloadOpen} onClose={() => setDownloadOpen(false)} />
    </section>
  )
}
