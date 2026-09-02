'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 15_000

export type RideAlertState = {
  issues: number
  toast: string | null
  clearToast: () => void
}

/**
 * Polls ride issues count for admin nav badges.
 */
export function useRideAlerts(enabled = true): RideAlertState {
  const [issues, setIssues] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const primed = useRef(false)
  const lastCount = useRef(0)
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const poll = async () => {
      try {
        const res = await adminFetch('/api/admin/rides/pending', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { issues?: number }
        if (cancelled) return

        const count = typeof data.issues === 'number' ? data.issues : 0
        setIssues(count)

        if (!primed.current) {
          primed.current = true
          lastCount.current = count
          return
        }

        if (count > lastCount.current) {
          const delta = count - lastCount.current
          const message =
            delta === 1
              ? '1 ride trip needs attention'
              : `${delta} ride trips need attention`
          setToast(message)
        }
        lastCount.current = count
      } catch {
        // keep last known count
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

  return { issues, toast, clearToast }
}
