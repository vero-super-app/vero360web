import { formatDateTime, resolveVeroMediaUrl, unwrapList } from '@/lib/vero-api'

export const DRIVER_STATUSES = [
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
  'INACTIVE',
] as const

export type DriverStatus = (typeof DRIVER_STATUSES)[number]

export const TAXI_STATUSES = [
  'PENDING_REVIEW',
  'ACTIVE',
  'MAINTENANCE',
  'INACTIVE',
] as const

export type TaxiStatus = (typeof TAXI_STATUSES)[number]

export type FleetTaxi = {
  id: number
  driverId: number
  make: string
  model: string
  year: number
  licensePlate: string
  color: string | null
  seats: number
  status: TaxiStatus
  imageUrl: string | null
  registrationImageUrl: string | null
  insuranceImageUrl: string | null
  insuranceExpiry: string | null
  cofImageUrl: string | null
  cofExpiry: string | null
  registrationNumber: string | null
}

export type FleetDriver = {
  id: number
  userId: number
  name: string
  email: string
  phone: string
  status: DriverStatus
  isVerified: boolean
  isActive: boolean
  licenseNumber: string
  licenseExpiry: string | null
  licenseImageUrl: string | null
  nationalId: string
  nationalIdImageUrl: string | null
  dateOfBirth: string | null
  rejectionReason: string | null
  submittedAt: string | null
  createdAt: string | null
  taxis: FleetTaxi[]
}

