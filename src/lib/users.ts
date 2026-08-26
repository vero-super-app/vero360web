import { formatDateTime } from './vero-api'

export const USERS_COLLECTION = 'users'

export const USER_ROLES = ['customer', 'merchant', 'driver'] as const
export type UserRole = (typeof USER_ROLES)[number]

export type AccountStatus = 'active' | 'suspended'
export type AuthProvider = 'google' | 'apple' | 'phone' | 'email' | 'unknown'

export type AppUser = {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  businessName: string | null
  /** Merchant review status (pending/approved) — not the same as accountStatus */
  status: string | null
  accountStatus: AccountStatus
  authProvider: AuthProvider
  photoURL: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type UserCounts = {
  all: number
  customer: number
  merchant: number
  driver: number
  other: number
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString()
      } catch {
        return null
      }
    }
    const seconds = (value as { _seconds?: number; seconds?: number })._seconds
      ?? (value as { seconds?: number }).seconds
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000).toISOString()
    }
  }
  return null
}

export function normalizeRole(raw: unknown): UserRole | 'other' {
  const role = str(raw).toLowerCase()
  if (role === 'customer' || role === 'user' || role === 'passenger') return 'customer'
  if (role === 'merchant' || role === 'business') return 'merchant'
  if (role === 'driver' || role === 'taxi') return 'driver'
  if (!role) return 'customer'
  return 'other'
}

export function parseAccountStatus(data: Record<string, unknown>): AccountStatus {
  const raw = str(data.accountStatus || data.account_status).toLowerCase()
  if (raw === 'suspended' || raw === 'disabled' || raw === 'banned') return 'suspended'
  if (data.disabled === true || data.isDisabled === true) return 'suspended'
  return 'active'
}

export function detectAuthProvider(data: Record<string, unknown>): AuthProvider {
  const raw = str(
    data.authProvider || data.provider || data.signInProvider || data.loginProvider,
  ).toLowerCase()
  if (raw.includes('google')) return 'google'
  if (raw.includes('apple')) return 'apple'
  if (raw.includes('phone')) return 'phone'
  if (raw.includes('email') || raw.includes('password')) return 'email'

  const email = str(data.email || data.contactEmail).toLowerCase()
  if (email.endsWith('@phone.vero360.app') || email.endsWith('@firebase.vero.local')) {
    return 'phone'
  }
  return 'unknown'
}

export function parseAppUser(id: string, data: Record<string, unknown>): AppUser {
  const roleRaw = normalizeRole(data.role ?? data.userRole)
  const role: UserRole = roleRaw === 'other' ? 'customer' : roleRaw

  const displayEmail =
    str(data.contactEmail) ||
    str(data.email) ||
    str(data.Email) ||
    str(data.userEmail)
  const cleanEmail =
    displayEmail.toLowerCase().endsWith('@phone.vero360.app') ||
    displayEmail.toLowerCase().endsWith('@firebase.vero.local')
      ? ''
      : displayEmail

  const name =
    str(data.name) ||
    str(data.displayName) ||
    str(data.fullName) ||
    str(data.givenName) ||
    str(data.firstName) ||
    ''

  const phone =
    str(data.phone) ||
    str(data.phoneNumber) ||
    str(data.mobile) ||
    str(data.Phone) ||
    ''

  return {
    id,
    name: name || '—',
    email: cleanEmail,
    phone,
    role,
    businessName: str(data.businessName) || null,
    status: str(data.status) || null,
    accountStatus: parseAccountStatus(data),
    authProvider: detectAuthProvider(data),
    photoURL: str(data.photoURL) || str(data.photoUrl) || str(data.profilepicture) || null,
    // Prefer true registration time only — never fall back to updatedAt/lastLogin,
    // or a returning user looks like a brand-new signup in the admin list.
    createdAt:
      tsToIso(data.createdAt) ||
      tsToIso(data.registeredAt) ||
      tsToIso(data.joinedAt) ||
      null,
    updatedAt: tsToIso(data.updatedAt) || tsToIso(data.lastLoginAt) || null,
  }
}

/** Fill gaps from Firebase Auth (Google/Apple often only populate Auth, not Firestore). */
export function mergeAuthIntoUser(
  user: AppUser,
  auth: {
    displayName?: string | null
    email?: string | null
    phoneNumber?: string | null
    photoURL?: string | null
    disabled?: boolean
    providerIds?: string[]
    creationTime?: string | null
  },
): AppUser {
  const providers = (auth.providerIds || []).map(p => p.toLowerCase())
  let authProvider = user.authProvider
  if (authProvider === 'unknown') {
    if (providers.some(p => p.includes('google'))) authProvider = 'google'
    else if (providers.some(p => p.includes('apple'))) authProvider = 'apple'
    else if (providers.some(p => p.includes('phone'))) authProvider = 'phone'
    else if (providers.some(p => p.includes('password'))) authProvider = 'email'
  }

  const authEmail = str(auth.email)
  const cleanAuthEmail =
    authEmail.toLowerCase().endsWith('@phone.vero360.app') ||
    authEmail.toLowerCase().endsWith('@firebase.vero.local')
      ? ''
      : authEmail

  const nameFromAuth = str(auth.displayName)
  const phoneFromAuth = str(auth.phoneNumber)

  return {
    ...user,
    name: user.name && user.name !== '—' ? user.name : nameFromAuth || user.name,
    email: user.email || cleanAuthEmail,
    phone: user.phone || phoneFromAuth,
    photoURL: user.photoURL || str(auth.photoURL) || null,
    authProvider,
    accountStatus:
      auth.disabled === true ? 'suspended' : user.accountStatus,
    createdAt:
      user.createdAt ||
      (auth.creationTime ? new Date(auth.creationTime).toISOString() : null),
  }
}

export function countUsers(users: AppUser[]): UserCounts {
  const counts: UserCounts = {
    all: users.length,
    customer: 0,
    merchant: 0,
    driver: 0,
    other: 0,
  }
  for (const user of users) {
    if (user.role === 'customer') counts.customer += 1
    else if (user.role === 'merchant') counts.merchant += 1
    else if (user.role === 'driver') counts.driver += 1
    else counts.other += 1
  }
  return counts
}

export function roleLabel(role: UserRole | 'all') {
  switch (role) {
    case 'all':
      return 'All'
    case 'customer':
      return 'Customer'
    case 'merchant':
      return 'Merchant'
    case 'driver':
      return 'Driver'
  }
}

export function authProviderLabel(provider: AuthProvider) {
  switch (provider) {
    case 'google':
      return 'Google'
    case 'apple':
      return 'Apple'
    case 'phone':
      return 'Phone'
    case 'email':
      return 'Email'
    default:
      return 'Account'
  }
}

export function roleTone(role: UserRole): { bg: string; color: string; border: string } {
  switch (role) {
    case 'customer':
      return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
    case 'merchant':
      return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
    case 'driver':
      return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
  }
}

export { formatDateTime, asRecord }
