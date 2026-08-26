/** Client-side throttle so dashboard pages do not sync on every visit. */
export const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

export function autoSyncStorageKey(page: 'jobs' | 'tenders'): string {
  return `vero360.autoSync.${page}`
}

export function shouldRunAutoSync(page: 'jobs' | 'tenders'): boolean {
  if (typeof window === 'undefined') return false
  try {
    const last = Number(localStorage.getItem(autoSyncStorageKey(page)) || 0)
    return !last || Date.now() - last >= AUTO_SYNC_INTERVAL_MS
  } catch {
    return false
  }
}

export function markAutoSyncRan(page: 'jobs' | 'tenders'): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(autoSyncStorageKey(page), String(Date.now()))
  } catch {
    // ignore private mode / quota
  }
}
