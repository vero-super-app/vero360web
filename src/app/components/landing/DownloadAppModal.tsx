'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  APP_LAUNCH_HEADLINE,
  APP_LAUNCH_LABEL,
  getAppLaunchTimeLeft,
  type AppLaunchTimeLeft,
} from '@/lib/app-launch'
import StoreDownloadLinks from './StoreDownloadLinks'

type Props = {
  open: boolean
  onClose: () => void
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function DownloadAppModal({ open, onClose }: Props) {
  const [timeLeft, setTimeLeft] = useState<AppLaunchTimeLeft | null>(null)

  useEffect(() => {
    if (!open) return
    setTimeLeft(getAppLaunchTimeLeft())
    const id = window.setInterval(() => {
      setTimeLeft(getAppLaunchTimeLeft())
    }, 1000)
    return () => window.clearInterval(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const launched = timeLeft?.launched ?? false
  const pastDue = timeLeft?.pastDue ?? false
  const units = [
    { label: 'Days', value: timeLeft?.days ?? 0 },
    { label: 'Hours', value: timeLeft?.hours ?? 0 },
    { label: 'Mins', value: timeLeft?.minutes ?? 0 },
    { label: 'Secs', value: timeLeft?.seconds ?? 0 },
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 20, padding: '32px 28px',
          maxWidth: 420, width: '100%',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Image src="/logo.png" alt="Vero360" width={40} height={40} style={{ height: 40, width: 'auto' }} />
            <h3 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
              {launched ? 'Download Vero360' : 'Coming Soon'}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ fontSize: 22, color: 'var(--text-3)', lineHeight: 1, padding: 4 }}
          >×</button>
        </div>

        {launched ? (
          <>
            <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.6 }}>
              Vero360 is live. Get the app on the App Store and Google Play.
            </p>
            <StoreDownloadLinks />
          </>
        ) : (
          <>
            <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.6 }}>
              The Vero360 app is coming soon. {APP_LAUNCH_HEADLINE}.
              {pastDue ? (
                <>
                  {' '}
                  We missed our 1 September target and are finishing the last details before release.
                </>
              ) : null}
            </p>

            {!pastDue ? (
              <div
                role="timer"
                aria-live="polite"
                aria-label={
                  timeLeft
                    ? `Countdown to launch: ${timeLeft.days} days, ${timeLeft.hours} hours, ${timeLeft.minutes} minutes, ${timeLeft.seconds} seconds`
                    : 'Loading countdown'
                }
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                {units.map(u => (
                  <div
                    key={u.label}
                    style={{
                      textAlign: 'center',
                      padding: '14px 8px',
                      borderRadius: 14,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{
                      fontSize: 26,
                      fontWeight: 800,
                      fontFamily: 'var(--font-display)',
                      color: 'var(--primary)',
                      letterSpacing: '-0.5px',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {timeLeft ? pad(u.value) : '--'}
                    </div>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-3)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      marginTop: 4,
                    }}>
                      {u.label}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  marginBottom: 20,
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: '#FFF7ED',
                  border: '1px solid #FED7AA',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: '#C2410C' }}>
                  {APP_LAUNCH_LABEL}
                </div>
                <div style={{ fontSize: 13, color: '#9A3412', marginTop: 4 }}>
                  Downloads stay locked until we go live.
                </div>
              </div>
            )}

            <StoreDownloadLinks locked />

            <p style={{
              fontSize: 13,
              color: 'var(--text-3)',
              lineHeight: 1.6,
              textAlign: 'center',
              margin: '16px 0 0',
            }}>
              App Store &amp; Google Play links unlock here when we launch.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