export function isDriverStatus(value: string): value is DriverStatus {
  return (DRIVER_STATUSES as readonly string[]).includes(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function nullableStr(value: unknown): string | null {
  const s = str(value)
  return s ? s : null
}

function toId(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = Number(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

function parseDriverStatus(raw: unknown): DriverStatus {
  const value = str(raw).toUpperCase()
  return isDriverStatus(value) ? value : 'PENDING_VERIFICATION'
}

function parseTaxiStatus(raw: unknown): TaxiStatus {
  const value = str(raw).toUpperCase()
  return (TAXI_STATUSES as readonly string[]).includes(value)
    ? (value as TaxiStatus)
    : 'INACTIVE'
}

export function parseTaxi(raw: unknown): FleetTaxi | null {
  const item = asRecord(raw)
  if (!item) return null
  return {
    id: toId(item.id),
    driverId: toId(item.driverId),
    make: str(item.make),
    model: str(item.model),
    year: toId(item.year),
    licensePlate: str(item.licensePlate),
    color: nullableStr(item.color),
    seats: toId(item.seats) || 4,
    status: parseTaxiStatus(item.status),
    imageUrl: resolveVeroMediaUrl(nullableStr(item.imageUrl)),
    registrationImageUrl: resolveVeroMediaUrl(
      nullableStr(item.registrationImageUrl),
    ),
    insuranceImageUrl: resolveVeroMediaUrl(nullableStr(item.insuranceImageUrl)),
    insuranceExpiry: nullableStr(item.insuranceExpiry),
    cofImageUrl: resolveVeroMediaUrl(nullableStr(item.cofImageUrl)),
    cofExpiry: nullableStr(item.cofExpiry),
    registrationNumber: nullableStr(item.registrationNumber),
  }
}

export function parseDriver(raw: unknown): FleetDriver | null {
  const item = asRecord(raw)
  if (!item) return null
  const user = asRecord(item.user) || {}
  const taxisRaw = Array.isArray(item.taxis) ? item.taxis : []
  return {
    id: toId(item.id),
    userId: toId(item.userId),
    name: str(user.name) || 'Driver',
    email: str(user.email),
    phone: str(user.phone),
    status: parseDriverStatus(item.status),
    isVerified: item.isVerified === true,
    isActive: item.isActive !== false,
    licenseNumber: str(item.licenseNumber),
    licenseExpiry: nullableStr(item.licenseExpiry),
    licenseImageUrl: resolveVeroMediaUrl(nullableStr(item.licenseImageUrl)),
    nationalId: str(item.nationalId),
    nationalIdImageUrl: resolveVeroMediaUrl(
      nullableStr(item.nationalIdImageUrl),
    ),
    dateOfBirth: nullableStr(item.dateOfBirth),
    rejectionReason: nullableStr(item.rejectionReason),
    submittedAt: nullableStr(item.submittedAt),
    createdAt: nullableStr(item.createdAt),
    taxis: taxisRaw
      .map(parseTaxi)
      .filter((t): t is FleetTaxi => !!t && t.id > 0),
  }
}

export function parseDriversResponse(body: unknown): {
  drivers: FleetDriver[]
  total: number
} {
  const root = asRecord(body)
  const list = root && Array.isArray(root.drivers)
    ? root.drivers
    : unwrapList(body)
  const drivers = list
    .map(parseDriver)
    .filter((d): d is FleetDriver => !!d && d.id > 0)
  const total =
    typeof root?.total === 'number' ? root.total : drivers.length
  return { drivers, total }
}

export function driverStatusLabel(status: DriverStatus): string {
  switch (status) {
    case 'PENDING_VERIFICATION':
      return 'Pending'
    case 'VERIFIED':
      return 'Verified'
    case 'REJECTED':
      return 'Rejected'
    case 'SUSPENDED':
      return 'Suspended'
    case 'INACTIVE':
      return 'Inactive'
    default:
      return status
  }
}

export function driverStatusTone(status: DriverStatus): {
  bg: string
  color: string
  border: string
} {
  switch (status) {
    case 'PENDING_VERIFICATION':
      return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
    case 'VERIFIED':
      return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
    case 'REJECTED':
      return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
    case 'SUSPENDED':
      return { bg: '#F3F4F6', color: '#374151', border: '#D1D5DB' }
    default:
      return { bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' }
  }
}

export function taxiStatusLabel(status: TaxiStatus): string {
  switch (status) {
    case 'PENDING_REVIEW':
      return 'Pending review'
    case 'ACTIVE':
      return 'Active'
    case 'MAINTENANCE':
      return 'Maintenance'
    case 'INACTIVE':
      return 'Inactive'
    default:
      return status
  }
}

export function isMissingDate(dateStr: string | null): boolean {
  if (!dateStr) return true
  const yearMatch = /^(\d{4})-/.exec(dateStr)
  if (yearMatch && Number(yearMatch[1]) <= 1901) return true
  const d = new Date(dateStr)
  return Number.isNaN(d.getTime()) || d.getUTCFullYear() <= 1901
}

export function isExpired(dateStr: string | null): boolean {
  if (isMissingDate(dateStr)) return true
  const d = new Date(dateStr as string)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  return day < today
}

export function hasCompleteDriverDocs(driver: FleetDriver): boolean {
  return Boolean(driver.licenseImageUrl?.trim() && driver.nationalIdImageUrl?.trim())
}

export function hasCompleteVehicleDocs(taxi: FleetTaxi): boolean {
  return Boolean(
    taxi.imageUrl?.trim() &&
      taxi.insuranceImageUrl?.trim() &&
      taxi.cofImageUrl?.trim() &&
      taxi.model?.trim() &&
      taxi.licensePlate?.trim(),
  )
}

export function isDriverAtLeast18(dateOfBirth: string | null): boolean {
  if (isMissingDate(dateOfBirth)) return false
  const dob = new Date(dateOfBirth as string)
  if (Number.isNaN(dob.getTime())) return false
  const ageYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  return ageYears >= 18
}

/** Calendar date only (DOB / expiry). Hides backend placeholder dates. */
export function formatDateOnly(value?: string | null): string {
  if (!value) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) {
    const year = Number(match[1])
    if (year <= 1901) return '—'
    const d = new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[3])))
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() <= 1901) return '—'
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export { formatDateTime }
