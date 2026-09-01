/** Flip to true when App Store / Google Play downloads should go live. */
export const APP_STORE_LAUNCHED = false

export const APP_LAUNCH_LABEL = 'September 2026'
export const APP_LAUNCH_HEADLINE = 'Launching later this September'

/** Countdown runs through the end of September 2026 (local time). */
export const APP_LAUNCH_COUNTDOWN_AT = new Date(2026, 8, 30, 23, 59, 59, 999)

export type AppLaunchTimeLeft = {
  days: number
  hours: number
  minutes: number
  seconds: number
  launched: boolean
  /** Countdown finished but downloads are still locked until APP_STORE_LAUNCHED. */
  pastDue: boolean
}

export function isAppStoreLaunched(): boolean {
  return APP_STORE_LAUNCHED
}

export function getAppLaunchTimeLeft(now = new Date()): AppLaunchTimeLeft {
  if (APP_STORE_LAUNCHED) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, launched: true, pastDue: false }
  }

  const diff = APP_LAUNCH_COUNTDOWN_AT.getTime() - now.getTime()
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, launched: false, pastDue: true }
  }

  const totalSeconds = Math.floor(diff / 1000)
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    launched: false,
    pastDue: false,
  }
}
