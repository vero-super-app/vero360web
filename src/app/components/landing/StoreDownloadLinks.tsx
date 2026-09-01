'use client'

import type { CSSProperties } from 'react'
import Image from 'next/image'
import { APP_LAUNCH_HEADLINE, isAppStoreLaunched } from '@/lib/app-launch'
import { appStoreLinks, storeBadgeImages } from './veroServices'

type Props = {
  className?: string
  maxWidth?: number
  style?: CSSProperties
  /** Force locked UI even when APP_STORE_LAUNCHED is true. */
  locked?: boolean
}

const linkStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '14px 18px',
  borderRadius: 12,
  border: '1.5px solid var(--border)',
  background: '#fff',
  width: '100%',
}

export default function StoreDownloadLinks({
  className,
  maxWidth = 320,
  style,
  locked,
}: Props) {
  const downloadsLocked = locked ?? !isAppStoreLaunched()

  const renderStoreRow = (
    key: 'ios' | 'android',
    badgeSrc: string,
    badgeAlt: string,
    topLabel: string,
    storeLabel: string,
  ) => {
    const content = (
      <>
        <Image
          src={badgeSrc}
          alt={badgeAlt}
          width={44}
          height={44}
          unoptimized
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            objectFit: key === 'android' ? 'contain' : undefined,
            opacity: downloadsLocked ? 0.55 : 1,
          }}
        />
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{topLabel}</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{storeLabel}</div>
          {downloadsLocked ? (
            <div style={{ fontSize: 11, color: '#C2410C', fontWeight: 600, marginTop: 2 }}>
              {APP_LAUNCH_HEADLINE}
            </div>
          ) : null}
        </div>
      </>
    )

    if (downloadsLocked) {
      return (
        <div
          key={key}
          className="store-download-link store-download-link-locked"
          aria-disabled="true"
          style={{
            ...linkStyle,
            cursor: 'not-allowed',
            opacity: 0.92,
            background: 'var(--surface)',
          }}
        >
          {content}
        </div>
      )
    }

    return (
      <a
        key={key}
        href={appStoreLinks[key]}
        target="_blank"
        rel="noopener noreferrer"
        className="store-download-link"
        style={linkStyle}
      >
        {content}
      </a>
    )
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth,
        margin: '0 auto',
        width: '100%',
        ...style,
      }}
    >
      {renderStoreRow(
        'ios',
        storeBadgeImages.appStore,
        'App Store',
        'Download on the',
        'App Store',
      )}
      {renderStoreRow(
        'android',
        storeBadgeImages.googlePlay,
        'Google Play',
        'Get it on',
        'Google Play',
      )}

      <style>{`
        .store-download-link:hover:not(.store-download-link-locked) {
          border-color: var(--primary);
          box-shadow: var(--shadow-primary);
        }
      `}</style>
    </div>
  )
}
