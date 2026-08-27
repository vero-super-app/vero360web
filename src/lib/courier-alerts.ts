'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 12_000
const STORAGE_KEY = 'vero_courier_last_pending_ids'

export type CourierAlertState = {
  pending: number
  toast: string | null
  clearToast: () => void
}

function readKnownIds(): number[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.map(Number).filter(n => Number.isFinite(n) && n > 0)
      : []
  } catch {
    return []
  }
}

function writeKnownIds(ids: number[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, 200)))
  } catch {
    // ignore quota / private mode
  }
}

function notifyBrowser(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: 'vero-courier-pending' })
    } catch {
      // ignore
    }
    return
  }
  if (Notification.permission === 'default') {
    void Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        try {
          new Notification(title, { body, tag: 'vero-courier-pending' })
        } catch {
          // ignore
        }
      }
    })
  }
}

/**
 * Polls pending courier orders for admin badges / toasts.
 * New PENDING deliveries trigger an in-dashboard toast + browser notification.
 */
export function useCourierAlerts(enabled = true): CourierAlertState {
  const [pending, setPending] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const primed = useRef(false)
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const poll = async () => {
      try {
        const res = await adminFetch('/api/admin/courier/pending', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as {
          pending?: number
          pendingIds?: number[]
          latest?: {
            id?: number
            estimatedPriceMwk?: number | null
            estimateSummary?: string | null
          } | null
        }
        if (cancelled) return

        const pendingIds = Array.isArray(data.pendingIds)
          ? data.pendingIds.map(Number).filter(n => Number.isFinite(n) && n > 0)
          : []
        const count = typeof data.pending === 'number' ? data.pending : pendingIds.length
        setPending(count)

        const known = readKnownIds()
        if (!primed.current) {
          writeKnownIds(pendingIds.length ? pendingIds : known)
          primed.current = true
          return
        }

        const knownSet = new Set(known)
        const fresh = pendingIds.filter(id => !knownSet.has(id))
        if (fresh.length > 0) {
          const est =
            data.latest &&
            fresh.includes(Number(data.latest.id)) &&
            typeof data.latest.estimatedPriceMwk === 'number' &&
            data.latest.estimatedPriceMwk > 0
              ? ` · Est. MWK ${Math.round(data.latest.estimatedPriceMwk).toLocaleString('en-MW')}`
              : ''
          const message =
            fresh.length === 1
              ? `New Vero Courier order #${fresh[0]}${est} — Accept or Reject`
              : `${fresh.length} new Vero Courier orders — Accept or Reject`
          setToast(message)
          notifyBrowser('New Vero Courier order', message)
          writeKnownIds([...new Set([...known, ...pendingIds])])
        } else {
          writeKnownIds(pendingIds)
        }
      } catch {
        // keep last known pending
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), POLL_MS)
    const onFocus = () => void poll()
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled])

  return { pending, toast, clearToast }
}
