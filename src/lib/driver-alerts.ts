'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 12_000
const STORAGE_KEY = 'vero_driver_last_pending_keys'

export type DriverAlertState = {
  pending: number
  pendingDrivers: number
  pendingVehicles: number
  toast: string | null
  clearToast: () => void
}

function readKnownKeys(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((k): k is string => typeof k === 'string' && k.length > 0)
      : []
  } catch {
    return []
  }
}

function writeKnownKeys(keys: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(keys.slice(0, 400)))
  } catch {
    // ignore quota / private mode
  }
}

function notifyBrowser(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: 'vero-driver-pending' })
    } catch {
      // ignore
    }
    return
  }
  if (Notification.permission === 'default') {
    void Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        try {
          new Notification(title, { body, tag: 'vero-driver-pending' })
        } catch {
          // ignore
        }
      }
    })
  }
}

function formatNewItemMessage(
  fresh: { type: string; name: string; detail?: string }[],
): string {
  if (fresh.length === 1) {
    const item = fresh[0]
    if (item.type === 'vehicle') {
      return `New vehicle documents from ${item.name} — review proposal`
    }
    return `New driver application from ${item.name} — review documents`
  }
  const drivers = fresh.filter(i => i.type === 'driver').length
  const vehicles = fresh.filter(i => i.type === 'vehicle').length
  const parts: string[] = []
  if (drivers > 0) {
    parts.push(`${drivers} driver application${drivers === 1 ? '' : 's'}`)
  }
  if (vehicles > 0) {
    parts.push(`${vehicles} vehicle proposal${vehicles === 1 ? '' : 's'}`)
  }
  return `${parts.join(' and ')} need review`
}

/**
 * Polls pending driver/vehicle verifications for admin badges / toasts.
 * New submissions trigger an in-dashboard toast + browser notification.
 */
export function useDriverAlerts(enabled = true): DriverAlertState {
  const [pending, setPending] = useState(0)
  const [pendingDrivers, setPendingDrivers] = useState(0)
  const [pendingVehicles, setPendingVehicles] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const primed = useRef(false)
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const poll = async () => {
      try {
        const res = await adminFetch('/api/admin/drivers/pending', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as {
          pending?: number
          pendingDrivers?: number
          pendingVehicles?: number
          itemKeys?: string[]
          items?: { key: string; type: string; name: string; detail?: string }[]
        }
        if (cancelled) return

        const itemKeys = Array.isArray(data.itemKeys)
          ? data.itemKeys.filter((k): k is string => typeof k === 'string')
          : []
        const count = typeof data.pending === 'number' ? data.pending : itemKeys.length
        setPending(count)
        setPendingDrivers(
          typeof data.pendingDrivers === 'number'
            ? data.pendingDrivers
            : itemKeys.filter(k => k.startsWith('driver:')).length,
        )
        setPendingVehicles(
          typeof data.pendingVehicles === 'number'
            ? data.pendingVehicles
            : itemKeys.filter(k => k.startsWith('vehicle:')).length,
        )

        const known = readKnownKeys()
        if (!primed.current) {
          writeKnownKeys(itemKeys.length ? itemKeys : known)
          primed.current = true
          return
        }

        const knownSet = new Set(known)
        const freshKeys = itemKeys.filter(k => !knownSet.has(k))
        if (freshKeys.length > 0) {
          const items = Array.isArray(data.items) ? data.items : []
          const freshItems = items.filter(i => freshKeys.includes(i.key))
          const message = formatNewItemMessage(freshItems)
          setToast(message)
          notifyBrowser('New driver verification', message)
          writeKnownKeys([...new Set([...known, ...itemKeys])])
        } else {
          writeKnownKeys(itemKeys)
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

  return { pending, pendingDrivers, pendingVehicles, toast, clearToast }
}
